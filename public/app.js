const validTabs = new Set(["dashboard", "apis", "sql", "traces"]);

const state = {
  dashboard: null,
  currentTab: validTabs.has(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "dashboard",
  selectedApp: null,
  selectedApiDetail: null,
  selectedTraceDetail: null,
  sqlSearchResults: [],
  traceSearchResults: []
};

const importantCharts = [
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

function formatNumber(value, fractionDigits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("ko-KR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0
  });
}

function formatTime(timestamp) {
  if (!timestamp) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString("ko-KR", { hour12: false });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setConnectionState(text, online) {
  const node = document.getElementById("connectionState");
  node.textContent = text;
  node.classList.toggle("online", Boolean(online));
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== "" && value !== null && value !== undefined) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function renderSparkline(points) {
  if (!points || points.length === 0) {
    return '<div class="empty-chart">no data</div>';
  }

  const width = 300;
  const height = 140;
  const values = points.map((point) => Number(point.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((Number(point.value) - min) / range) * (height - 12) - 6;
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="sparkline">
      <polyline points="${path}" />
    </svg>
  `;
}

function currentAppSnapshot() {
  const apps = state.dashboard?.apps || [];
  if (!apps.length) {
    return null;
  }
  if (!state.selectedApp) {
    state.selectedApp = apps[0].appName;
  }
  return apps.find((app) => app.appName === state.selectedApp) || apps[0];
}

function switchTab(tab) {
  if (!validTabs.has(tab)) {
    return;
  }
  state.currentTab = tab;
  window.location.hash = tab;
  render();
}

async function fetchApiDetail(appName, uri) {
  const response = await fetch(`/api/v1/api-detail${buildQuery({ appName, uri })}`);
  if (!response.ok) {
    return;
  }
  state.selectedApiDetail = await response.json();
  state.selectedApp = appName;
}

async function fetchTraceDetail(traceId) {
  const response = await fetch(`/api/v1/traces/${encodeURIComponent(traceId)}`);
  if (!response.ok) {
    return;
  }
  state.selectedTraceDetail = await response.json();
  state.selectedApp = state.selectedTraceDetail.appName;
}

async function openApiDetail(appName, uri) {
  await fetchApiDetail(appName, uri);
  switchTab("apis");
}

async function openTraceDetail(traceId, targetTab = "traces") {
  await fetchTraceDetail(traceId);
  switchTab(targetTab);
}

async function searchSqlTraces() {
  const response = await fetch(
    `/api/v1/traces${buildQuery({
      appName: document.getElementById("sqlSearchApp").value,
      minDurationMs: document.getElementById("sqlSearchDuration").value,
      sql: document.getElementById("sqlSearchText").value.trim(),
      limit: 50
    })}`
  );
  const results = response.ok ? await response.json() : [];
  state.sqlSearchResults = results.filter((trace) => Array.isArray(trace.sqlStatements) && trace.sqlStatements.length > 0);
  renderSqlResults();
}

async function searchTraces() {
  const response = await fetch(
    `/api/v1/traces${buildQuery({
      appName: document.getElementById("traceSearchApp").value,
      traceId: document.getElementById("traceSearchId").value.trim(),
      minDurationMs: document.getElementById("traceSearchDuration").value,
      uri: document.getElementById("traceSearchUri").value.trim(),
      limit: 50
    })}`
  );
  state.traceSearchResults = response.ok ? await response.json() : [];
  renderTraceResults();
}

function renderTabs() {
  for (const button of document.querySelectorAll(".tab-button")) {
    button.classList.toggle("active", button.dataset.tab === state.currentTab);
  }

  for (const view of document.querySelectorAll(".view")) {
    const visible = view.id === `${state.currentTab}View`;
    view.classList.toggle("hidden", !visible);
  }
}

function renderOverview() {
  const root = document.getElementById("globalOverview");
  const apps = state.dashboard?.apps || [];
  const onlineApps = apps.filter((app) => app.online).length;
  const totalMetrics = state.dashboard?.ingestStats?.metricPoints || 0;
  const totalTraces = state.dashboard?.ingestStats?.traceItems || 0;
  const latestTrace = state.dashboard?.recentTraces?.[0];

  root.innerHTML = `
    <article class="overview-card">
      <span class="label">Registered Apps</span>
      <strong>${apps.length}</strong>
      <small>${onlineApps} online now</small>
    </article>
    <article class="overview-card">
      <span class="label">Metric Points</span>
      <strong>${formatNumber(totalMetrics, 0)}</strong>
      <small>${formatNumber(state.dashboard?.ingestStats?.metricsBatches || 0, 0)} batches</small>
    </article>
    <article class="overview-card">
      <span class="label">Trace Items</span>
      <strong>${formatNumber(totalTraces, 0)}</strong>
      <small>${formatNumber(state.dashboard?.ingestStats?.tracesBatches || 0, 0)} batches</small>
    </article>
    <article class="overview-card">
      <span class="label">Latest Trace</span>
      <strong>${latestTrace ? escapeHtml(latestTrace.appName) : "-"}</strong>
      <small>${latestTrace ? formatTime(latestTrace.timestamp) : "no trace yet"}</small>
    </article>
  `;
}

function renderDashboardApps() {
  const root = document.getElementById("appGrid");
  const apps = state.dashboard?.apps || [];

  root.innerHTML = apps
    .map(
      (app) => `
        <article class="app-card">
          <div class="app-card-head">
            <strong>${escapeHtml(app.appName)}</strong>
            <span class="badge ${app.online ? "online" : "offline"}">${app.online ? "online" : "idle"}</span>
          </div>
          <p>${escapeHtml(app.host || "-")}</p>
          <dl>
            <div><dt>Req/slice</dt><dd>${formatNumber(app.stats.requestRate, 0)}</dd></div>
            <div><dt>Latency</dt><dd>${formatNumber(app.stats.avgLatencyMs)} ms</dd></div>
            <div><dt>Error</dt><dd>${formatNumber(app.stats.errorRate)}%</dd></div>
          </dl>
          <div class="card-actions">
            <button class="ghost-button" data-open-apis="${escapeHtml(app.appName)}">Open APIs</button>
            <button class="ghost-button" data-open-traces="${escapeHtml(app.appName)}">Open Traces</button>
          </div>
        </article>
      `
    )
    .join("");

  for (const node of root.querySelectorAll("[data-open-apis]")) {
    node.addEventListener("click", () => {
      state.selectedApp = node.dataset.openApis;
      state.selectedApiDetail = null;
      switchTab("apis");
    });
  }

  for (const node of root.querySelectorAll("[data-open-traces]")) {
    node.addEventListener("click", () => {
      state.selectedApp = node.dataset.openTraces;
      document.getElementById("traceSearchApp").value = state.selectedApp;
      switchTab("traces");
      searchTraces();
    });
  }
}

function renderDashboardRecentTraces() {
  const root = document.getElementById("dashboardTraceBody");
  const traces = state.dashboard?.recentTraces || [];

  root.innerHTML = traces
    .map(
      (trace) => `
        <tr class="clickable-row" data-dashboard-trace-id="${encodeURIComponent(trace.traceId)}">
          <td>${escapeHtml(trace.appName)}</td>
          <td class="mono">${escapeHtml(trace.traceId.slice(0, 12))}</td>
          <td>${escapeHtml(trace.uri || trace.rootSpanName)}</td>
          <td>${formatNumber(trace.durationMs)} ms</td>
          <td><span class="badge ${trace.error ? "offline" : "online"}">${trace.error ? "error" : "ok"}</span></td>
        </tr>
      `
    )
    .join("") || '<tr><td colspan="5" class="empty">no trace data</td></tr>';

  for (const node of root.querySelectorAll("[data-dashboard-trace-id]")) {
    node.addEventListener("click", () => {
      openTraceDetail(decodeURIComponent(node.dataset.dashboardTraceId), "traces");
    });
  }
}

function appOptionsMarkup() {
  const apps = state.dashboard?.apps || [];
  return `
    <option value="">All Apps</option>
    ${apps
      .map((app) => `<option value="${escapeHtml(app.appName)}">${escapeHtml(app.appName)}</option>`)
      .join("")}
  `;
}

function renderApiList() {
  const app = currentAppSnapshot();
  const select = document.getElementById("apiAppSelect");
  select.innerHTML = (state.dashboard?.apps || [])
    .map((item) => `<option value="${escapeHtml(item.appName)}">${escapeHtml(item.appName)}</option>`)
    .join("");

  if (app) {
    select.value = app.appName;
  }

  const root = document.getElementById("apiListBody");
  if (!app) {
    root.innerHTML = '<tr><td colspan="4" class="empty">no applications</td></tr>';
    return;
  }

  root.innerHTML = (app.uriStats || [])
    .map(
      (row) => `
        <tr class="clickable-row" data-api-uri="${encodeURIComponent(row.uri)}">
          <td>${escapeHtml(row.uri)}</td>
          <td>${formatNumber(row.totalCount, 0)}</td>
          <td>${formatNumber(row.errorCount, 0)}</td>
          <td>${formatNumber(row.avgDuration)}</td>
        </tr>
      `
    )
    .join("") || '<tr><td colspan="4" class="empty">no api metrics</td></tr>';

  for (const node of root.querySelectorAll("[data-api-uri]")) {
    node.addEventListener("click", () => {
      openApiDetail(app.appName, decodeURIComponent(node.dataset.apiUri));
    });
  }
}

function renderApiDetail() {
  const root = document.getElementById("apiDetailContent");
  const detail = state.selectedApiDetail;
  const app = currentAppSnapshot();

  if (!detail || !app || detail.appName !== app.appName) {
    root.innerHTML = '대시보드나 API 목록에서 URI를 클릭하면 상세가 열립니다.';
    root.className = "placeholder";
    return;
  }

  root.className = "";
  root.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">API Detail</p>
        <h3>${escapeHtml(detail.uri)}</h3>
      </div>
      <div class="panel-meta">
        <span>${escapeHtml(detail.appName)}</span>
        <span>updated ${formatTime(detail.stats.lastUpdatedAt)}</span>
      </div>
    </div>
    <div class="metric-grid metric-grid-3">
      <article class="metric-card"><span>Total Requests</span><strong>${formatNumber(detail.stats.totalCount, 0)}</strong></article>
      <article class="metric-card"><span>Error Count</span><strong>${formatNumber(detail.stats.errorCount, 0)}</strong></article>
      <article class="metric-card"><span>Avg Duration</span><strong>${formatNumber(detail.stats.avgDuration)} ms</strong></article>
    </div>
    <div class="chart-grid metric-grid-3">
      ${apiCharts
        .map((chart) => {
          const points = detail.charts?.[chart.key] || [];
          return `
            <article class="chart-card">
              <div class="chart-head">
                <span>${chart.label}</span>
                <strong>${points.length ? `${formatNumber(points.at(-1).value)} ${chart.unit}` : "-"}</strong>
              </div>
              ${renderSparkline(points)}
            </article>
          `;
        })
        .join("")}
    </div>
    <div class="subpanel inline-subpanel">
      <div class="subpanel-head">
        <h3>Related Traces</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th>Trace ID</th>
            <th>Duration</th>
            <th>Status</th>
            <th>SQL</th>
          </tr>
        </thead>
        <tbody>
          ${
            (detail.traces || [])
              .map(
                (trace) => `
                  <tr class="clickable-row" data-api-trace-id="${encodeURIComponent(trace.traceId)}">
                    <td class="mono">${escapeHtml(trace.traceId.slice(0, 12))}</td>
                    <td>${formatNumber(trace.durationMs)} ms</td>
                    <td><span class="badge ${trace.error ? "offline" : "online"}">${trace.error ? "error" : "ok"}</span></td>
                    <td>${escapeHtml(trace.sqlStatements[0] || "-")}</td>
                  </tr>
                `
              )
              .join("") || '<tr><td colspan="4" class="empty">no traces for this api</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;

  for (const node of root.querySelectorAll("[data-api-trace-id]")) {
    node.addEventListener("click", () => {
      openTraceDetail(decodeURIComponent(node.dataset.apiTraceId), "traces");
    });
  }
}

function renderSqlResults() {
  const root = document.getElementById("sqlSearchBody");
  root.innerHTML = state.sqlSearchResults
    .map(
      (trace) => `
        <tr class="clickable-row" data-sql-trace-id="${encodeURIComponent(trace.traceId)}">
          <td>${escapeHtml(trace.appName)}</td>
          <td class="mono">${escapeHtml(trace.traceId.slice(0, 12))}</td>
          <td>${escapeHtml(trace.uri || trace.rootSpanName)}</td>
          <td>${formatNumber(trace.durationMs)} ms</td>
          <td>${escapeHtml(trace.sqlStatements[0] || "-")}</td>
        </tr>
      `
    )
    .join("") || '<tr><td colspan="5" class="empty">no sql traces</td></tr>';

  for (const node of root.querySelectorAll("[data-sql-trace-id]")) {
    node.addEventListener("click", async () => {
      await fetchTraceDetail(decodeURIComponent(node.dataset.sqlTraceId));
      switchTab("sql");
    });
  }

  renderSqlDetail();
}

function renderSqlDetail() {
  const root = document.getElementById("sqlDetailContent");
  const trace = state.selectedTraceDetail;

  if (!trace || !trace.sqlStatements?.length) {
    root.innerHTML = "SQL 검색 결과를 클릭하면 이 화면에 상세가 열립니다.";
    root.className = "placeholder";
    return;
  }

  root.className = "";
  root.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Trace With SQL</p>
        <h3>${escapeHtml(trace.traceId)}</h3>
      </div>
      <div class="panel-meta">
        <span>${escapeHtml(trace.appName)}</span>
        <span>${escapeHtml(trace.uri || trace.rootSpanName)}</span>
      </div>
    </div>
    <div class="metric-grid metric-grid-4">
      <article class="metric-card"><span>Duration</span><strong>${formatNumber(trace.durationMs)} ms</strong></article>
      <article class="metric-card"><span>Span Count</span><strong>${formatNumber(trace.spanCount, 0)}</strong></article>
      <article class="metric-card"><span>Status</span><strong>${formatNumber(trace.status, 0)}</strong></article>
      <article class="metric-card"><span>SQL Count</span><strong>${formatNumber(trace.sqlStatements.length, 0)}</strong></article>
    </div>
    <div class="sql-list">
      ${trace.sqlStatements.map((sql) => `<pre>${escapeHtml(sql)}</pre>`).join("")}
    </div>
    <div class="inline-actions">
      <button class="ghost-button" id="openTraceTabButton">Open In Trace Tab</button>
    </div>
  `;

  document.getElementById("openTraceTabButton").addEventListener("click", () => {
    switchTab("traces");
  });
}

function renderTraceResults() {
  const root = document.getElementById("traceSearchBody");
  root.innerHTML = state.traceSearchResults
    .map(
      (trace) => `
        <tr class="clickable-row" data-trace-result-id="${encodeURIComponent(trace.traceId)}">
          <td>${escapeHtml(trace.appName)}</td>
          <td class="mono">${escapeHtml(trace.traceId.slice(0, 12))}</td>
          <td>${escapeHtml(trace.uri || trace.rootSpanName)}</td>
          <td>${formatNumber(trace.durationMs)} ms</td>
          <td><span class="badge ${trace.error ? "offline" : "online"}">${trace.error ? "error" : "ok"}</span></td>
        </tr>
      `
    )
    .join("") || '<tr><td colspan="5" class="empty">no trace results</td></tr>';

  for (const node of root.querySelectorAll("[data-trace-result-id]")) {
    node.addEventListener("click", async () => {
      await fetchTraceDetail(decodeURIComponent(node.dataset.traceResultId));
      switchTab("traces");
    });
  }

  renderTraceDetail();
}

function renderTraceDetail() {
  const root = document.getElementById("traceDetailContent");
  const trace = state.selectedTraceDetail;

  if (!trace) {
    root.innerHTML = "Trace 결과를 클릭하면 span, duration, SQL이 이 화면에 표시됩니다.";
    root.className = "placeholder";
    return;
  }

  root.className = "";
  root.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Trace Detail</p>
        <h3>${escapeHtml(trace.traceId)}</h3>
      </div>
      <div class="panel-meta">
        <span>${escapeHtml(trace.appName)}</span>
        <span>${escapeHtml(trace.uri || trace.rootSpanName)}</span>
        <span>${trace.error ? "error" : "ok"}</span>
      </div>
    </div>
    <div class="metric-grid metric-grid-4">
      <article class="metric-card"><span>Duration</span><strong>${formatNumber(trace.durationMs)} ms</strong></article>
      <article class="metric-card"><span>Span Count</span><strong>${formatNumber(trace.spanCount, 0)}</strong></article>
      <article class="metric-card"><span>Status</span><strong>${formatNumber(trace.status, 0)}</strong></article>
      <article class="metric-card"><span>API</span><strong>${escapeHtml(trace.uri || "-")}</strong></article>
    </div>
    <div class="split-grid trace-detail-grid">
      <div class="subpanel inline-subpanel">
        <div class="subpanel-head">
          <h3>SQL Statements</h3>
        </div>
        <div class="sql-list">
          ${trace.sqlStatements?.length ? trace.sqlStatements.map((sql) => `<pre>${escapeHtml(sql)}</pre>`).join("") : '<div class="empty">no sql captured</div>'}
        </div>
      </div>
      <div class="subpanel inline-subpanel">
        <div class="subpanel-head">
          <h3>Spans</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Parent</th>
            </tr>
          </thead>
          <tbody>
            ${(trace.spans || [])
              .map(
                (span) => `
                  <tr>
                    <td>${escapeHtml(span.name)}</td>
                    <td>${formatNumber(span.durationMs)} ms</td>
                    <td>${formatNumber(span.status, 0)}</td>
                    <td class="mono">${escapeHtml((span.parentSpanId || "-").slice(0, 12))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSelectors() {
  const apps = state.dashboard?.apps || [];
  const currentApp = currentAppSnapshot();
  const sqlSelected = document.getElementById("sqlSearchApp").value || "";
  const traceSelected = document.getElementById("traceSearchApp").value || "";

  document.getElementById("sqlSearchApp").innerHTML = appOptionsMarkup();
  document.getElementById("traceSearchApp").innerHTML = appOptionsMarkup();
  document.getElementById("sqlSearchApp").value =
    apps.some((app) => app.appName === sqlSelected) ? sqlSelected : "";
  document.getElementById("traceSearchApp").value =
    apps.some((app) => app.appName === traceSelected) ? traceSelected : "";

  if (currentApp) {
    const apiAppSelect = document.getElementById("apiAppSelect");
    if (apiAppSelect.options.length) {
      apiAppSelect.value = currentApp.appName;
    }
  }

  if (!apps.some((app) => app.appName === state.selectedApp)) {
    state.selectedApp = apps[0]?.appName || null;
  }
}

function render() {
  if (!state.dashboard) {
    return;
  }

  document.getElementById("lastRefresh").textContent = formatTime(state.dashboard.generatedAt);
  renderTabs();
  renderOverview();
  renderSelectors();
  renderDashboardApps();
  renderDashboardRecentTraces();
  renderApiList();
  renderApiDetail();
  renderSqlResults();
  renderTraceResults();
}

async function loadInitial() {
  const response = await fetch("/api/v1/dashboard");
  state.dashboard = await response.json();
  if (!state.selectedApp) {
    state.selectedApp = state.dashboard.apps[0]?.appName || null;
  }
  render();
  await searchSqlTraces();
  await searchTraces();
}

function connectStream() {
  const source = new EventSource("/api/v1/stream");
  setConnectionState("streaming", true);

  source.addEventListener("snapshot", async (event) => {
    state.dashboard = JSON.parse(event.data);
    render();
    if (state.selectedApiDetail) {
      await fetchApiDetail(state.selectedApiDetail.appName, state.selectedApiDetail.uri);
      renderApiDetail();
    }
  });

  source.addEventListener("heartbeat", () => {
    setConnectionState("streaming", true);
  });

  source.onerror = () => {
    setConnectionState("reconnecting", false);
  };
}

for (const button of document.querySelectorAll(".tab-button")) {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
  });
}

document.getElementById("apiAppSelect").addEventListener("change", (event) => {
  state.selectedApp = event.target.value;
  if (state.selectedApiDetail?.appName !== state.selectedApp) {
    state.selectedApiDetail = null;
  }
  render();
});

document.getElementById("sqlSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  searchSqlTraces();
});

document.getElementById("traceSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  searchTraces();
});

window.addEventListener("hashchange", () => {
  const nextTab = window.location.hash.slice(1);
  if (validTabs.has(nextTab)) {
    state.currentTab = nextTab;
    renderTabs();
  }
});

loadInitial()
  .then(() => {
    connectStream();
  })
  .catch(() => {
    setConnectionState("failed", false);
  });
