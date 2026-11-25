"use client";

import { COMPANY, STOCK_FACES } from "@/lib/tavus-config";

const PREVIEW_VIDEO = "https://cdn.replica.tavus.io/61338/198f094f.mp4";
const PREVIEW_POSTER = "https://cdn.replica.tavus.io/61338/thumbnail.jpg";

export function Hero({ onStart, onDemo, demoAvailable }: { onStart: () => void; onDemo: () => void; demoAvailable: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-[1320px] items-center gap-10 px-4 pb-16 pt-8 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-14">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Dispatch is live · 24/7 emergency service
          </p>
          <h1 className="font-display text-[clamp(2.4rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-ink">
            No heat? No AC?
            <br />
            <span className="text-brass">Talk to a dispatcher, face to face.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-body">
            {STOCK_FACES.dispatcher.name} picks up instantly, figures out what&rsquo;s wrong, checks that you&rsquo;re in our Kansas City service area, and books a
            technician before you hang up. No hold music, no phone tree.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onStart} className="btn-primary btn-lg group">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              Talk to our dispatcher
            </button>
            {demoAvailable && (
              <button onClick={onDemo} className="btn-ghost btn-lg">
                Watch an AI homeowner call in
              </button>
            )}
          </div>
          <p className="mt-4 text-sm text-muted">Uses your camera and mic. Calls are capped at 7 minutes.</p>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              ["< 2 min", "to qualified & booked"],
              ["3 tools", "score · book · log"],
              ["0", "API keys in the browser"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-display text-2xl font-semibold text-ink">{k}</dt>
                <dd className="mt-1 text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_70%_30%,rgba(196,71,10,0.18),transparent_70%)]" />
          <div className="relative overflow-hidden rounded-[1.75rem] bg-pine-deep shadow-[0_40px_80px_-30px_rgba(6,27,45,0.65)]">
            <video src={PREVIEW_VIDEO} poster={PREVIEW_POSTER} autoPlay muted loop playsInline className="aspect-[4/3] w-full object-cover opacity-95" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-pine-deep/95 via-pine-deep/50 to-transparent p-5 pt-16">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-display text-xl font-semibold text-white">{STOCK_FACES.dispatcher.name}</p>
                  <p className="text-sm text-white/70">Dispatcher at {COMPANY.short} · AI human by Tavus</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white/80 backdrop-blur">Available now</span>
              </div>
            </div>
          </div>

          {/* floating lead card preview */}
          <div className="absolute -left-4 top-8 hidden w-64 rounded-2xl border border-line bg-white p-4 shadow-xl md:block lg:-left-10">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Lead record</p>
              <span className="rounded-full bg-brass px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">Hot</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">AC repair · Emergency</p>
            <p className="text-sm text-muted">ZIP 66212 · Single-family</p>
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Booked: tomorrow 8–10 AM</div>
          </div>
        </div>
      </div>
    </section>
  );
}
