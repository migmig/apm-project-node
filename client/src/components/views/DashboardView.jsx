import { dashboardCharts } from "../../constants/dashboard.js";
import { formatNumber } from "../../lib/format.js";
import ChartCard from "../ui/ChartCard.jsx";
import MetricCard from "../ui/MetricCard.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Table from "../ui/Table.jsx";

export default function DashboardView({
  apps,
  currentApp,
  dashboard,
  overviewCards,
  onOpenApis,
  onOpenTraces,
  onOpenTrace
}) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} subValue={card.subValue} />
        ))}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Applications</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">요약 앱 현황</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) => (
            <article key={app.appName} className="rounded-[24px] border border-white/10 bg-white/4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{app.appName}</h3>
                  <p className="mt-2 text-sm text-slate-400">{app.host || "-"}</p>
                </div>
                <StatusBadge tone={app.online ? "positive" : "negative"}>{app.online ? "online" : "idle"}</StatusBadge>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Req/slice</dt>
                  <dd className="mt-1 font-semibold text-white">{formatNumber(app.stats.requestRate, 0)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Latency</dt>
                  <dd className="mt-1 font-semibold text-white">{formatNumber(app.stats.avgLatencyMs)} ms</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Error</dt>
                  <dd className="mt-1 font-semibold text-white">{formatNumber(app.stats.errorRate)}%</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onOpenApis(app.appName)}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Open APIs
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTraces(app.appName)}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Open Traces
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Signals</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">앱별 핵심 추이</h2>
          </div>
          <p className="text-sm text-slate-400">{currentApp ? `${currentApp.appName} selected` : "no app selected"}</p>
        </div>
        {currentApp ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {dashboardCharts.map((chart) => {
              const points = currentApp.charts?.[chart.key] || [];
              return (
                <ChartCard
                  key={chart.key}
                  title={chart.label}
                  value={points.at(-1)?.value ?? null}
                  unit={chart.unit}
                  points={points}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-white/3 p-8 text-center text-slate-400">
            no metrics yet
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Recent Traces</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">최근 수집 Trace</h2>
        </div>
        <Table
          columns={["App", "Trace ID", "API", "Duration", "Status"]}
          emptyLabel="no trace data"
          rows={(dashboard?.recentTraces || []).map((trace) => (
            <tr
              key={trace.traceId}
              onClick={() => onOpenTrace(trace.traceId)}
              className="cursor-pointer transition hover:bg-white/5"
            >
              <td className="px-4 py-3">{trace.appName}</td>
              <td className="px-4 py-3 font-mono text-cyan-200">{trace.traceId.slice(0, 12)}</td>
              <td className="px-4 py-3">{trace.uri || trace.rootSpanName}</td>
              <td className="px-4 py-3">{formatNumber(trace.durationMs)} ms</td>
              <td className="px-4 py-3">
                <StatusBadge tone={trace.error ? "negative" : "positive"}>{trace.error ? "error" : "ok"}</StatusBadge>
              </td>
            </tr>
          ))}
        />
      </section>
    </>
  );
}
