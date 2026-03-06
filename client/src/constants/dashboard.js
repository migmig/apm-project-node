export const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "apis", label: "APIs" },
  { id: "sql", label: "SQL" },
  { id: "traces", label: "Traces" }
];

export const dashboardCharts = [
  { key: "http.requests.total", label: "HTTP Throughput", unit: "req" },
  { key: "http.requests.avg_duration", label: "Latency", unit: "ms" },
  { key: "http.requests.error_rate", label: "Error Rate", unit: "%" },
  { key: "jvm.memory.heap.usage", label: "Heap Usage", unit: "%" },
  { key: "system.cpu.process_usage", label: "Process CPU", unit: "%" },
  { key: "sql.query.count", label: "SQL Throughput", unit: "q" }
];

export const apiCharts = [
  { key: "requestCount", label: "Request Count", unit: "req" },
  { key: "errorCount", label: "Error Count", unit: "err" },
  { key: "avgDuration", label: "Avg Duration", unit: "ms" }
];
