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
import { Loader2, Package, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const {
    rawShipments,
    filteredShipments,
    datasetMeta,
    isLoading,
    filters,
    setFilterMode,
    addShipperFilter,
    removeShipperFilter,
    addCustomerFilter,
    removeCustomerFilter,
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
    <div className="min-h-screen bg-[#090d16] text-slate-100 dark:bg-[#090d16] dark:text-slate-100 light:bg-slate-50 light:text-slate-900 transition-colors duration-300 flex flex-col font-sans">
      
      {/* 1. STICKY APP HEADER */}
      <Header
        datasetMeta={datasetMeta}
        totalFilteredCount={filteredShipments.length}
        totalRawCount={rawShipments.length}
        filteredShipments={filteredShipments}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onDatasetUpdate={handleDatasetUpdate}
        onResetToDefault={handleResetToDefault}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 2. SMART FILTER & AUTOCOMPLETE BAR */}
      <SmartFilterBar
        rawShipments={rawShipments}
        filters={filters}
        onFilterModeChange={setFilterMode}
        onAddShipper={addShipperFilter}
        onRemoveShipper={removeShipperFilter}
        onAddCustomer={addCustomerFilter}
        onRemoveCustomer={removeCustomerFilter}
        onDestinationChange={setDestinationFilter}
        onResetFilters={resetAllFilters}
        allDestinations={allDestinations}
      />

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-400">
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

      {/* 4. FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 dark:bg-slate-950/60 light:bg-white light:border-slate-200 py-4 mt-auto text-xs text-slate-500">
        <div className="max-w-[1700px] mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-400 light:text-slate-600">TransitPulse Intelligence Engine</span>
            <span>•</span>
            <span>Sub-millisecond In-Memory Analytics</span>
          </div>
          <div>
            Data is parsed 100% locally in your browser. No files are uploaded to external servers.
          </div>
        </div>
      </footer>

    </div>
  );
};
