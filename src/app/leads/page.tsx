import Link from "next/link";
import { leadStore } from "@/lib/store";
import { serviceLabel } from "@/lib/scoring";
import { ScoreBadge } from "@/components/ScoreBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads | Spearflow Lead Qualifier" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function LeadsPage() {
  const leads = (await leadStore.list()).filter((l) => l.qualification || l.name || l.booking);
  const hot = leads.filter((l) => l.qualification?.score === "hot").length;
  const booked = leads.filter((l) => l.booking).length;

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Captured by the AI dispatcher</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">Leads</h1>
        </div>
        <dl className="flex gap-8">
          {[
            ["Leads", leads.length],
            ["Hot", hot],
            ["Booked", booked],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow">{k}</dt>
              <dd className="font-display text-3xl font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {leads.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <p className="font-display text-xl text-ink">No leads yet.</p>
          <p className="mt-2 text-muted">Start a call and the dispatcher will log one here.</p>
          <Link href="/" className="btn-primary mt-6">Talk to the dispatcher</Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-ivory/60">
              <tr className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                {["Caller", "Score", "Need", "ZIP / Home", "Booking", "Next step", "When"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink">{l.name ?? "Unknown caller"}</p>
                    <p className="text-muted">{l.contact}</p>
                    {l.source === "demo" && <span className="mt-1 inline-block rounded bg-pine-tint px-1.5 py-0.5 font-mono text-[10px] uppercase text-pine">AI-to-AI demo</span>}
                  </td>
                  <td className="px-4 py-4">
                    {l.qualification ? (
                      <div className="space-y-1.5">
                        <ScoreBadge score={l.qualification.score} />
                        <p className="max-w-[220px] text-xs text-muted">{l.qualification.reason}</p>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-ink">
                    {serviceLabel(l.service_type)}
                    <p className="text-muted capitalize">{l.urgency}</p>
                  </td>
                  <td className="px-4 py-4 text-ink">
                    {l.zip ?? "—"}
                    <p className="text-muted">{l.home_type}</p>
                  </td>
                  <td className="px-4 py-4">
                    {l.booking ? (
                      <>
                        <p className="text-ink">{l.booking.slot_label}</p>
                        <p className="font-mono text-xs text-muted">{l.booking.confirmation} · {l.booking.technician}</p>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-[280px] px-4 py-4 text-body">{l.call_summary?.next_step ?? <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted">{fmt(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
