export type Score = "hot" | "warm" | "cold";

export interface QualifyArgs {
  service_type: string;
  urgency: string;
  zip: string;
  home_type: string;
  timeline?: string;
  name: string;
  contact: string;
}

export interface Qualification {
  score: Score;
  reason: string;
  in_service_area: boolean;
  priority: string;
}

export interface Booking {
  confirmation: string;
  slot_label: string; // "Tue, Nov 25 · 8:00–10:00 AM"
  slot_start: string; // ISO
  technician: string;
  preferred_time: string;
  calendar: "mock" | "google";
}

export interface CallSummary {
  summary: string;
  next_step: string;
}

export interface Lead extends Partial<QualifyArgs> {
  id: string; // conversation_id
  created_at: string;
  updated_at: string;
  source: "live" | "demo";
  qualification?: Qualification;
  booking?: Booking;
  call_summary?: CallSummary;
}
