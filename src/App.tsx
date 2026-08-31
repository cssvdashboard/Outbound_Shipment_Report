import React, { useState, useEffect } from 'react';
import { useLogisticsData } from './hooks/useLogisticsData';
import { Header } from './components/Header';
import { SmartFilterBar } from './components/SmartFilterBar';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { DelayHub } from './components/DelayHub';
import { CountryMatrix } from './components/CountryMatrix';
import { CustomerComparison } from './components/CustomerComparison';
import { ShipmentExplorer } from './components/ShipmentExplorer';
import { getStoredTheme, setStoredTheme } from './services/storage';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const {
    rawShipments,
    filteredShipments,
    datasetMeta,
    isLoading,
    isServerConnected,
    filters,
    setFilterMode,
    addShipperFilter,
    removeShipperFilter,
    addCustomerFilter,
    removeCustomerFilter,
    setCustomerFilter,
    setDestinationFilter,
    setFinalResolutionFilter,
    setTTRangeFilter,
    setDelayFilter,
    resetAllFilters,
    handleDatasetUpdate,
    handleResetToDefault,
    summaryMetrics,
    deliveryTimeline,
    finalResolutions,
    transitDelaysBreakdown,
    clearanceDelaysBreakdown,
    destinationDelaysBreakdown,
    countryPerformance,
    allDestinations,
    allCustomers
  } = useLogisticsData();

  // Initialize theme from storage
  useEffect(() => {
    const saved = getStoredTheme();
    setTheme(saved);
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 dark:from-[#080d19] dark:via-[#0b1120] dark:to-[#0f172a] text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-500 relative">
      
      {/* Eye-Soothing Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[15%] -left-[10%] w-[45vw] h-[45vw] rounded-full bg-blue-400/5 dark:bg-blue-600/10 blur-[130px]" />
        <div className="absolute top-[35%] -right-[10%] w-[40vw] h-[40vw] rounded-full bg-indigo-400/5 dark:bg-indigo-600/8 blur-[140px]" />
        <div className="absolute -bottom-[15%] left-[20%] w-[45vw] h-[45vw] rounded-full bg-cyan-400/5 dark:bg-cyan-600/8 blur-[150px]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* 1. STICKY APP HEADER */}
        <Header
          datasetMeta={datasetMeta}
          totalFilteredCount={filteredShipments.length}
          totalRawCount={rawShipments.length}
          filteredShipments={filteredShipments}
          theme={theme}
          isServerConnected={isServerConnected}
          onThemeToggle={handleThemeToggle}
          onDatasetUpdate={handleDatasetUpdate}
          onResetToDefault={handleResetToDefault}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* 2. CUSTOMER & DESTINATION FILTER BAR */}
        <SmartFilterBar
          rawShipments={rawShipments}
          filters={filters}
          onCustomerChange={setCustomerFilter}
          onDestinationChange={setDestinationFilter}
          onResetFilters={resetAllFilters}
          allCustomers={allCustomers}
          allDestinations={allDestinations}
        />

        {/* 3. MAIN DASHBOARD CONTENT */}
        <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Processing logistics records...
              </p>
            </div>
          ) : (
            <>
              {/* Active Tab View Rendering */}
              {activeTab === 'overview' && (
                <ExecutiveOverview
                  summary={summaryMetrics}
                  deliveryTimeline={deliveryTimeline}
                  finalResolutions={finalResolutions}
                  filteredShipments={filteredShipments}
                  rawShipments={rawShipments}
                  selectedFinalResolution={filters.selectedFinalResolutions[0] || null}
                  selectedTTRange={filters.selectedTTRanges[0] || null}
                  onSelectResolution={setFinalResolutionFilter}
                  onSelectTTRange={setTTRangeFilter}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'delays' && (
                <DelayHub
                  summary={summaryMetrics}
                  filteredShipments={filteredShipments}
                  transitDelays={transitDelaysBreakdown}
                  clearanceDelays={clearanceDelaysBreakdown}
                  destinationDelays={destinationDelaysBreakdown}
                  onSelectDelayFilter={setDelayFilter}
                  activeTransitFilter={filters.selectedTransitDelays}
                  activeClearanceFilter={filters.selectedClearanceDelays}
                  activeDestinationFilter={filters.selectedDestinationDelays}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'country' && (
                <CountryMatrix
                  countryData={countryPerformance}
                  totalAWBs={filteredShipments.length}
                  onSelectCountry={setDestinationFilter}
                  selectedDestination={filters.selectedDestinations[0] || null}
                />
              )}

              {activeTab === 'comparison' && (
                <CustomerComparison
                  rawShipments={rawShipments}
                  allDestinations={allDestinations}
                  allCustomers={allCustomers}
                />
              )}

              {activeTab === 'explorer' && (
                <ShipmentExplorer
                  shipments={filteredShipments}
                  totalRawCount={rawShipments.length}
                />
              )}
            </>
          )}

        </main>
      </div>

    </div>
  );
};
