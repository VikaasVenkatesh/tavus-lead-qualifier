import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Dev-only: saves a tab recording of the two-agent demo to ./recordings. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "disabled" }, { status: 404 });
  const buf = Buffer.from(await req.arrayBuffer());
  const dir = path.join(process.cwd(), "recordings");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `demo-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`);
  await fs.writeFile(file, buf);
  return NextResponse.json({ file, bytes: buf.length });
}
