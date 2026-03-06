export default function MetricCard({ label, value, subValue }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_32px_90px_rgba(0,0,0,0.40)]">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <strong className="mt-3 block text-3xl font-semibold text-white">{value}</strong>
      {subValue ? <p className="mt-2 text-sm text-slate-400">{subValue}</p> : null}
    </article>
  );
}
