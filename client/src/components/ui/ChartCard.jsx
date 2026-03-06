import Sparkline from "../Sparkline.jsx";
import { formatNumber } from "../../lib/format.js";

export default function ChartCard({ title, value, unit, points }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_32px_90px_rgba(0,0,0,0.40)]">
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm text-slate-400">{title}</span>
        <strong className="text-lg font-semibold text-white">
          {value !== null && value !== undefined ? `${formatNumber(value)} ${unit}` : "-"}
        </strong>
      </div>
      <Sparkline points={points} />
    </article>
  );
}
