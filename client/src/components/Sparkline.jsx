export default function Sparkline({ points }) {
  if (!points?.length) {
    return (
      <div className="mt-4 grid h-36 place-items-center rounded-2xl border border-white/10 border-dashed bg-white/3 text-sm text-slate-400">
        no data
      </div>
    );
  }

  const width = 320;
  const height = 144;
  const values = points.map((point) => Number(point.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const polyline = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((Number(point.value) - min) / range) * (height - 16) - 8;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-4 h-36 w-full">
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-cyan-300"
      />
    </svg>
  );
}
