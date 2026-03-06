import { EventEmitter } from "node:events";

const MAX_SERIES_POINTS = 60;
const MAX_RECENT_TRACES = 50;
const MAX_GLOBAL_TRACES = 200;
const MAX_TRACE_INDEX = 5000;
const ONLINE_THRESHOLD_MS = 30_000;

function trim(array, max) {
  while (array.length > max) {
    array.shift();
  }
}

function traceDuration(trace) {
  if (!trace.spans || trace.spans.length === 0) {
    return 0;
  }

  let start = trace.spans[0].startTime;
  let end = trace.spans[0].endTime || trace.spans[0].startTime;

  for (const span of trace.spans) {
    start = Math.min(start, span.startTime);
    end = Math.max(end, span.endTime || span.startTime);
  }

  return Math.max(0, end - start);
}

function extractUri(spans) {
  for (const span of spans) {
    const uri = span.tags?.["http.url"] || span.tags?.["http.path"] || "";
    if (uri) {
      return uri;
    }
  }
  return "";
}

function extractSqlStatements(spans) {
  const sqls = new Set();

  for (const span of spans) {
    const sql = span.tags?.["db.statement"] || span.tags?.["sql.query"] || span.tags?.sql || "";
    if (sql) {
      sqls.add(String(sql));
    }
  }

  return [...sqls].slice(0, 10);
}

function normalizeTrace(trace, receivedAt) {
  const spans = Array.isArray(trace.spans) ? trace.spans : [];
  const rootSpan = spans.find((span) => !span.parentSpanId) || spans[0];

  return {
    traceId: trace.traceId,
    appName: trace.appName,
    host: trace.host || "",
    timestamp: trace.timestamp || receivedAt,
    spanCount: spans.length,
    durationMs: traceDuration(trace),
    error: spans.some((span) => span.error),
    status: spans.reduce((max, span) => Math.max(max, span.status || 0), 0),
    uri: extractUri(spans),
    rootSpanName: rootSpan ? rootSpan.name : "unknown",
    sqlStatements: extractSqlStatements(spans),
    spans: spans.slice(0, 100)
  };
}

function seriesPoint(metric) {
  return {
    timestamp: metric.timestamp,
    value: metric.value
  };
}

function sortByTimestampDesc(left, right) {
  return right.timestamp - left.timestamp;
}

function traceCompositeKey(appName, traceId) {
  return `${appName}::${traceId}`;
}

export class ApmState extends EventEmitter {
  constructor() {
    super();
    this.apps = new Map();
    this.globalRecentTraces = [];
    this.traceIndex = new Map();
    this.ingestStats = {
      registeredApps: 0,
      metricsBatches: 0,
      tracesBatches: 0,
      metricPoints: 0,
      traceItems: 0
    };
  }

  ensureApp(appName, host = "") {
    if (!this.apps.has(appName)) {
      this.apps.set(appName, {
        appName,
        host,
        hosts: new Set(host ? [host] : []),
        lastSeenAt: 0,
        registeredAt: 0,
        systemInfo: null,
        latestMetrics: new Map(),
        charts: new Map(),
        uriStats: new Map(),
        uriCharts: new Map(),
        recentTraces: [],
        metricsReceived: 0,
        tracesReceived: 0
      });
      this.ingestStats.registeredApps = this.apps.size;
    }

    const app = this.apps.get(appName);
    if (host) {
      app.host = host;
      app.hosts.add(host);
    }
    return app;
  }

  register(systemInfo, receivedAt = Date.now()) {
    const app = this.ensureApp(systemInfo.appName, systemInfo.host);
    app.systemInfo = systemInfo;
    app.host = systemInfo.host || app.host;
    app.hosts.add(systemInfo.host);
    app.registeredAt = app.registeredAt || receivedAt;
    app.lastSeenAt = receivedAt;
    this.emitUpdate();
  }

  ingestMetrics(metrics, receivedAt = Date.now()) {
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return;
    }

    this.ingestStats.metricsBatches += 1;
    this.ingestStats.metricPoints += metrics.length;

