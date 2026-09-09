import React, { useState, useEffect } from 'react';
import { useLogisticsData } from './hooks/useLogisticsData';
import { Header } from './components/Header';
import { SmartFilterBar } from './components/SmartFilterBar';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { DelayHub } from './components/DelayHub';
import { CountryMatrix } from './components/CountryMatrix';
import { CustomerComparison } from './components/CustomerComparison';
import { ShipmentExplorer } from './components/ShipmentExplorer';
import { CalendarComparison } from './components/CalendarComparison';
import { MonthlyComparison } from './components/MonthlyComparison';
import { getStoredTheme, setStoredTheme } from './services/storage';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');

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
    toggleCustomerFilter,
    setCustomerFilter,
    addDestinationFilter,
    removeDestinationFilter,
    toggleDestinationFilter,
    setDestinationFilter,
    setCategoryTypeFilter,
    setFinalResolutionFilter,
    setTTRangeFilter,
    setDelayFilter,
    setMonthFilter,
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
    allCustomers,
    allMonths,
    dateRange,
    setDateRangeFilter,
    availableDateRange,
    availablePickupDates
  } = useLogisticsData();

  // 2. Initialize state from URL Search Params (for shareable links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['overview', 'delays', 'country', 'comparison', 'explorer', 'calendar', 'monthly'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const custParam = params.get('cust');
    if (custParam) {
      const custs = custParam.split('||').map(s => s.trim()).filter(Boolean);
      if (custs.length > 0) setCustomerFilter(custs);
    }
    const destParam = params.get('dest');
    if (destParam) {
      const dests = destParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (dests.length > 0) setDestinationFilter(dests);
    }
    const catParam = params.get('cat');
    if (catParam && ['ALL', 'AGENT', 'PP', 'CC'].includes(catParam)) {
      setCategoryTypeFilter(catParam as any);
    }
    const fromParam = params.get('from');
    const toParam = params.get('to');
    if (fromParam && toParam) {
      setDateRangeFilter(fromParam, toParam);
    }
  }, []);

  // 3. Keep URL query parameters in sync with active tab and filters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    
    if (filters.selectedCustomers.length > 0) {
      // Use || delimiter for customers because customer names might contain commas
      params.set('cust', filters.selectedCustomers.join('||'));
    } else {
      params.delete('cust');
    }

    if (filters.selectedDestinations.length > 0) {
      params.set('dest', filters.selectedDestinations.join(','));
    } else {
      params.delete('dest');
    }

    if (filters.selectedCategoryType && filters.selectedCategoryType !== 'ALL') {
      params.set('cat', filters.selectedCategoryType);
    } else {
      params.delete('cat');
    }

    if (filters.dateRange?.start && filters.dateRange?.end) {
      params.set('from', filters.dateRange.start);
      params.set('to', filters.dateRange.end);
    } else {
      params.delete('from');
      params.delete('to');
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab, filters.selectedCustomers, filters.selectedDestinations, filters.selectedCategoryType, filters.dateRange?.start, filters.dateRange?.end]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <div className="flex-1 flex flex-col">
        {/* 1. APP HEADER & NAVIGATION */}
        <Header
          datasetMeta={datasetMeta}
          totalFilteredCount={filteredShipments.length}
          totalRawCount={rawShipments.length}
          filteredShipments={filteredShipments}
          isServerConnected={isServerConnected}
          dateRange={dateRange || { start: '', end: '' }}
          onDateRangeChange={setDateRangeFilter}
          availableDateRange={availableDateRange}
          availablePickupDates={availablePickupDates}
          allMonths={allMonths}
          selectedMonth={filters.selectedMonth || 'ALL'}
          onMonthChange={setMonthFilter}
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
          onCustomerToggle={toggleCustomerFilter}
          onDestinationToggle={toggleDestinationFilter}
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
                  shipments={filteredShipments}
                  rawShipments={rawShipments}
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

              {activeTab === 'calendar' && (
                <CalendarComparison
                  shipments={filteredShipments}
                  rawShipments={rawShipments}
                  allDestinations={allDestinations}
                  allCustomers={allCustomers}
                  selectedCustomerFromParent={filters.selectedCustomers[0] || ''}
                  selectedDestinationFromParent={filters.selectedDestinations[0] || ''}
                  selectedMonthFromParent={filters.selectedMonth || 'ALL'}
                  selectedCategoryType={filters.selectedCategoryType || 'ALL'}
                  onCustomerChange={setCustomerFilter}
                  onDestinationChange={setDestinationFilter}
                  onMonthChange={setMonthFilter}
                />
              )}

              {activeTab === 'monthly' && (
                <MonthlyComparison
                  rawShipments={rawShipments}
                  filteredShipments={filteredShipments}
                  filters={filters}
                  allCustomers={allCustomers}
                  allDestinations={allDestinations}
                  allMonths={allMonths}
                  onCustomerChange={setCustomerFilter}
                  onDestinationChange={setDestinationFilter}
                  onResetFilters={resetAllFilters}
                />
              )}
            </>
          )}

        </main>
      </div>

    </div>
  );
};
