import HeroHeader from "./components/layout/HeroHeader.jsx";
import TabNav from "./components/layout/TabNav.jsx";
import ApisView from "./components/views/ApisView.jsx";
import DashboardView from "./components/views/DashboardView.jsx";
import SqlView from "./components/views/SqlView.jsx";
import TracesView from "./components/views/TracesView.jsx";
import { useApmDashboard } from "./hooks/use-apm-dashboard.js";

export default function App() {
  const {
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
    selectedDate,
    selectedTraceDetail,
    setSelectedApiDetail,
    setSelectedApp,
    setSelectedDate,
    setSqlFilters,
    setTraceFilters,
    sqlFilters,
    sqlSearchResults,
    switchTab,
    traceFilters,
    traceSearchResults
  } = useApmDashboard();

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1360px] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <HeroHeader
        connectionState={connectionState}
        generatedAt={dashboard?.generatedAt}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <TabNav currentTab={currentTab} onChange={switchTab} />

      <main className="mt-5 flex flex-col gap-6">
        {currentTab === "dashboard" ? (
          <DashboardView
            apps={apps}
            currentApp={currentApp}
            dashboard={dashboard}
            overviewCards={overviewCards}
            onOpenApis={openAppApis}
            onOpenTrace={openTraceDetail}
            onOpenTraces={openAppTraces}
            onSelectApp={setSelectedApp}
          />
        ) : null}

        {currentTab === "apis" ? (
          <ApisView
            apps={apps}
            currentApp={currentApp}
            selectedApiDetail={selectedApiDetail}
            onOpenApi={openApiDetail}
            onOpenTrace={openTraceDetail}
            onResetDetail={() => setSelectedApiDetail(null)}
            onSelectApp={setSelectedApp}
          />
        ) : null}

        {currentTab === "sql" ? (
          <SqlView
            apps={apps}
            filters={sqlFilters}
            onChangeFilters={setSqlFilters}
            onOpenTrace={openTraceDetail}
            onSearch={runSqlSearch}
            onSwitchToTraceTab={() => switchTab("traces")}
            results={sqlSearchResults}
            selectedTraceDetail={selectedTraceDetail}
          />
        ) : null}

        {currentTab === "traces" ? (
          <TracesView
            apps={apps}
            filters={traceFilters}
            onChangeFilters={setTraceFilters}
            onOpenTrace={openTraceDetail}
            onSearch={runTraceSearch}
            results={traceSearchResults}
            selectedTraceDetail={selectedTraceDetail}
          />
        ) : null}
      </main>
    </div>
  );
}
