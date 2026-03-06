import { apiCharts } from "../../constants/dashboard.js";
import { formatNumber, formatTime } from "../../lib/format.js";
import ChartCard from "../ui/ChartCard.jsx";
import MetricCard from "../ui/MetricCard.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Table from "../ui/Table.jsx";

export default function ApisView({
  apps,
  currentApp,
  selectedApiDetail,
  onSelectApp,
  onResetDetail,
  onOpenApi,
  onOpenTrace
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">API Monitor</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">URI별 상세 화면</h2>
        </div>
        <label className="grid gap-2 text-sm text-slate-400">
          <span>Application</span>
          <select
            value={currentApp?.appName || ""}
            onChange={(event) => {
              onSelectApp(event.target.value);
              if (selectedApiDetail?.appName !== event.target.value) {
                onResetDetail();
              }
            }}
            className="min-w-[240px] rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none ring-0"
          >
            {apps.map((app) => (
              <option key={app.appName} value={app.appName} className="bg-slate-900">
                {app.appName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Top APIs</h3>
            <p className="text-sm text-slate-400">{currentApp?.appName || "-"}</p>
          </div>
          <Table
            columns={["URI", "Requests", "Errors", "Avg ms"]}
            emptyLabel="no api metrics"
            rows={(currentApp?.uriStats || []).map((row) => (
              <tr
                key={row.uri}
                onClick={() => onOpenApi(currentApp.appName, row.uri)}
                className="cursor-pointer transition hover:bg-white/5"
              >
                <td className="px-4 py-3">{row.uri}</td>
                <td className="px-4 py-3">{formatNumber(row.totalCount, 0)}</td>
                <td className="px-4 py-3">{formatNumber(row.errorCount, 0)}</td>
                <td className="px-4 py-3">{formatNumber(row.avgDuration)}</td>
              </tr>
            ))}
          />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
          {selectedApiDetail && selectedApiDetail.appName === currentApp?.appName ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">API Detail</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{selectedApiDetail.uri}</h3>
                </div>
                <p className="text-sm text-slate-400">updated {formatTime(selectedApiDetail.stats.lastUpdatedAt)}</p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <MetricCard label="Total Requests" value={formatNumber(selectedApiDetail.stats.totalCount, 0)} />
                <MetricCard label="Error Count" value={formatNumber(selectedApiDetail.stats.errorCount, 0)} />
                <MetricCard label="Avg Duration" value={`${formatNumber(selectedApiDetail.stats.avgDuration)} ms`} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {apiCharts.map((chart) => {
                  const points = selectedApiDetail.charts?.[chart.key] || [];
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

              <Table
                columns={["Trace ID", "Duration", "Status", "SQL"]}
                emptyLabel="no traces for this api"
                rows={(selectedApiDetail.traces || []).map((trace) => (
                  <tr
                    key={trace.traceId}
                    onClick={() => onOpenTrace(trace.traceId)}
                    className="cursor-pointer transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-mono text-cyan-200">{trace.traceId.slice(0, 12)}</td>
                    <td className="px-4 py-3">{formatNumber(trace.durationMs)} ms</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={trace.error ? "negative" : "positive"}>{trace.error ? "error" : "ok"}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">{trace.sqlStatements[0] || "-"}</td>
                  </tr>
                ))}
              />
            </>
          ) : (
            <div className="grid h-full min-h-[420px] place-items-center rounded-[22px] border border-dashed border-white/10 bg-white/3 p-10 text-center text-slate-400">
              대시보드나 API 목록에서 URI를 클릭하면 상세가 열립니다.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
