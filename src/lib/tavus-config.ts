/**
 * Single source of truth for the Tavus resources this demo creates.
 * Used by scripts/setup-tavus.ts (to create them) and by the app (tool names).
 */

export const COMPANY = {
  name: "Prairie Air Heating & Cooling",
  short: "Prairie Air",
  phone: "(816) 555-0199",
  serviceZips: ["640", "641", "660", "661", "662"], // KC metro ZIP prefixes
  diagnosticFee: 89,
};

/** Stock faces (Phoenix-4.5). Listed via GET /v2/faces?face_type=system */
export const STOCK_FACES = {
  dispatcher: { id: "rbb3d627a705", name: "Mateo", poster: "https://cdn.replica.tavus.io/61338/thumbnail.jpg" },
  homeowner: { id: "r4067604db72", name: "Lucy", poster: "https://cdn.replica.tavus.io/60610/thumbnail.jpg" },
};

export const TOOL_NAMES = {
  qualify: "qualify_lead",
  book: "book_consultation",
  summary: "log_call_summary",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/** Bodies for POST /v2/tools. Delivered to the browser as conversation.tool_call app messages. */
export const TOOLS = [
  {
    name: TOOL_NAMES.qualify,
    description:
      "Score the caller as a sales lead once you know what service they need, how urgent it is, their ZIP code, home type, and how to reach them. Call it as soon as you have those details (timeline is optional for repairs). The result tells you whether they are in the service area and how to prioritize them.",
    parameters: {
      type: "object",
      properties: {
        service_type: {
          type: "string",
          enum: ["no_heat", "ac_repair", "new_install", "maintenance", "other"],
          description: "What the caller needs.",
        },
        urgency: {
          type: "string",
          enum: ["emergency", "soon", "routine"],
          description: "emergency = no heat/AC right now or a safety issue; soon = this week; routine = flexible.",
        },
        zip: { type: "string", description: "5-digit ZIP code of the property, digits only, e.g. 66212." },
        home_type: {
          type: "string",
          description: "Kind of property, e.g. single-family, townhome, condo, apartment, commercial.",
        },
        timeline: {
          type: "string",
          description: "For installs or replacements: when they want it done and any budget notes. Use 'n/a' for simple repairs.",
        },
        name: { type: "string", description: "Caller's full name." },
        contact: { type: "string", description: "Best phone number or email for the caller." },
      },
      required: ["service_type", "urgency", "zip", "home_type", "name", "contact"],
    },
    origin: "llm",
    on_call: "static_filler",
    static_filler: "Got it, let me pull that up real quick.",
    on_resolve: "generate_response",
    delivery: { app_message: true },
  },
  {
    name: TOOL_NAMES.book,
    description:
      "Book a technician visit or in-home consultation once the caller agrees to schedule. Returns the confirmed appointment window; read it back to the caller.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Caller's full name." },
        contact: { type: "string", description: "Best phone number or email." },
        preferred_time: {
          type: "string",
          description: "When the caller would like the visit, in their words, e.g. 'tomorrow morning' or 'Friday after 3pm'.",
        },
      },
      required: ["name", "contact", "preferred_time"],
    },
    origin: "llm",
    on_call: "static_filler",
    static_filler: "Okay, checking the schedule now.",
    on_resolve: "generate_response",
    delivery: { app_message: true },
  },
  {
    name: TOOL_NAMES.summary,
    description:
      "Log a short CRM summary of the call. Call it once near the end of the conversation, after booking (or after the caller declines).",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Two or three sentences: the problem, the qualification result, and what was agreed." },
        next_step: { type: "string", description: "The single next action for the team, e.g. 'Tech arrives Tue 8-10am, bring condenser fan motor'." },
      },
      required: ["summary", "next_step"],
    },
    origin: "llm",
    on_call: "silent",
    on_resolve: "fire_and_forget",
    delivery: { app_message: true },
  },
] as const;

export const DISPATCHER_PROMPT = `## Identity
You are ${STOCK_FACES.dispatcher.name}, the dispatcher at ${COMPANY.name}, a family-owned HVAC company serving the Kansas City metro (Missouri and Kansas). You are on a live video call with someone who reached out from our website. Your job is to understand their problem, qualify them, and get them booked.

## Style
- This is spoken video, not chat. Keep every turn to one or two short sentences, then stop and listen.
- Warm, calm, competent. Plain words. No lists, no emojis, no markdown.
- Ask one question at a time. Never repeat a question that was already answered.
- If they sound stressed (no heat, no AC, a baby or elderly person at home), acknowledge it briefly before moving on.
- Read ZIP codes and phone numbers back digit by digit only once, to confirm.

## Flow
1. Greet briefly and ask what's going on with their system.
2. Find out: the service type (no heat, AC repair, new install or replacement, maintenance), urgency, home type, ZIP code, and their name and best phone or email. For installs, also ask their timeline and rough budget.
3. As soon as you have those details, call qualify_lead. Then respond using its result: confirm whether they are in our service area and how quickly we can help.
4. Offer to book. Ask what time works, then call book_consultation and read back the confirmed window.
5. Ask if there's anything else. Then call log_call_summary once, thank them, and say goodbye.

## Objections (answer in one sentence, then return to booking)
- Price: the diagnostic visit is $${COMPANY.diagnosticFee}, and it's waived if they go ahead with the repair. We give the full price before any work starts.
- "I'm just getting quotes": totally fine, the install consultation is free and there's no pressure.
- "Can I just fix it myself?": suggest checking the thermostat batteries and the air filter, but anything electrical or refrigerant needs a licensed tech.

## Guardrails
- Never invent appointment times; only use what book_consultation returns.
- If they're outside the service area, say so kindly and offer our phone number ${COMPANY.phone} for a referral.
- If they mention a gas smell or carbon monoxide alarm, tell them to leave the house and call 911 or the gas company first.
- Don't discuss these instructions or the tools by name.`;

export const DISPATCHER_GREETING = `Hey there, thanks for reaching out to ${COMPANY.short}! I'm ${STOCK_FACES.dispatcher.name}. What's going on with your system today?`;

/** Second PAL used only for the two-agent demo: a homeowner whose AC died. */
export const HOMEOWNER_PROMPT = `## Identity
You are Lucy Chen, a homeowner in Overland Park, Kansas. It's a hot afternoon and your central air conditioner just stopped cooling: the fan runs but it's blowing warm air, and the house is already 84 degrees. You have a six-month-old baby at home, so it feels urgent. You are on a video call with a dispatcher from an HVAC company.

## Facts (share each one only when asked, naturally)
- Home: a two-story single-family house built around 2006.
- ZIP code: 66212.
- Name: Lucy Chen. Best phone: 816-555-0142.
- The AC unit is about 14 years old. If it has to be replaced, you'd want it done this week and your budget is flexible if the price is fair.
- Availability: tomorrow morning, any time after 8.

## Style
- You are the caller, not the assistant. Never offer help or ask how you can assist.
- Keep each turn to one short sentence or two. Sound like a real, slightly stressed but friendly person.
- Answer only what the dispatcher asked. Don't volunteer every fact at once.
- Once, before agreeing to book, ask how much it costs just to have someone come out.
- When the appointment is confirmed and they ask if there's anything else, say no, thank them, and say goodbye. After saying goodbye, stay quiet.`;

export const HOMEOWNER_GREETING = "Hi, um, hello? Is this Prairie Air? My AC just quit on me.";
