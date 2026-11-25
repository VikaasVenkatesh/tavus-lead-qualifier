import { NextResponse } from "next/server";
import { tavusFetch } from "@/lib/tavus-server";

export const runtime = "nodejs";

/** Ends a conversation so it stops billing as soon as the visitor hangs up. */
export async function POST(req: Request) {
  const { conversation_id } = await req.json().catch(() => ({}));
  if (!conversation_id || !/^c[a-z0-9]+$/i.test(conversation_id)) {
    return NextResponse.json({ error: "conversation_id required" }, { status: 400 });
  }
  try {
    await tavusFetch("POST", `/conversations/${conversation_id}/end`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
