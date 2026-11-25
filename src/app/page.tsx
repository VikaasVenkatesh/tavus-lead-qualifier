import { Experience } from "@/components/Experience";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Tell Mateo what's going on",
    body: "No heat, AC on the fritz, a new system, or a tune-up. He asks one short question at a time, like a real dispatcher.",
  },
  {
    n: "02",
    title: "Qualified while you talk",
    body: "When he has the details, the PAL calls qualify_lead. Your browser scores it (hot, warm, cold) and the answer shapes what he says next.",
  },
  {
    n: "03",
    title: "Booked before you hang up",
    body: "book_consultation returns a confirmed window, and log_call_summary writes the CRM note. Every lead lands on the Leads page.",
  },
];

export default function Home() {
  const demoAvailable = Boolean(process.env.TAVUS_HOMEOWNER_PAL_ID);
  return (
    <>
      <Experience demoAvailable={demoAvailable} />
      <section className="mx-auto w-full max-w-[1320px] px-4 pb-16 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <article key={s.n} className="rounded-2xl border border-line bg-white p-6">
              <p className="font-mono text-xs text-brass">{s.n}</p>
              <h2 className="mt-3 font-display text-xl font-semibold text-ink">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-body">{s.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
