import { startTransition, useEffect, useRef, useState } from "react";
import { tabs } from "../constants/dashboard.js";
import { formatNumber, formatTime } from "../lib/format.js";
import { fetchJson, withApiKey } from "../lib/fetch-json.js";

function getHashTab() {
  const tab = window.location.hash.slice(1);
  return tabs.some((item) => item.id === tab) ? tab : "dashboard";
}

export function useApmDashboard() {
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

  async function fetchApiDetail(appName, uri) {
    const detail = await fetchJson(`/api/v1/api-detail?appName=${encodeURIComponent(appName)}&uri=${encodeURIComponent(uri)}`);
    startTransition(() => {
      setSelectedApiDetail(detail);
      setSelectedApp(appName);
    });
    return detail;
  }

  async function fetchTraceDetail(appName, traceId) {
    const detail = await fetchJson(
      `/api/v1/apps/${encodeURIComponent(appName)}/traces/${encodeURIComponent(traceId)}`
    );
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

  async function openTraceDetail(traceId, appName, tabId = "traces") {
    await fetchTraceDetail(appName, traceId);
    switchTab(tabId);
  }

  async function openAppApis(appName) {
    startTransition(() => {
      setSelectedApp(appName);
      setSelectedApiDetail(null);
    });
    switchTab("apis");
  }

  async function openAppTraces(appName) {
    const nextFilters = { ...traceFilters, appName };
    startTransition(() => {
      setSelectedApp(appName);
      setTraceFilters(nextFilters);
    });
    await runTraceSearch(nextFilters);
    switchTab("traces");
  }

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
    const stream = new EventSource(withApiKey("/api/v1/stream"));

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

  return {
    apps,
    connectionState,
    currentApp,
    currentTab,
    dashboard,
    openApiDetail,
    openAppApis,
    openAppTraces,
    openTraceDetail,
    overviewCards,
    runSqlSearch,
    runTraceSearch,
    selectedApiDetail,
    selectedApp,
    selectedTraceDetail,
    setSelectedApiDetail,
    setSelectedApp,
    setSqlFilters,
    setTraceFilters,
    sqlFilters,
    sqlSearchResults,
    switchTab,
    traceFilters,
    traceSearchResults
  };
}
