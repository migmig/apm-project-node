import { startTransition, useEffect, useRef, useState } from "react";
import Sparkline from "./components/Sparkline.jsx";
import { formatNumber, formatTime } from "./lib/format.js";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "apis", label: "APIs" },
  { id: "sql", label: "SQL" },
  { id: "traces", label: "Traces" }
];

const dashboardCharts = [
  { key: "http.requests.total", label: "HTTP Throughput", unit: "req" },
  { key: "http.requests.avg_duration", label: "Latency", unit: "ms" },
  { key: "http.requests.error_rate", label: "Error Rate", unit: "%" },
  { key: "jvm.memory.heap.usage", label: "Heap Usage", unit: "%" },
  { key: "system.cpu.process_usage", label: "Process CPU", unit: "%" },
  { key: "sql.query.count", label: "SQL Throughput", unit: "q" }
];

const apiCharts = [
  { key: "requestCount", label: "Request Count", unit: "req" },
  { key: "errorCount", label: "Error Count", unit: "err" },
  { key: "avgDuration", label: "Avg Duration", unit: "ms" }
];

function getHashTab() {
  const tab = window.location.hash.slice(1);
  return tabs.some((item) => item.id === tab) ? tab : "dashboard";
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function cx(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

function StatusBadge({ tone = "neutral", children }) {
  const tones = {
    positive: "bg-emerald-300 text-emerald-950",
    negative: "bg-rose-300 text-rose-950",
    neutral: "border border-white/10 bg-white/5 text-slate-300"
  };

  return (
    <span className={cx("inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", tones[tone])}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, subValue }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <strong className="mt-3 block text-3xl font-semibold text-white">{value}</strong>
      {subValue ? <p className="mt-2 text-sm text-slate-400">{subValue}</p> : null}
    </article>
  );
}

function ChartCard({ title, value, unit, points }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
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

function Table({ columns, rows, emptyLabel }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10">
      <table className="min-w-full text-left">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6 text-sm text-slate-200">
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [currentTab, setCurrentTab] = useState(getHashTab);
  const [connectionState, setConnectionState] = useState("connecting");
  const [selectedApp, setSelectedApp] = useState("");
  const [selectedApiDetail, setSelectedApiDetail] = useState(null);
  const [selectedTraceDetail, setSelectedTraceDetail] = useState(null);
  const [sqlSearchResults, setSqlSearchResults] = useState([]);
  const [traceSearchResults, setTraceSearchResults] = useState([]);
  const [sqlFilters, setSqlFilters] = useState({
    appName: "",
    minDurationMs: "",
    sql: ""
  });
  const [traceFilters, setTraceFilters] = useState({
    appName: "",
    traceId: "",
    minDurationMs: "",
    uri: ""
  });

  const selectedApiRef = useRef(selectedApiDetail);
  selectedApiRef.current = selectedApiDetail;

  const apps = dashboard?.apps || [];
  const currentApp = apps.find((app) => app.appName === selectedApp) || apps[0] || null;

  useEffect(() => {
    const onHashChange = () => {
      startTransition(() => {
        setCurrentTab(getHashTab());
      });
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const data = await fetchJson("/api/v1/dashboard");

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setDashboard(data);
          setConnectionState("streaming");
          setSelectedApp((current) => current || data.apps[0]?.appName || "");
        });

        await Promise.all([runSqlSearch(sqlFilters), runTraceSearch(traceFilters)]);
      } catch {
        if (!cancelled) {
          setConnectionState("failed");
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stream = new EventSource("/api/v1/stream");

    stream.addEventListener("snapshot", (event) => {
      const payload = JSON.parse(event.data);

      startTransition(() => {
        setDashboard(payload);
        setConnectionState("streaming");
        setSelectedApp((current) => {
          if (payload.apps.some((app) => app.appName === current)) {
            return current;
          }
          return payload.apps[0]?.appName || "";
        });
      });
    });

    stream.addEventListener("heartbeat", () => {
      setConnectionState("streaming");
    });

    stream.onerror = () => {
      setConnectionState("reconnecting");
    };

    return () => {
      stream.close();
    };
  }, []);

  useEffect(() => {
    if (!dashboard?.generatedAt || !selectedApiRef.current) {
      return;
    }

    fetchApiDetail(selectedApiRef.current.appName, selectedApiRef.current.uri).catch(() => {});
  }, [dashboard?.generatedAt]);

  async function fetchApiDetail(appName, uri) {
    const detail = await fetchJson(`/api/v1/api-detail?appName=${encodeURIComponent(appName)}&uri=${encodeURIComponent(uri)}`);
    startTransition(() => {
      setSelectedApiDetail(detail);
      setSelectedApp(appName);
    });
    return detail;
  }

  async function fetchTraceDetail(traceId) {
    const detail = await fetchJson(`/api/v1/traces/${encodeURIComponent(traceId)}`);
    startTransition(() => {
      setSelectedTraceDetail(detail);
      setSelectedApp(detail.appName);
    });
    return detail;
  }

  async function runSqlSearch(filters) {
    try {
      const query = new URLSearchParams();
      if (filters.appName) query.set("appName", filters.appName);
      if (filters.minDurationMs) query.set("minDurationMs", filters.minDurationMs);
      if (filters.sql) query.set("sql", filters.sql);
      query.set("limit", "50");

      const results = await fetchJson(`/api/v1/traces?${query.toString()}`);
      startTransition(() => {
        setSqlSearchResults(results.filter((item) => item.sqlStatements?.length));
      });
    } catch {
      startTransition(() => {
        setSqlSearchResults([]);
      });
    }
  }

  async function runTraceSearch(filters) {
    try {
      const query = new URLSearchParams();
      if (filters.appName) query.set("appName", filters.appName);
      if (filters.traceId) query.set("traceId", filters.traceId);
      if (filters.minDurationMs) query.set("minDurationMs", filters.minDurationMs);
      if (filters.uri) query.set("uri", filters.uri);
      query.set("limit", "50");

      const results = await fetchJson(`/api/v1/traces?${query.toString()}`);
      startTransition(() => {
        setTraceSearchResults(results);
      });
    } catch {
      startTransition(() => {
        setTraceSearchResults([]);
      });
    }
  }

  function switchTab(tabId) {
    startTransition(() => {
      setCurrentTab(tabId);
    });
    window.location.hash = tabId;
  }

  async function openApiDetail(appName, uri) {
    await fetchApiDetail(appName, uri);
    switchTab("apis");
  }

  async function openTraceDetail(traceId, tabId = "traces") {
    await fetchTraceDetail(traceId);
    switchTab(tabId);
  }

  const overviewCards = [
    {
      label: "Registered Apps",
      value: apps.length,
      subValue: `${apps.filter((app) => app.online).length} online now`
    },
    {
      label: "Metric Points",
      value: formatNumber(dashboard?.ingestStats?.metricPoints || 0, 0),
      subValue: `${formatNumber(dashboard?.ingestStats?.metricsBatches || 0, 0)} batches`
    },
    {
      label: "Trace Items",
      value: formatNumber(dashboard?.ingestStats?.traceItems || 0, 0),
      subValue: `${formatNumber(dashboard?.ingestStats?.tracesBatches || 0, 0)} batches`
    },
    {
      label: "Latest Trace",
      value: dashboard?.recentTraces?.[0]?.appName || "-",
      subValue: dashboard?.recentTraces?.[0] ? formatTime(dashboard.recentTraces[0].timestamp) : "no trace yet"
    }
  ];

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1360px] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <header className="grid gap-6 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,17,28,0.96),rgba(10,27,45,0.88))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl md:grid-cols-[1.45fr_0.85fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Node APM Control Room</p>
          <h1 className="mt-3 max-w-[12ch] text-4xl font-semibold tracking-tight text-white md:text-6xl">
            React and Tailwind monitoring console
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
            대시보드는 요약을 유지하고, API와 SQL, Trace는 각각 독립 탭에서 상세 탐색합니다.
          </p>
        </div>
        <div className="grid content-end gap-4">
          <StatusBadge tone={connectionState === "streaming" ? "positive" : connectionState === "failed" ? "negative" : "neutral"}>
            {connectionState}
          </StatusBadge>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-slate-400">Last refresh</p>
            <strong className="mt-2 block text-3xl font-semibold text-white">{formatTime(dashboard?.generatedAt)}</strong>
          </div>
        </div>
      </header>

      <nav className="mt-5 flex flex-wrap gap-3 rounded-[24px] border border-white/10 bg-slate-950/55 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
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

      <main className="mt-5 space-y-6">
        {currentTab === "dashboard" ? (
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
                        onClick={() => {
                          setSelectedApp(app.appName);
                          setSelectedApiDetail(null);
                          switchTab("apis");
                        }}
                        className="rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10"
                      >
                        Open APIs
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedApp(app.appName);
                          const nextFilters = { ...traceFilters, appName: app.appName };
                          setTraceFilters(nextFilters);
                          await runTraceSearch(nextFilters);
                          switchTab("traces");
                        }}
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
                    onClick={() => openTraceDetail(trace.traceId)}
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
        ) : null}

        {currentTab === "apis" ? (
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
                    setSelectedApp(event.target.value);
                    if (selectedApiDetail?.appName !== event.target.value) {
                      setSelectedApiDetail(null);
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
                      onClick={() => openApiDetail(currentApp.appName, row.uri)}
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
                          onClick={() => openTraceDetail(trace.traceId)}
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
        ) : null}

        {currentTab === "sql" ? (
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
                  await runSqlSearch(sqlFilters);
                }}
              >
                <label className="grid gap-2 text-sm text-slate-400">
                  <span>App</span>
                  <select
                    value={sqlFilters.appName}
                    onChange={(event) => setSqlFilters((current) => ({ ...current, appName: event.target.value }))}
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
                    value={sqlFilters.minDurationMs}
                    onChange={(event) => setSqlFilters((current) => ({ ...current, minDurationMs: event.target.value }))}
                    placeholder="500"
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-400">
                  <span>SQL Contains</span>
                  <input
                    type="text"
                    value={sqlFilters.sql}
                    onChange={(event) => setSqlFilters((current) => ({ ...current, sql: event.target.value }))}
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
                rows={sqlSearchResults.map((trace) => (
                  <tr
                    key={trace.traceId}
                    onClick={() => openTraceDetail(trace.traceId, "sql")}
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
                      onClick={() => switchTab("traces")}
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
        ) : null}

        {currentTab === "traces" ? (
          <>
            <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Trace Explorer</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Trace 기준 탐색</h2>
              </div>

              <form
                className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.2fr_auto]"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await runTraceSearch(traceFilters);
                }}
              >
                <label className="grid gap-2 text-sm text-slate-400">
                  <span>App</span>
                  <select
                    value={traceFilters.appName}
                    onChange={(event) => setTraceFilters((current) => ({ ...current, appName: event.target.value }))}
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
                  <span>Trace ID</span>
                  <input
                    type="text"
                    value={traceFilters.traceId}
                    onChange={(event) => setTraceFilters((current) => ({ ...current, traceId: event.target.value }))}
                    placeholder="trace-001"
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-400">
                  <span>Min Duration (ms)</span>
                  <input
                    type="number"
                    min="0"
                    value={traceFilters.minDurationMs}
                    onChange={(event) => setTraceFilters((current) => ({ ...current, minDurationMs: event.target.value }))}
                    placeholder="500"
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-400">
                  <span>URI</span>
                  <input
                    type="text"
                    value={traceFilters.uri}
                    onChange={(event) => setTraceFilters((current) => ({ ...current, uri: event.target.value }))}
                    placeholder="/api/orders"
                    className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold tracking-[0.16em] text-slate-950 transition hover:-translate-y-0.5"
                >
                  Search Trace
                </button>
              </form>

              <Table
                columns={["App", "Trace ID", "API", "Duration", "Status"]}
                emptyLabel="no trace results"
                rows={traceSearchResults.map((trace) => (
                  <tr
                    key={trace.traceId}
                    onClick={() => openTraceDetail(trace.traceId)}
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

            <section className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl">
              {selectedTraceDetail ? (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Trace Detail</p>
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
                    <MetricCard label="API" value={selectedTraceDetail.uri || "-"} />
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">SQL Statements</h3>
                        <p className="text-sm text-slate-400">{selectedTraceDetail.sqlStatements?.length || 0} captured</p>
                      </div>
                      <div className="mt-5 grid gap-4">
                        {selectedTraceDetail.sqlStatements?.length ? (
                          selectedTraceDetail.sqlStatements.map((statement) => (
                            <pre key={statement} className="overflow-x-auto rounded-[22px] border border-white/10 bg-slate-950/80 p-4 font-mono text-sm leading-7 text-amber-200">
                              {statement}
                            </pre>
                          ))
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 p-8 text-center text-slate-400">
                            no sql captured
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/4 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">Spans</h3>
                        <p className="text-sm text-slate-400">{selectedTraceDetail.spans?.length || 0} items</p>
                      </div>
                      <Table
                        columns={["Name", "Duration", "Status", "Parent"]}
                        emptyLabel="no spans"
                        rows={(selectedTraceDetail.spans || []).map((span) => (
                          <tr key={span.spanId}>
                            <td className="px-4 py-3">{span.name}</td>
                            <td className="px-4 py-3">{formatNumber(span.durationMs)} ms</td>
                            <td className="px-4 py-3">{formatNumber(span.status, 0)}</td>
                            <td className="px-4 py-3 font-mono text-cyan-200">{(span.parentSpanId || "-").slice(0, 12)}</td>
                          </tr>
                        ))}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid min-h-[320px] place-items-center rounded-[22px] border border-dashed border-white/10 bg-white/3 p-10 text-center text-slate-400">
                  Trace 결과를 클릭하면 span, duration, SQL이 이 화면에 표시됩니다.
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
