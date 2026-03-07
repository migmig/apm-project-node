import { useState, useRef, useMemo } from "react";
import { formatNumber } from "../lib/format.js";

export default function Sparkline({ points }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

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

  const pointsData = useMemo(() => {
    return points.map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((Number(point.value) - min) / range) * (height - 16) - 8;
      return { x, y, value: point.value, timestamp: point.timestamp };
    });
  }, [points, min, range]);

  const polyline = pointsData.map((p) => `${p.x},${p.y}`).join(" ");

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;

    // Convert client X to SVG viewBox X
    const svgX = (mouseX / svgRect.width) * width;

    // Find closest point by X coordinate
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < pointsData.length; i++) {
      const diff = Math.abs(pointsData[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }

    setHoverIndex(closestIndex);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    // return hh:mm:ss format
    return date.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const activePoint = hoverIndex !== null ? pointsData[hoverIndex] : null;

  return (
    <div className="relative mt-4 h-36 w-full" onMouseLeave={handleMouseLeave}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-300 transition-opacity duration-200"
          opacity={hoverIndex !== null ? 0.5 : 1}
        />

        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              y1="0"
              x2={activePoint.x}
              y2={height}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="4"
              fill="#06b6d4" // cyan-500
              stroke="#fff"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {activePoint && (
        <div
          className="pointer-events-none absolute top-[-10px] z-10 flex -translate-x-1/2 flex-col items-center rounded-lg bg-slate-900/95 border border-slate-700/50 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-md"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
          }}
        >
          <span className="mb-1 font-mono text-cyan-300">
            {formatNumber(activePoint.value)}
          </span>
          <span className="text-slate-400">
            {formatDate(activePoint.timestamp)}
          </span>
        </div>
      )}
    </div>
  );
}
