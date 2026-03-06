import { tabs } from "../../constants/dashboard.js";
import { cx } from "../../lib/cx.js";

export default function TabNav({ currentTab, onChange }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-3 rounded-[24px] border border-white/10 bg-slate-950/55 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cx(
            "rounded-2xl px-5 py-3 text-sm font-semibold tracking-[0.16em] transition duration-200",
            currentTab === tab.id
              ? "bg-cyan-300 text-slate-950 shadow-[0_12px_30px_rgba(103,232,249,0.22)]"
              : "border border-white/10 bg-white/5 text-slate-300 hover:-translate-y-0.5 hover:bg-white/8"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
