import fs from "node:fs/promises";
import path from "node:path";
import type { Lead } from "./types";

/**
 * Lead storage with two backends:
 *  - DATABASE_URL set  -> Neon Postgres (one JSONB row per conversation)
 *  - otherwise         -> data/leads.json locally, or in-memory on read-only hosts (Vercel)
 */
interface LeadStore {
  list(): Promise<Lead[]>;
  get(id: string): Promise<Lead | undefined>;
  upsert(id: string, patch: Partial<Lead>): Promise<Lead>;
}

function merge(existing: Lead | undefined, id: string, patch: Partial<Lead>): Lead {
  const now = new Date().toISOString();
  return {
    source: "live",
    ...existing,
    ...patch,
    id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  } as Lead;
}

// ---------- file / memory ----------
const FILE = path.join(process.cwd(), "data", "leads.json");
const g = globalThis as unknown as { __leads?: Map<string, Lead>; __leadsLoaded?: boolean; __fileWritable?: boolean };
g.__leads ??= new Map();

async function loadFile() {
  if (g.__leadsLoaded) return;
  g.__leadsLoaded = true;
  try {
    const rows: Lead[] = JSON.parse(await fs.readFile(FILE, "utf8"));
    rows.forEach((l) => g.__leads!.set(l.id, l));
  } catch {
    /* no file yet */
  }
}

async function saveFile() {
  if (g.__fileWritable === false) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify([...g.__leads!.values()], null, 2));
    g.__fileWritable = true;
  } catch {
    g.__fileWritable = false; // read-only filesystem: keep in memory only
  }
}

const fileStore: LeadStore = {
  async list() {
    await loadFile();
    return [...g.__leads!.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async get(id) {
    await loadFile();
    return g.__leads!.get(id);
  },
  async upsert(id, patch) {
    await loadFile();
    const lead = merge(g.__leads!.get(id), id, patch);
    g.__leads!.set(id, lead);
    await saveFile();
    return lead;
  },
};

// ---------- Neon Postgres ----------
function neonStore(url: string): LeadStore {
  let ready: Promise<unknown> | null = null;
  const sqlP = import("@neondatabase/serverless").then(({ neon }) => neon(url));
  const init = async () => {
    const sql = await sqlP;
    ready ??= sql`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`;
    await ready;
    return sql;
  };
  return {
    async list() {
      const sql = await init();
      const rows = await sql`SELECT data FROM leads ORDER BY created_at DESC LIMIT 200`;
      return rows.map((r) => r.data as Lead);
    },
    async get(id) {
      const sql = await init();
      const rows = await sql`SELECT data FROM leads WHERE id = ${id}`;
      return rows[0]?.data as Lead | undefined;
    },
    async upsert(id, patch) {
      const sql = await init();
      const lead = merge(await this.get(id), id, patch);
      await sql`INSERT INTO leads (id, data) VALUES (${id}, ${JSON.stringify(lead)}::jsonb)
                ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      return lead;
    },
  };
}

export const leadStore: LeadStore = process.env.DATABASE_URL ? neonStore(process.env.DATABASE_URL) : fileStore;
