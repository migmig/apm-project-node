import { cx } from "../../lib/cx.js";

export default function StatusBadge({ tone = "neutral", children }) {
  const tones = {
    positive: "bg-emerald-400 text-emerald-950 shadow-[0_0_12px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400/50",
    negative: "bg-rose-400 text-rose-950 shadow-[0_0_12px_rgba(251,113,133,0.3)] ring-1 ring-rose-400/50",
    neutral: "border border-white/10 bg-white/5 text-slate-300"
  };

  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
