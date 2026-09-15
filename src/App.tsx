import React, { useState, useEffect, useMemo, useRef } from 'react';
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
      setTvSecondsRemaining(30);
    }
  };

  // 1c. TV Wallboard auto-rotation loop
  useEffect(() => {
    if (displayMode !== 'tv' || isTvPaused) return;

    const interval = setInterval(() => {
      setTvSecondsRemaining((prev) => {
        if (prev <= 1) {
          const tvTabs = ['overview', 'delays', 'country', 'comparison', 'explorer'];
          setActiveTab((curr) => {
            const nextIdx = (tvTabs.indexOf(curr) + 1) % tvTabs.length;
            return tvTabs[nextIdx];
          });
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [displayMode, isTvPaused]);

  // 1d. Incident Mode Filter: isolates active delayed & exception shipments
  const displayedShipments = useMemo(() => {
    if (displayMode === 'incident') {
      return filteredShipments.filter((s) => {
        const isDelayedTT = s.tt > 5;
        const isNotDelivered = s.finalResolution && s.finalResolution !== 'Delivered';
        const hasClearance = s.clearanceDelay && s.clearanceDelay !== '-';
        const hasTransit = s.transitDelay && s.transitDelay !== '-';
        const hasDestDelay = s.destinationDelay && s.destinationDelay !== '-';
        return isDelayedTT || isNotDelivered || hasClearance || hasTransit || hasDestDelay;
      });
    }
    return filteredShipments;
  }, [filteredShipments, displayMode]);

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
    } ${displayMode === 'tv' ? 'mode-tv' : ''} ${displayMode === 'incident' ? 'mode-incident' : ''}`}>
      
      {/* TV Mode Top Progress Bar */}
      {displayMode === 'tv' && !isTvPaused && (
        <div 
          className="tv-progress-bar"
          style={{ width: `${((30 - tvSecondsRemaining) / 30) * 100}%` }}
        />
      )}

      {/* TV Wallboard Floating Control Widget */}
      {displayMode === 'tv' && (
        <aside 
          aria-label="TV Wallboard Controls"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 dark:bg-[#070d1e]/95 text-white border-2 border-sky-500/60 shadow-2xl backdrop-blur-md animate-fade-in"
        >
          <div className="flex items-center gap-1.5">
            <Tv className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider text-sky-300">Wallboard</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-xs font-mono font-bold text-slate-200">
            {isTvPaused ? 'Paused' : `Next in ${tvSecondsRemaining}s`}
          </span>
          <button
            onClick={() => setIsTvPaused(!isTvPaused)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title={isTvPaused ? 'Resume Rotation' : 'Pause Rotation'}
          >
            {isTvPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          </button>
          <button
            onClick={() => handleDisplayModeChange('standard')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
            title="Exit Wallboard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
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
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentMode={displayMode}
          onModeChange={handleDisplayModeChange}
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

        {/* 2b. INCIDENT MODE ACTIVE BANNER */}
        {displayMode === 'incident' && (
          <div className="max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-400/80 dark:bg-rose-950/40 dark:border-rose-500/60 text-rose-900 dark:text-rose-200 shadow-lg incident-active-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-sm font-black flex items-center gap-2">
                    <span>Incident &amp; Exception Triage Mode Active</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold">
                      {displayedShipments.length} Exceptions Found
                    </span>
                  </div>
                  <div className="text-xs text-rose-700 dark:text-rose-300/80 font-medium">
                    Filtered out on-time shipments. Showing only shipments with TT &gt; 5 days, RTS, Customs Holds, and Transit delays.
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDisplayModeChange('standard')}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs ml-3"
              >
                Exit Triage Mode
              </button>
            </div>
          </div>
        )}

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
                  onSelectResolution={setFinalResolutionFilter}
                  onSelectTTRange={setTTRangeFilter}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'delays' && (
                <DelayHub
                  summary={summaryMetrics}
                  filteredShipments={displayedShipments}
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
                />
              )}

              {activeTab === 'explorer' && (
                <ShipmentExplorer
                  shipments={displayedShipments}
                  totalRawCount={rawShipments.length}
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

    </div>
  );
};
