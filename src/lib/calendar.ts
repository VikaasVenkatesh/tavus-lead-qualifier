import type { Booking } from "./types";

const TECHS = ["Marcus Reed", "Dee Walker", "Javier Ponce"];
const WINDOWS = [
  { label: "8:00–10:00 AM", hour: 8 },
  { label: "10:00 AM–12:00 PM", hour: 10 },
  { label: "1:00–3:00 PM", hour: 13 },
  { label: "3:00–5:00 PM", hour: 15 },
];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Turn "tomorrow morning" / "friday after 3" into a concrete window.
 * This is a mock. To use a real calendar, replace the body with a Google Calendar
 * freebusy query + events.insert (see bookWithGoogleCalendar below) and keep the return shape.
 */
type BookingInput = { name: string; contact: string; preferred_time: string };

export async function bookSlot(input: BookingInput): Promise<Booking> {
  if (process.env.GOOGLE_CALENDAR_ID) return bookWithGoogleCalendar(input);
  return mockSlot(input);
}

function mockSlot(input: BookingInput): Booking {
  const pref = (input.preferred_time || "").toLowerCase();
  const tz = "America/Chicago";
  const now = new Date();
  const day = new Date(now);
  day.setDate(day.getDate() + 1); // default: next day

  if (/today|asap|right away|now/.test(pref)) day.setDate(now.getDate());
  const named = DAYS.findIndex((d) => pref.includes(d));
  if (named >= 0) {
    const diff = (named - now.getDay() + 7) % 7 || 7;
    day.setDate(now.getDate() + diff);
  }
  if (day.getDay() === 0) day.setDate(day.getDate() + 1); // no Sundays

  let w = WINDOWS[0];
  if (/afternoon|after (1|2|3|4)|pm/.test(pref)) w = /after (3|4)|late/.test(pref) ? WINDOWS[3] : WINDOWS[2];
  else if (/late morning|after (9|10)|noon/.test(pref)) w = WINDOWS[1];
  if (/today|asap|right away|now/.test(pref)) {
    // Next window that hasn't started yet (KC time); otherwise first thing tomorrow.
    const hourKC = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }));
    const next = WINDOWS.find((x) => x.hour > hourKC);
    if (next) w = next;
    else {
      w = WINDOWS[0];
      day.setDate(now.getDate() + 1);
    }
  }
  day.setHours(w.hour, 0, 0, 0);
  const dateLabel = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const code = Math.random().toString(36).slice(2, 6).toUpperCase();

  return {
    confirmation: `PA-${code}`,
    slot_label: `${dateLabel} · ${w.label}`,
    slot_start: day.toISOString(),
    technician: TECHS[Math.floor(Math.random() * TECHS.length)],
    preferred_time: input.preferred_time,
    calendar: "mock",
  };
}

/** Stub: where a real Google Calendar booking would go (service account + calendar ID). */
async function bookWithGoogleCalendar(input: BookingInput): Promise<Booking> {
  // 1. calendar.freebusy.query({ timeMin, timeMax, items: [{ id: process.env.GOOGLE_CALENDAR_ID }] })
  // 2. pick the first free 2h window that matches input.preferred_time
  // 3. calendar.events.insert({ calendarId, requestBody: { summary: `Service call: ${input.name}`, description: input.contact, start, end } })
  return { ...mockSlot(input), calendar: "google" };
}
