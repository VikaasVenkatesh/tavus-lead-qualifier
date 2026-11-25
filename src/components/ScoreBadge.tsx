import type { Score } from "@/lib/types";

const STYLES: Record<Score, string> = {
  hot: "bg-brass text-white",
  warm: "bg-amber-100 text-amber-800",
  cold: "bg-slate-100 text-slate-600",
};

export function ScoreBadge({ score }: { score: Score }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider animate-pop ${STYLES[score]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${score === "hot" ? "bg-white" : score === "warm" ? "bg-amber-500" : "bg-slate-400"}`} />
      {score}
    </span>
  );
}
