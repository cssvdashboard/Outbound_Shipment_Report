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
    setCategoryTypeFilter,
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
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setStoredTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <div className="flex-1 flex flex-col">
        {/* 1. APP HEADER & NAVIGATION */}
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

        {/* 2. CUSTOMER, DESTINATION & QUICK CATEGORY FILTER BAR */}
        <SmartFilterBar
          rawShipments={rawShipments}
          filters={filters}
          onCustomerChange={setCustomerFilter}
          onDestinationChange={setDestinationFilter}
          onCategoryTypeChange={setCategoryTypeFilter}
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
                  shipments={filteredShipments}
                  rawShipments={rawShipments}
                  allDestinations={allDestinations}
                  allCustomers={allCustomers}
                  selectedCategoryType={filters.selectedCategoryType || 'ALL'}
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
