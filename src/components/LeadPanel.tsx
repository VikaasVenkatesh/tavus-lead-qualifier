"use client";

import { TOOL_NAMES } from "@/lib/tavus-config";
import { serviceLabel } from "@/lib/scoring";
import type { Lead } from "@/lib/types";
import { ScoreBadge } from "./ScoreBadge";

export interface FeedItem {
  id: string;
  t: number;
  kind: "tool_call" | "tool_result" | "info" | "error";
  name: string;
  detail: unknown;
}

const URGENCY: Record<string, string> = { emergency: "Emergency", soon: "This week", routine: "Routine" };

export function LeadPanel({
  lead,
  pending,
  feed,
  live,
}: {
  lead: Partial<Lead>;
  pending: Record<string, boolean>;
  feed: FeedItem[];
  live: boolean;
}) {
  const q = lead.qualification;
  const fields: [string, string | undefined][] = [
    ["Name", lead.name],
    ["Contact", lead.contact],
    ["Service", lead.service_type ? serviceLabel(lead.service_type) : undefined],
    ["Urgency", lead.urgency ? URGENCY[lead.urgency] ?? lead.urgency : undefined],
    ["ZIP", lead.zip],
    ["Home", lead.home_type],
    ["Timeline", lead.timeline],
  ];

  return (
    <aside className="flex flex-col gap-4">
      {/* Lead card */}
      <section className="card">
        <header className="card-head">
          <div>
            <p className="eyebrow">Lead record</p>
            <h3 className="font-display text-lg font-semibold text-ink">{lead.name || "New caller"}</h3>
          </div>
          {q ? (
            <ScoreBadge score={q.score} />
          ) : (
            <span className="rounded-full border border-dashed border-line px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
              {pending[TOOL_NAMES.qualify] ? "Scoring…" : live ? "Listening" : "Unscored"}
            </span>
          )}
        </header>
        {q && (
          <div className="mx-4 mb-1 rounded-lg bg-ivory px-3 py-2 text-sm text-body animate-in">
            <span className="font-semibold text-ink">{q.priority}.</span> {q.reason}
          </div>
        )}
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 px-4 py-3 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 truncate text-ink">
                {v ? <span className="animate-in">{v}</span> : <span className="inline-block h-3.5 w-24 rounded bg-ivory align-middle" />}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Booking */}
      <section className={`card ${lead.booking ? "ring-1 ring-emerald-300" : ""}`}>
        <header className="card-head">
          <div>
            <p className="eyebrow">Booking</p>
            <h3 className="font-display text-lg font-semibold text-ink">
              {lead.booking ? lead.booking.slot_label : pending[TOOL_NAMES.book] ? "Checking schedule…" : "Not booked yet"}
            </h3>
          </div>
          {lead.booking && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-emerald-700">Confirmed</span>
          )}
        </header>
        {lead.booking && (
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 px-4 pb-4 text-sm animate-in">
            <dt className="text-muted">Confirm #</dt>
            <dd className="font-mono text-ink">{lead.booking.confirmation}</dd>
            <dt className="text-muted">Tech</dt>
            <dd className="text-ink">{lead.booking.technician}</dd>
            <dt className="text-muted">Asked for</dt>
            <dd className="text-ink">&ldquo;{lead.booking.preferred_time}&rdquo;</dd>
          </dl>
        )}
      </section>

      {/* Summary */}
      <section className="card">
        <header className="card-head">
          <div>
            <p className="eyebrow">Call summary</p>
            <h3 className="font-display text-lg font-semibold text-ink">{lead.call_summary ? "Logged to CRM" : "Written at the end of the call"}</h3>
          </div>
        </header>
        {lead.call_summary && (
          <div className="space-y-2 px-4 pb-4 text-sm animate-in">
            <p className="text-body">{lead.call_summary.summary}</p>
            <p className="rounded-lg bg-pine-tint px-3 py-2 text-pine">
              <span className="font-semibold">Next step:</span> {lead.call_summary.next_step}
            </p>
          </div>
        )}
      </section>

      {/* Event stream */}
      <section className="overflow-hidden rounded-2xl bg-pine-deep text-white/90">
        <header className="flex items-center justify-between px-4 py-2.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">Tool calls · app messages</p>
          <span className="font-mono text-[11px] text-white/40">{feed.filter((f) => f.kind === "tool_call").length} calls</span>
        </header>
        <ol className="max-h-56 space-y-1.5 overflow-y-auto px-4 pb-4 font-mono text-[11.5px] leading-relaxed">
          {feed.length === 0 && <li className="text-white/40">Waiting for the PAL to call a tool…</li>}
          {feed.map((f) => (
            <li key={f.id} className="animate-in">
              <span className={f.kind === "tool_call" ? "text-amber-300" : f.kind === "tool_result" ? "text-emerald-300" : f.kind === "error" ? "text-red-300" : "text-white/50"}>
                {f.kind === "tool_call" ? "← tool_call" : f.kind === "tool_result" ? "→ tool_result" : f.kind === "error" ? "✕ error" : "•"}
              </span>{" "}
              <span className="text-white">{f.name}</span>{" "}
              <span className="break-words text-white/55">{typeof f.detail === "string" ? f.detail : JSON.stringify(f.detail)}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