    for (const metric of metrics) {
      const app = this.ensureApp(metric.appName, metric.host || "");
      const metricTimestamp = metric.timestamp || receivedAt;
      const metricKey = JSON.stringify({
        name: metric.name,
        tags: metric.tags || {}
      });

      app.lastSeenAt = Math.max(app.lastSeenAt, metricTimestamp);
      app.metricsReceived += 1;
      app.latestMetrics.set(metricKey, {
        ...metric,
        timestamp: metricTimestamp
      });

      const chart = app.charts.get(metric.name) || [];
      chart.push(seriesPoint({ ...metric, timestamp: metricTimestamp }));
      trim(chart, MAX_SERIES_POINTS);
      app.charts.set(metric.name, chart);

      if (metric.name === "http.request.count" && metric.tags?.uri) {
        const current = app.uriStats.get(metric.tags.uri) || {
          uri: metric.tags.uri,
          totalCount: 0,
          errorCount: 0,
          lastCount: 0,
          avgDuration: 0,
          lastUpdatedAt: 0
        };
        current.totalCount += metric.value;
        current.lastCount = metric.value;
        current.lastUpdatedAt = metricTimestamp;
        app.uriStats.set(metric.tags.uri, current);

        const uriCharts = app.uriCharts.get(metric.tags.uri) || {
          requestCount: [],
          errorCount: [],
          avgDuration: []
        };
        uriCharts.requestCount.push(seriesPoint({ timestamp: metricTimestamp, value: metric.value }));
        trim(uriCharts.requestCount, MAX_SERIES_POINTS);
        app.uriCharts.set(metric.tags.uri, uriCharts);
      }

      if (metric.name === "http.request.error.count" && metric.tags?.uri) {
        const current = app.uriStats.get(metric.tags.uri) || {
          uri: metric.tags.uri,
          totalCount: 0,
          errorCount: 0,
          lastCount: 0,
          avgDuration: 0,
          lastUpdatedAt: 0
        };
        current.errorCount += metric.value;
        current.lastUpdatedAt = metricTimestamp;
        app.uriStats.set(metric.tags.uri, current);

        const uriCharts = app.uriCharts.get(metric.tags.uri) || {
          requestCount: [],
          errorCount: [],
          avgDuration: []
        };
        uriCharts.errorCount.push(seriesPoint({ timestamp: metricTimestamp, value: metric.value }));
        trim(uriCharts.errorCount, MAX_SERIES_POINTS);
        app.uriCharts.set(metric.tags.uri, uriCharts);
      }

      if (metric.name === "http.request.duration.avg" && metric.tags?.uri) {
        const current = app.uriStats.get(metric.tags.uri) || {
          uri: metric.tags.uri,
          totalCount: 0,
          errorCount: 0,
          lastCount: 0,
          avgDuration: 0,
          lastUpdatedAt: 0
        };
        current.avgDuration = metric.value;
        current.lastUpdatedAt = metricTimestamp;
        app.uriStats.set(metric.tags.uri, current);

        const uriCharts = app.uriCharts.get(metric.tags.uri) || {
          requestCount: [],
          errorCount: [],
          avgDuration: []
        };
        uriCharts.avgDuration.push(seriesPoint({ timestamp: metricTimestamp, value: metric.value }));
        trim(uriCharts.avgDuration, MAX_SERIES_POINTS);
        app.uriCharts.set(metric.tags.uri, uriCharts);
      }
    }

