import { NextResponse } from "next/server";
import { leadStore } from "@/lib/store";
import { scoreLead } from "@/lib/scoring";
import { bookSlot } from "@/lib/calendar";
import { TOOL_NAMES } from "@/lib/tavus-config";
import type { QualifyArgs } from "@/lib/types";

export const runtime = "nodejs";

/**
 * The browser receives conversation.tool_call app messages from Tavus and forwards
 * them here. We run the tool, persist the lead, and return `output`, which the
 * browser sends back to Tavus as conversation.tool_result (same tool_call_id).
 */
export async function POST(req: Request) {
  const { conversation_id, name, args } = (await req.json().catch(() => ({}))) as {
    conversation_id?: string;
    name?: string;
    args?: Record<string, string>;
  };
  if (!conversation_id || !name || !args) {
    return NextResponse.json({ error: "conversation_id, name and args are required" }, { status: 400 });
  }

  switch (name) {
    case TOOL_NAMES.qualify: {
      const a = args as unknown as QualifyArgs;
      const qualification = scoreLead(a);
      const lead = await leadStore.upsert(conversation_id, { ...a, qualification });
      const output = qualification.in_service_area
        ? `Lead score: ${qualification.score.toUpperCase()} (${qualification.reason}) Priority: ${qualification.priority}. They are in our service area. Next, offer to book a visit.`
        : `Lead score: COLD. ${qualification.reason} Politely explain we can't service that area and offer our office number for a referral.`;
      return NextResponse.json({ output, lead });
    }
    case TOOL_NAMES.book: {
      const booking = await bookSlot({
        name: args.name ?? "",
        contact: args.contact ?? "",
        preferred_time: args.preferred_time ?? "",
      });
      const lead = await leadStore.upsert(conversation_id, {
        booking,
        ...(args.name ? { name: args.name } : {}),
        ...(args.contact ? { contact: args.contact } : {}),
      });
      const output = `Booked. Confirmation ${booking.confirmation}: ${booking.slot_label} with technician ${booking.technician}. A text confirmation will go to ${args.contact}. Read the day and time window back to the caller.`;
      return NextResponse.json({ output, lead });
    }
    case TOOL_NAMES.summary: {
      const lead = await leadStore.upsert(conversation_id, {
        call_summary: { summary: args.summary ?? "", next_step: args.next_step ?? "" },
      });
      return NextResponse.json({ output: "Logged.", lead });
    }
    default:
      return NextResponse.json({ error: `Unknown tool ${name}` }, { status: 400 });
  }
}
