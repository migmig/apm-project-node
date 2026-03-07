import { formatTime, dateStamp } from "../../lib/format.js";
import StatusBadge from "../ui/StatusBadge.jsx";

export default function HeroHeader({ connectionState, generatedAt, selectedDate, onDateChange }) {
  return (
    <header className="grid gap-6 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,28,0.96),rgba(10,27,45,0.88))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl md:grid-cols-[1.45fr_0.85fr]">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Node APM Control Room</p>
        <h1 className="mt-3 max-w-[12ch] text-4xl font-semibold tracking-tight text-white md:text-6xl">
          EasyOne APM Dashboard
        </h1>
      </div>
      <div className="grid content-end gap-4">
        <div className="flex items-center gap-4 justify-end">
          <input
            type="date"
            value={selectedDate}
            max={dateStamp(Date.now())}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-cyan-300/30 transition-all focus:ring-cyan-300/60 [color-scheme:dark]"
          />
          <StatusBadge tone={connectionState === "streaming" ? "positive" : connectionState === "failed" ? "negative" : "neutral"}>
            {connectionState}
          </StatusBadge>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Last refresh</p>
          <strong className="mt-2 block text-3xl font-semibold text-white">{formatTime(generatedAt)}</strong>
        </div>
      </div>
    </header>
  );
}