    this.emitUpdate();
  }

  ingestTraces(traces, receivedAt = Date.now()) {
    if (!Array.isArray(traces) || traces.length === 0) {
      return;
    }

    this.ingestStats.tracesBatches += 1;
    this.ingestStats.traceItems += traces.length;

    for (const trace of traces) {
      const app = this.ensureApp(trace.appName, trace.host || "");
      const item = normalizeTrace(trace, receivedAt);
      app.lastSeenAt = Math.max(app.lastSeenAt, item.timestamp);
      app.tracesReceived += 1;
      this.traceIndex.set(traceCompositeKey(item.appName, item.traceId), item);
      while (this.traceIndex.size > MAX_TRACE_INDEX) {
        const oldestKey = this.traceIndex.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.traceIndex.delete(oldestKey);
      }
      app.recentTraces.unshift(item);
      trim(app.recentTraces, MAX_RECENT_TRACES);
      this.globalRecentTraces.unshift(item);
      trim(this.globalRecentTraces, MAX_GLOBAL_TRACES);
    }

    this.emitUpdate();
  }

  metricValue(app, name, fallback = null) {
    let latest = null;

    for (const metric of app.latestMetrics.values()) {
      if (metric.name !== name) {
        continue;
      }
      if (!latest || metric.timestamp > latest.timestamp) {
        latest = metric;
      }
    }

    return latest ? latest.value : fallback;
  }

  appSnapshot(appName) {
    const app = this.apps.get(appName);
    if (!app) {
      return null;
    }

    const latestUriStats = Array.from(app.uriStats.values())
      .sort((left, right) => {
        if (right.totalCount !== left.totalCount) {
          return right.totalCount - left.totalCount;
        }
        return right.lastUpdatedAt - left.lastUpdatedAt;
      })
      .slice(0, 8);

    const charts = {};
    for (const [name, points] of app.charts.entries()) {
      charts[name] = points;
    }

    return {
      appName: app.appName,
      host: app.host,
      hosts: Array.from(app.hosts),
      lastSeenAt: app.lastSeenAt,
      online: Date.now() - app.lastSeenAt < ONLINE_THRESHOLD_MS,
      registeredAt: app.registeredAt,
      systemInfo: app.systemInfo,
      stats: {
        requestRate: this.metricValue(app, "http.requests.total", 0),
        avgLatencyMs: this.metricValue(app, "http.requests.avg_duration", 0),
        errorRate: this.metricValue(app, "http.requests.error_rate", 0),
        heapUsage: this.metricValue(app, "jvm.memory.heap.usage", 0),
        heapUsedMb: this.metricValue(app, "jvm.memory.heap.used", 0),
        cpuLoad: this.metricValue(app, "system.cpu.process_usage", this.metricValue(app, "system.cpu.load", 0)),
        sqlThroughput: this.metricValue(app, "sql.query.count", 0),
        slowQueryCount: this.metricValue(app, "sql.query.slow.count", 0),
        uptimeSeconds: this.metricValue(app, "system.uptime", 0)
      },
      metricsReceived: app.metricsReceived,
      tracesReceived: app.tracesReceived,
      uriStats: latestUriStats,
      recentTraces: app.recentTraces.slice(0, 10),
      charts
    };
  }

  apiDetail(appName, uri) {
    const app = this.apps.get(appName);
    if (!app) {
      return null;
    }

    const stats = app.uriStats.get(uri);
    if (!stats) {
      return null;
    }

    const charts = app.uriCharts.get(uri) || {
      requestCount: [],
      errorCount: [],
      avgDuration: []
    };

    return {
      appName,
      uri,
      stats,
      charts,
      traces: app.recentTraces.filter((trace) => trace.uri === uri).slice(0, 20)
    };
  }

  traceDetail(appName, traceId) {
    if (appName) {
      return this.traceIndex.get(traceCompositeKey(appName, traceId)) || null;
    }

    for (const trace of this.traceIndex.values()) {
      if (trace.traceId === traceId) {
        return trace;
      }
    }

    return null;
  }

  searchTraces(filters = {}) {
    const appName = filters.appName || "";
    const traceId = (filters.traceId || "").toLowerCase();
    const sql = (filters.sql || "").toLowerCase();
    const uri = filters.uri || "";
    const minDurationMs = Number(filters.minDurationMs || 0);
    const limit = Math.min(Number(filters.limit || 50), 100);

    const source = appName && this.apps.has(appName)
      ? this.apps.get(appName).recentTraces
      : this.globalRecentTraces;

    return source
      .filter((trace) => {
        if (traceId && !trace.traceId.toLowerCase().includes(traceId)) {
          return false;
        }
        if (uri && trace.uri !== uri) {
          return false;
        }
        if (minDurationMs && trace.durationMs < minDurationMs) {
          return false;
        }
        if (
          sql &&
          !trace.sqlStatements.some((statement) => statement.toLowerCase().includes(sql))
        ) {
          return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  snapshot() {
    const apps = Array.from(this.apps.values())
      .map((app) => this.appSnapshot(app.appName))
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt);

    return {
      generatedAt: Date.now(),
      ingestStats: this.ingestStats,
      apps,
      recentTraces: [...this.globalRecentTraces].sort(sortByTimestampDesc).slice(0, 15)
    };
  }

  emitUpdate() {
    this.emit("update", this.snapshot());
  }
}
