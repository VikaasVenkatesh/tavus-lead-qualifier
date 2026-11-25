import { NextResponse } from "next/server";
import { tavusFetch } from "@/lib/tavus-server";
import { leadStore } from "@/lib/store";

export const runtime = "nodejs";

interface CreatedConversation {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

/**
 * Creates a Tavus conversation server-side so the API key never reaches the browser.
 * Body: { role?: "dispatcher" | "homeowner", demo?: boolean }
 */
export async function POST(req: Request) {
  const { role = "dispatcher", demo = false } = await req.json().catch(() => ({}));
  const isHomeowner = role === "homeowner";
  const pal_id = isHomeowner ? process.env.TAVUS_HOMEOWNER_PAL_ID : process.env.TAVUS_PAL_ID;
  const face_id = isHomeowner ? process.env.TAVUS_HOMEOWNER_FACE_ID : process.env.TAVUS_FACE_ID;

  if (!pal_id) {
    return NextResponse.json(
      { error: `Missing ${isHomeowner ? "TAVUS_HOMEOWNER_PAL_ID" : "TAVUS_PAL_ID"}. Run \`npm run setup\`.` },
      { status: 500 },
    );
  }

  try {
    const convo = await tavusFetch<CreatedConversation>("POST", "/conversations", {
      pal_id,
      ...(face_id ? { face_id } : {}),
      conversation_name: isHomeowner ? "Demo homeowner" : demo ? "Lead qualifier (two-agent demo)" : "Lead qualifier",
      ...(isHomeowner
        ? {}
        : {
            conversational_context: demo
              ? "The caller is on a phone-style video call and may not be visible on camera. Do not comment on their appearance or surroundings."
              : "The visitor clicked 'Talk to our dispatcher' on the website.",
          }),
      properties: {
        max_call_duration: 420,
        participant_left_timeout: 10,
        participant_absent_timeout: 60,
      },
    });

    if (!isHomeowner) {
      await leadStore.upsert(convo.conversation_id, { source: demo ? "demo" : "live" });
    }

    return NextResponse.json({ conversation_id: convo.conversation_id, conversation_url: convo.conversation_url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
