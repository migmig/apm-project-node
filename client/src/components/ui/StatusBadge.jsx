import { cx } from "../../lib/cx.js";

export default function StatusBadge({ tone = "neutral", children }) {
  const tones = {
    positive: "bg-emerald-300 text-emerald-950",
    negative: "bg-rose-300 text-rose-950",
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
