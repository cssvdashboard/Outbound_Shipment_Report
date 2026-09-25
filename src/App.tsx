import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLogisticsData } from './hooks/useLogisticsData';
import { Header } from './components/Header';
import { SmartFilterBar } from './components/SmartFilterBar';
import { BreakingNewsTicker } from './components/BreakingNewsTicker';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { DelayHub } from './components/DelayHub';
import { CountryMatrix } from './components/CountryMatrix';
import { CustomerComparison } from './components/CustomerComparison';
import { ShipmentExplorer } from './components/ShipmentExplorer';
import { CalendarComparison } from './components/CalendarComparison';
import { MonthlyComparison } from './components/MonthlyComparison';
import { CustomerSummaryModal } from './components/CustomerSummaryModal';
import { getStoredTheme, getStoredDisplayMode, setStoredDisplayMode, DisplayMode } from './services/storage';
import { applyThemeToDOM } from './components/ThemeModeMenu';
import { Loader2, Play, Pause, X, AlertTriangle, Tv } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => getStoredDisplayMode());
  const [isTvPaused, setIsTvPaused] = useState(false);
  const [tvSecondsRemaining, setTvSecondsRemaining] = useState(30);

  const {
    rawShipments,
    filteredShipments,
    updateShipmentDelay,
    syncWithExcelFiles,
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

  // Single Customer / Destination Summary Dossier Modal State
  const [isCustomerSummaryOpen, setIsCustomerSummaryOpen] = useState(false);
  const [customerSummaryTarget, setCustomerSummaryTarget] = useState<string>('');
  const [customerSummaryDestination, setCustomerSummaryDestination] = useState<string>('');

  const handleOpenCustomerSummary = (customer?: string, destination?: string) => {
    if (customer && customer !== 'ALL') {
      setCustomerSummaryTarget(customer);
    } else if (filters.selectedCustomers[0] && filters.selectedCustomers[0] !== 'ALL') {
      setCustomerSummaryTarget(filters.selectedCustomers[0]);
    } else {
      setCustomerSummaryTarget('');
    }

    if (destination && destination !== 'ALL') {
      setCustomerSummaryDestination(destination);
    } else if (filters.selectedDestinations[0] && filters.selectedDestinations[0] !== 'ALL') {
      setCustomerSummaryDestination(filters.selectedDestinations[0]);
    } else {
      setCustomerSummaryDestination('');
    }

    setIsCustomerSummaryOpen(true);
  };

  // 1b. Apply stored theme on initial app mount
  useEffect(() => {
    const currentTheme = getStoredTheme();
    applyThemeToDOM(currentTheme);
  }, []);

  const handleDisplayModeChange = (newMode: DisplayMode) => {
    setDisplayMode(newMode);
    setStoredDisplayMode(newMode);
    if (newMode === 'tv') {
      setIsTvPaused(false);
      setTvSecondsRemaining(15);
      setActiveTab('overview');
    }
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (displayMode === 'tv') {
      setTvSecondsRemaining(15);
      setIsTvPaused(false);
    }
  };

  // 1c. TV Wallboard auto-rotation loop (15s per slide in requested order)
  useEffect(() => {
    if (displayMode !== 'tv' || isTvPaused) return;

    const interval = setInterval(() => {
      setTvSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Requested sequence: Overview -> Destination Details -> Weekly TT -> Monthly comparison -> Shipment Explorer -> Shipper comparison -> delay analysis
          const tvTabs = ['overview', 'country', 'calendar', 'monthly', 'explorer', 'comparison', 'delays'];
          setActiveTab((curr) => {
            const currentIdx = tvTabs.indexOf(curr);
            const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % tvTabs.length;
            return tvTabs[nextIdx];
          });
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [displayMode, isTvPaused]);

  // 1c2. Spacebar shortcut to pause and resume in TV mode
  useEffect(() => {
    if (displayMode !== 'tv') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsTvPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayMode]);

  const displayedShipments = filteredShipments;

  // 2. Initialize state from URL Search Params (for shareable links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['overview', 'delays', 'country', 'comparison', 'explorer', 'calendar', 'monthly'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const custParam = params.get('cust');
    if (custParam) {
      setCustomerFilter(custParam);
    }
    const destParam = params.get('dest');
    if (destParam) {
      setDestinationFilter(destParam);
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
      params.set('cust', filters.selectedCustomers[0]);
    } else {
      params.delete('cust');
    }

    if (filters.selectedDestinations.length > 0) {
      params.set('dest', filters.selectedDestinations[0]);
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
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white ${
      displayMode === 'compact' ? 'mode-compact' : ''
    } ${displayMode === 'tv' ? 'mode-tv' : ''}`}>
      
      {/* TV Mode Top Progress Bar (15s per slide, toggleable via Spacebar) */}
      {displayMode === 'tv' && (
        <>
          <div 
            className={`tv-progress-bar ${isTvPaused ? '!bg-amber-400 opacity-70' : ''}`}
            style={{ 
              width: `${Math.min(100, Math.max(0, ((15 - tvSecondsRemaining) / 15) * 100))}%`,
              transition: isTvPaused || tvSecondsRemaining === 15 ? 'none' : 'width 1s linear'
            }}
          />
          {isTvPaused && (
            <div className="fixed top-2.5 right-4 z-50 px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-black/90 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Wallboard Paused</span>
              <span className="text-[10.5px] text-slate-400 font-normal">(Press Space to Resume)</span>
            </div>
          )}
        </>
      )}

      <div className="flex-1 flex flex-col">
        {/* 1. APP HEADER & NAVIGATION */}
        <Header
          datasetMeta={datasetMeta}
          totalFilteredCount={displayedShipments.length}
          totalRawCount={rawShipments.length}
          filteredShipments={displayedShipments}
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
          onSyncExcel={syncWithExcelFiles}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentMode={displayMode}
          onModeChange={handleDisplayModeChange}
        />

        {/* 1b. CONTINUOUS LIVE BREAKING NEWS INTEL TICKER */}
        <BreakingNewsTicker
          shipments={displayedShipments}
          rawShipments={rawShipments}
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
          onOpenCustomerSummary={handleOpenCustomerSummary}
          activeTab={activeTab}
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
                  filteredShipments={displayedShipments}
                  rawShipments={rawShipments}
                  selectedFinalResolution={filters.selectedFinalResolutions[0] || null}
                  selectedTTRange={filters.selectedTTRanges[0] || null}
                  selectedTTRanges={filters.selectedTTRanges}
                  onSelectResolution={setFinalResolutionFilter}
                  onSelectTTRange={setTTRangeFilter}
                  onNavigateTab={handleTabChange}
                />
              )}

              {activeTab === 'delays' && (
                <DelayHub
                  summary={summaryMetrics}
                  filteredShipments={displayedShipments}
                  allShipments={rawShipments}
                  transitDelays={transitDelaysBreakdown}
                  clearanceDelays={clearanceDelaysBreakdown}
                  destinationDelays={destinationDelaysBreakdown}
                  onSelectDelayFilter={setDelayFilter}
                  activeTransitFilter={filters.selectedTransitDelays}
                  activeClearanceFilter={filters.selectedClearanceDelays}
                  activeDestinationFilter={filters.selectedDestinationDelays}
                  onNavigateTab={handleTabChange}
                  onUpdateShipmentDelay={updateShipmentDelay}
                />
              )}

              {activeTab === 'country' && (
                <CountryMatrix
                  countryData={countryPerformance}
                  totalAWBs={displayedShipments.length}
                  shipments={displayedShipments}
                  rawShipments={rawShipments}
                />
              )}

              {activeTab === 'comparison' && (
                <CustomerComparison
                  shipments={displayedShipments}
                  rawShipments={rawShipments}
                  allDestinations={allDestinations}
                  allCustomers={allCustomers}
                  selectedCategoryType={filters.selectedCategoryType || 'ALL'}
                  onOpenCustomerSummary={handleOpenCustomerSummary}
                />
              )}

              {activeTab === 'explorer' && (
                <ShipmentExplorer
                  shipments={displayedShipments}
                  totalRawCount={rawShipments.length}
                  onUpdateShipmentDelay={updateShipmentDelay}
                  onOpenCustomerSummary={handleOpenCustomerSummary}
                />
              )}

              {activeTab === 'calendar' && (
                <CalendarComparison
                  shipments={displayedShipments}
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
                  filteredShipments={displayedShipments}
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

      {/* Customer / Destination Performance Summary Modal */}
      <CustomerSummaryModal
        isOpen={isCustomerSummaryOpen}
        onClose={() => setIsCustomerSummaryOpen(false)}
        shipments={rawShipments}
        initialCustomer={customerSummaryTarget}
        initialDestination={customerSummaryDestination}
        allCustomers={allCustomers}
        allDestinations={allDestinations}
        dateRange={dateRange || undefined}
      />

    </div>
  );
};
