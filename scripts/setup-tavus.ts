/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON from the Tavus API */
/**
 * Creates (or reuses) everything this demo needs in your Tavus account:
 *   - 3 LLM tools in the tools registry (/v2/tools)
 *   - the dispatcher PAL, with those tools attached (/v2/pals/{id}/tools)
 *   - a homeowner PAL used only by the two-agent demo (?demo=1)
 * and writes the IDs into .env.local.
 *
 * Usage: npm run setup   (needs TAVUS_API_KEY in .env.local or the environment)
 * Safe to re-run: tools are matched by name and updated; PALs are reused if their IDs are set.
 */
import fs from "node:fs";
import path from "node:path";
import {
  DISPATCHER_PROMPT,
  DISPATCHER_GREETING,
  HOMEOWNER_PROMPT,
  HOMEOWNER_GREETING,
  STOCK_FACES,
  TOOLS,
  COMPANY,
} from "../src/lib/tavus-config";

const API = "https://tavusapi.com/v2";
const ENV_PATH = path.join(process.cwd(), ".env.local");

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function writeEnvVars(vars: Record<string, string>) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\n?$/, "\n")}${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, text);
}

const fileEnv = readEnvFile();
const env = (k: string) => process.env[k] || fileEnv[k] || "";
const apiKey = env("TAVUS_API_KEY");
if (!apiKey) {
  console.error("Missing TAVUS_API_KEY. Add it to .env.local first (see .env.example).");
  process.exit(1);
}

async function tavus<T = any>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function upsertTool(tool: (typeof TOOLS)[number]): Promise<string> {
  try {
    const created = await tavus<{ tool_id: string }>("POST", "/tools", tool);
    console.log(`  created tool ${tool.name} -> ${created.tool_id}`);
    return created.tool_id;
  } catch (err) {
    if (!String(err).includes("409")) throw err;
    // Name already exists: find it and update it in place so prompt/schema changes apply.
    const list = await tavus<any>("GET", "/tools?type=user&limit=100");
    const items: any[] = list.data ?? list.tools ?? list;
    const existing = items.find((t) => t.name === tool.name);
    if (!existing) throw err;
    await tavus("PATCH", `/tools/${existing.tool_id}`, tool).catch(async () => {
      await tavus("PUT", `/tools/${existing.tool_id}`, tool);
    });
    console.log(`  updated tool ${tool.name} -> ${existing.tool_id}`);
    return existing.tool_id;
  }
}

async function palExists(id: string) {
  if (!id) return false;
  try {
    await tavus("GET", `/pals/${id}`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("1/4  Tools");
  const toolIds: string[] = [];
  for (const tool of TOOLS) toolIds.push(await upsertTool(tool));

  console.log("2/4  Dispatcher PAL");
  let palId = env("TAVUS_PAL_ID");
  const dispatcherBody = {
    pal_name: `${COMPANY.short} Dispatcher (Lead Qualifier)`,
    system_prompt: DISPATCHER_PROMPT,
    context: `Company: ${COMPANY.name}. Service area: Kansas City metro, ZIP codes starting ${COMPANY.serviceZips.join(", ")}. Hours: 24/7 emergency service, office 7am-7pm. Diagnostic visit $${COMPANY.diagnosticFee}, waived with repair. Free install consultations.`,
    pipeline_mode: "full",
    default_face_id: STOCK_FACES.dispatcher.id,
    greeting: DISPATCHER_GREETING,
    layers: {
      conversational_flow: {
        turn_detection_model: "sparrow-2",
        turn_taking_patience: "medium",
        pal_interruptibility: "medium",
      },
    },
  };
  if (await palExists(palId)) {
    console.log(`  reusing ${palId} (updating prompt)`);
    await tavus("PATCH", `/pals/${palId}`, [
      { op: "replace", path: "/system_prompt", value: dispatcherBody.system_prompt },
      { op: "replace", path: "/context", value: dispatcherBody.context },
    ]).catch((e) => console.warn("  (prompt patch skipped)", String(e).slice(0, 160)));
  } else {
    const pal = await tavus<{ pal_id: string }>("POST", "/pals", dispatcherBody);
    palId = pal.pal_id;
    console.log(`  created ${palId}`);
  }

  console.log("3/4  Attach tools");
  await tavus("POST", `/pals/${palId}/tools`, { tool_ids: toolIds });
  const attached = await tavus<any>("GET", `/pals/${palId}/tools`);
  const names = (attached.data ?? attached.tools ?? attached).map((t: any) => t.name);
  console.log(`  attached: ${names.join(", ")}`);

  console.log("4/4  Homeowner PAL (two-agent demo)");
  let homeownerId = env("TAVUS_HOMEOWNER_PAL_ID");
  if (!(await palExists(homeownerId))) {
    const pal = await tavus<{ pal_id: string }>("POST", "/pals", {
      pal_name: "Demo Homeowner (AC died)",
      system_prompt: HOMEOWNER_PROMPT,
      pipeline_mode: "full",
      default_face_id: STOCK_FACES.homeowner.id,
      greeting: HOMEOWNER_GREETING,
      layers: {
        conversational_flow: {
          turn_detection_model: "sparrow-2",
          turn_taking_patience: "medium",
          pal_interruptibility: "low",
        },
      },
    });
    homeownerId = pal.pal_id;
    console.log(`  created ${homeownerId}`);
  } else {
    console.log(`  reusing ${homeownerId}`);
  }

  writeEnvVars({
    TAVUS_PAL_ID: palId,
    TAVUS_FACE_ID: STOCK_FACES.dispatcher.id,
    TAVUS_HOMEOWNER_PAL_ID: homeownerId,
    TAVUS_HOMEOWNER_FACE_ID: STOCK_FACES.homeowner.id,
  });

  console.log(`\nDone. Wrote to .env.local:
  TAVUS_PAL_ID=${palId}
  TAVUS_FACE_ID=${STOCK_FACES.dispatcher.id}
  TAVUS_HOMEOWNER_PAL_ID=${homeownerId}
  TAVUS_HOMEOWNER_FACE_ID=${STOCK_FACES.homeowner.id}`);
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message ?? err);
  process.exit(1);
});
