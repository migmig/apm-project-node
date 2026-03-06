import { formatNumber } from "../../lib/format.js";
import MetricCard from "../ui/MetricCard.jsx";
import Table from "../ui/Table.jsx";

export default function SqlView({
  apps,
  filters,
  onChangeFilters,
  onSearch,
  results,
  selectedTraceDetail,
  onOpenTrace,
  onSwitchToTraceTab
}) {
  return (
    <>
      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">SQL Explorer</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">SQL 기준 탐색</h2>
        </div>

        <form
          className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1.4fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSearch(filters);
          }}
        >
          <label className="grid gap-2 text-sm text-slate-400">
            <span>App</span>
            <select
              value={filters.appName}
              onChange={(event) => onChangeFilters({ ...filters, appName: event.target.value })}
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none"
            >
              <option value="" className="bg-slate-900">All Apps</option>
              {apps.map((app) => (
                <option key={app.appName} value={app.appName} className="bg-slate-900">
                  {app.appName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-400">
            <span>Min Duration (ms)</span>
            <input
              type="number"
              min="0"
              value={filters.minDurationMs}
              onChange={(event) => onChangeFilters({ ...filters, minDurationMs: event.target.value })}
              placeholder="500"
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-400">
            <span>SQL Contains</span>
            <input
              type="text"
              value={filters.sql}
              onChange={(event) => onChangeFilters({ ...filters, sql: event.target.value })}
              placeholder="insert into payments"
              className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold tracking-[0.16em] text-slate-950 transition hover:-translate-y-0.5"
          >
            Search SQL
          </button>
        </form>

        <Table
          columns={["App", "Trace ID", "API", "Duration", "SQL"]}
          emptyLabel="no sql traces"
          rows={results.map((trace) => (
            <tr
              key={trace.traceId}
              onClick={() => onOpenTrace(trace.traceId, "sql")}
              className="cursor-pointer transition hover:bg-white/5"
            >
              <td className="px-4 py-3">{trace.appName}</td>
              <td className="px-4 py-3 font-mono text-cyan-200">{trace.traceId.slice(0, 12)}</td>
              <td className="px-4 py-3">{trace.uri || trace.rootSpanName}</td>
              <td className="px-4 py-3">{formatNumber(trace.durationMs)} ms</td>
              <td className="px-4 py-3">{trace.sqlStatements[0] || "-"}</td>
            </tr>
          ))}
        />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        {selectedTraceDetail?.sqlStatements?.length ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">SQL Detail</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedTraceDetail.traceId}</h2>
              </div>
              <div className="text-sm text-slate-400">
                {selectedTraceDetail.appName} · {selectedTraceDetail.uri || selectedTraceDetail.rootSpanName}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Duration" value={`${formatNumber(selectedTraceDetail.durationMs)} ms`} />
              <MetricCard label="Span Count" value={formatNumber(selectedTraceDetail.spanCount, 0)} />
              <MetricCard label="Status" value={formatNumber(selectedTraceDetail.status, 0)} />
              <MetricCard label="SQL Count" value={formatNumber(selectedTraceDetail.sqlStatements.length, 0)} />
            </div>

            <div className="mt-5 grid gap-4">
              {selectedTraceDetail.sqlStatements.map((statement) => (
                <pre key={statement} className="overflow-x-auto rounded-[22px] border border-white/10 bg-slate-950/80 p-4 font-mono text-sm leading-7 text-amber-200">
                  {statement}
                </pre>
              ))}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={onSwitchToTraceTab}
                className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Open In Trace Tab
              </button>
            </div>
          </>
        ) : (
          <div className="grid min-h-[280px] place-items-center rounded-[22px] border border-dashed border-white/10 bg-white/3 p-10 text-center text-slate-400">
            SQL 검색 결과를 클릭하면 이 화면에 상세가 열립니다.
          </div>
        )}
      </section>
    </>
  );
}
