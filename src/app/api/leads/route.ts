import { NextResponse } from "next/server";
import { leadStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ leads: await leadStore.list() });
}
