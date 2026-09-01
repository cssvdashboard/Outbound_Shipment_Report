import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  Download,
  Globe,
  Clock,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  Plane,
  X,
  Eye,
  Calendar,
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  WEEKS_LIST,
  SingleWeekId,
  WEEKS_METADATA,
  MultiWeekMatrixSummary,
  computeMultiWeekDayMatrix,
  exportMultiWeekMatrixToExcel,
  exportMultiWeekMatrixToCSV,
  parsePickupDate,
  getWeekIdForDate,
  getDayOfWeek
} from '../utils/weeklyMatrixAnalytics';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  registerables
} from 'chart.js';

ChartJS.register(...registerables);

interface WeeklyMatrixViewProps {
  filteredShipments: Shipment[];
  rawShipments: Shipment[];
}

export const WeeklyMatrixView: React.FC<WeeklyMatrixViewProps> = ({
  filteredShipments,
  rawShipments
}) => {
  const [selectedDayFilter, setSelectedDayFilter] = useState<'ALL' | DayOfWeek>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'volume' | 'avgTT' | 'country'>('volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Cell Inspection Modal State
  const [inspectedCell, setInspectedCell] = useState<{
    country: string;
    day?: DayOfWeek;
    weekId?: SingleWeekId;
    dateLabel?: string;
    shipments: Shipment[];
  } | null>(null);

  // Compute Full Multi-Week Matrix (Wed..Tue x W1..W5)
  const matrixSummary: MultiWeekMatrixSummary = useMemo(() => {
    return computeMultiWeekDayMatrix(filteredShipments);
  }, [filteredShipments]);

  // Active Days to render based on user filter
  const activeDays: DayOfWeek[] = useMemo(() => {
    if (selectedDayFilter === 'ALL') return [...DAYS_OF_WEEK];
    return [selectedDayFilter];
  }, [selectedDayFilter]);

  // Filter & Sort Country Rows
  const displayedRows = useMemo(() => {
    let rows = matrixSummary.countryRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => r.country.toLowerCase().includes(q));
    }

    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'volume') {
        comparison = a.totalCount - b.totalCount;
      } else if (sortBy === 'avgTT') {
        comparison = a.totalAvgTT - b.totalAvgTT;
      } else {
        comparison = a.country.localeCompare(b.country);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [matrixSummary.countryRows, searchQuery, sortBy, sortOrder]);

  // Active toolbar filter check & Reset handler
  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'volume' || sortOrder !== 'desc' || selectedDayFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortBy('volume');
    setSortOrder('desc');
    setSelectedDayFilter('ALL');
  };

  // Handler to open AWB drill-down for a country on a specific day & week
  const handleInspectCell = (country: string, day: DayOfWeek, weekId: SingleWeekId) => {
    const matchingShipments = filteredShipments.filter((s) => {
      const destMatch = (s.destination || '').toUpperCase().trim() === country.toUpperCase().trim();
      if (!destMatch) return false;

      const d = parsePickupDate(s.pickup);
      if (!d) return false;

      return getWeekIdForDate(d) === weekId && getDayOfWeek(d) === day;
    });

    const wMeta = WEEKS_METADATA.find((w) => w.id === weekId);
    const dateLabel = wMeta?.dayDates[day] || '';

    setInspectedCell({
      country,
      day,
      weekId,
      dateLabel,
      shipments: matchingShipments
    });
  };

  // Handler to open AWB drill-down for whole country across all weeks
  const handleInspectCountryTotal = (country: string) => {
    const matchingShipments = filteredShipments.filter((s) => {
      const destMatch = (s.destination || '').toUpperCase().trim() === country.toUpperCase().trim();
      if (!destMatch) return false;

      const d = parsePickupDate(s.pickup);
      if (!d) return false;

      return getWeekIdForDate(d) !== 'W0';
    });

    setInspectedCell({
      country,
      shipments: matchingShipments
    });
  };

  // Daily Trend Comparison Chart Data (Across W1 to W5)
  const comparisonChartData = useMemo(() => {
    const labels = DAYS_OF_WEEK.map((d) => d.slice(0, 3));
    const colors = [
      { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.7)' },  // W1 Blue
      { border: '#10b981', bg: 'rgba(16, 185, 129, 0.7)' },  // W2 Green
      { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.7)' },  // W3 Amber
      { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.7)' },  // W4 Purple
      { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.7)' }    // W5 Rose
    ];

    const datasets = WEEKS_LIST.map((wId, idx) => {
      const data = DAYS_OF_WEEK.map((day) => {
        const cell = matrixSummary.dailyWeekTotals[day][wId];
        return cell.hasData && cell.count > 0 ? cell.avgTT : null;
      });

      return {
        label: `${wId} Avg TT`,
        data,
        borderColor: colors[idx].border,
        backgroundColor: colors[idx].bg,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.25,
        spanGaps: true
      };
    });

    return {
      labels,
      datasets
    };
  }, [matrixSummary]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
          usePointStyle: true,
          boxWidth: 8
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        padding: 10
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold' as const } }
      },
      y: {
        title: {
          display: true,
          text: 'Average Transit Time (Days)',
          color: '#94a3b8',
          font: { size: 10 }
        },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      }
    }
  };

  // Helper for TT cell badge color
  const getTTColorClass = (avgTT: number) => {
    if (avgTT <= 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (avgTT <= 8) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  // Day background tint for visual grouping
  const getDayHeaderBg = (dayIndex: number) => {
    return dayIndex % 2 === 0
      ? 'bg-slate-900/90 text-blue-300 border-blue-500/30'
      : 'bg-slate-900/50 text-indigo-300 border-indigo-500/30';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP HEADER & DAY JUMP CONTROLS */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-5 border border-slate-800/80 bg-slate-950/70">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 shadow-glow">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Delivery Comparison: Day-by-Day (W1 – W5 Side-by-Side)
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Compare Average, Min, and Max Transit Times across all 5 weekly dispatch cycles for every calendar day side by side.
                </p>
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => exportMultiWeekMatrixToExcel(matrixSummary)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Download complete Day-by-Day W1-W5 matrix as Excel file"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportMultiWeekMatrixToCSV(matrixSummary)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Download complete matrix as CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Day Jump / Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-bold text-slate-400 pr-2 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Day View:</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedDayFilter('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
              selectedDayFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border-blue-400 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            All Days (35 Columns Side-by-Side)
          </button>

          {DAYS_OF_WEEK.map((day) => {
            const isSelected = selectedDayFilter === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDayFilter(day)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 border-blue-400 font-black'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                {day} (W1–W5)
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC SUMMARY STRIP & MULTI-WEEK TREND CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Metric Cards (Left - 5 Cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          
          {/* Total July Volume */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Total Volume</span>
              <Plane className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {matrixSummary.totalShipments.toLocaleString()}
              </div>
              <span className="text-xs text-slate-400 font-semibold">July Dispatches (W1 – W5)</span>
            </div>
          </div>

          {/* Average Transit Time */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Month Avg TT</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">
                {matrixSummary.overallAvgTT} <span className="text-xs font-normal text-slate-400">days</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                Min: <strong className="text-slate-200">{matrixSummary.overallMinTT}d</strong> • Max: <strong className="text-slate-200">{matrixSummary.overallMaxTT}d</strong>
              </span>
            </div>
          </div>

          {/* Total Active Destinations */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Destinations</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                {matrixSummary.totalCountries}
              </div>
              <span className="text-xs text-slate-400 font-semibold">Active Destination Countries</span>
            </div>
          </div>

          {/* Calendar Days Matrix */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Matrix Scope</span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                35 <span className="text-xs font-normal text-slate-400">Slots</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">7 Days × 5 Weekly Cycles</span>
            </div>
          </div>

          {/* Info Banner */}
          <div className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/60 border border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-300">
                Weekly Cycles: <strong className="text-white">Wednesday → Tuesday</strong>
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-300 bg-blue-900/50 px-2.5 py-0.5 rounded-lg border border-blue-800">
              W1 (Jul 1) through W5 (Jul 31)
            </span>
          </div>

        </div>

        {/* Daily Trend Chart (Right - 7 Cols) */}
        <div className="lg:col-span-7 glass-card p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Weekly Day-by-Day Transit Time Progression (W1 to W5)
              </h3>
              <p className="text-[11px] text-slate-400">
                Comparing average transit time trajectories from Wednesday to Tuesday across all 5 weeks
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              5-Week Curve
            </span>
          </div>

          <div className="h-56 relative w-full">
            <Chart type="line" data={comparisonChartData as any} options={chartOptions as any} />
          </div>
        </div>

      </div>

      {/* 3. MULTI-WEEK SIDE-BY-SIDE COUNTRY MATRIX TABLE */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-4 border border-slate-800/80 bg-slate-950/80">
        
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          
          {/* Search Country */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destination country (e.g. US, GB, DE)..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort & Display Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-500 pl-2 font-medium">Sort:</span>
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'volume') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('volume'); setSortOrder('desc'); }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  sortBy === 'volume'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Volume {sortBy === 'volume' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'avgTT') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('avgTT'); setSortOrder('desc'); }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  sortBy === 'avgTT'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Avg TT {sortBy === 'avgTT' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (sortBy === 'country') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('country'); setSortOrder('asc'); }
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  sortBy === 'country'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Country {sortBy === 'country' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>

            {/* Reset Toolbar Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                hasActiveFilters
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:scale-[1.02] cursor-pointer shadow-sm'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-50 cursor-not-allowed'
              }`}
              title="Reset country search, filters, and sorting to default"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-rose-400' : 'text-slate-500'}`} />
              <span>Reset</span>
            </button>

            <div className="text-xs text-slate-400 font-semibold px-2">
              Showing <strong className="text-white">{displayedRows.length}</strong> of <strong className="text-white">{matrixSummary.totalCountries}</strong> countries
            </div>
          </div>

        </div>

        {/* High-Density Multi-Week Horizontal Matrix Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 relative shadow-inner max-h-[700px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse border-spacing-0">
            <thead className="sticky top-0 z-30 shadow-md">
              
              {/* Row 1 of Headers: Day of Week Groups (Wednesday, Thursday, Friday, etc.) */}
              <tr className="bg-slate-950 text-[11px] uppercase tracking-wider font-black text-slate-300 border-b border-slate-800">
                
                {/* Fixed Column 1: Country */}
                <th
                  rowSpan={2}
                  className="py-3 px-4 w-36 min-w-[140px] sticky left-0 z-40 bg-slate-950 border-r-2 border-slate-700 shadow-xl"
                >
                  <div className="text-white font-black flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Country</span>
                  </div>
                </th>

                {/* Column 2: Month Total (Scrolls naturally) */}
                <th
                  rowSpan={2}
                  className="py-3 px-3 w-28 min-w-[110px] text-center bg-slate-950/90 border-r-2 border-slate-700 text-slate-300 font-black"
                >
                  <div>Month Total</div>
                  <span className="text-[10px] text-slate-500 font-normal">July AWBs</span>
                </th>

                {/* Day Header Super-Columns (Colspan 5 each for W1..W5) */}
                {activeDays.map((day, dIdx) => {
                  return (
                    <th
                      key={day}
                      colSpan={WEEKS_LIST.length}
                      className={`py-2 px-3 text-center border-r-2 border-slate-700 ${getDayHeaderBg(dIdx)}`}
                    >
                      <div className="font-black text-sm tracking-wide flex items-center justify-center gap-1.5">
                        <span>{day.toUpperCase()}</span>
                      </div>
                    </th>
                  );
                })}

              </tr>

              {/* Row 2 of Headers: Sub-columns (W1 Wed, W2 Wed, W3 Wed, etc.) */}
              <tr className="bg-slate-900/95 text-[10px] uppercase font-black text-slate-400 border-b-2 border-slate-700">
                {activeDays.map((day) => {
                  return WEEKS_LIST.map((wId) => {
                    const wMeta = WEEKS_METADATA.find((w) => w.id === wId);
                    const dateLabel = wMeta?.dayDates[day] || '';
                    return (
                      <th
                        key={`${day}-${wId}`}
                        className="py-2 px-2 text-center min-w-[90px] border-r border-slate-800 bg-slate-900/90 last:border-r-2 last:border-slate-700"
                      >
                        <div className="text-white font-black">{wId}</div>
                        <div className="text-[9px] font-mono text-blue-400 font-semibold">{dateLabel}</div>
                      </th>
                    );
                  });
                })}
              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {displayedRows.length > 0 ? (
                displayedRows.map((row, idx) => {
                  return (
                    <tr
                      key={row.country}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Fixed Column 1: Country Name (Sticky on Left) */}
                      <td
                        onClick={() => handleInspectCountryTotal(row.country)}
                        className="py-2.5 px-4 w-36 min-w-[140px] sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900 border-r-2 border-slate-700 shadow-xl transition-colors cursor-pointer"
                        title={`Click to view all ${row.totalCount} shipments for ${row.country}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono w-4">
                              {idx + 1}.
                            </span>
                            <span className="font-mono font-black text-sm text-white group-hover:text-blue-400 transition-colors">
                              {row.country}
                            </span>
                          </div>
                          <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                        </div>
                      </td>

                      {/* Column 2: Total Volume & Avg TT (Scrolls naturally) */}
                      <td
                        onClick={() => handleInspectCountryTotal(row.country)}
                        className="py-2 px-3 w-28 min-w-[110px] text-center border-r-2 border-slate-700 bg-slate-950/40 group-hover:bg-slate-900/60 transition-colors cursor-pointer font-mono"
                      >
                        <div className="font-extrabold text-white text-xs">
                          {row.totalCount.toLocaleString()}
                        </div>
                        <div className={`text-[11px] font-bold ${
                          row.totalAvgTT <= 5 ? 'text-emerald-400' : row.totalAvgTT <= 8 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {row.totalAvgTT}d avg
                        </div>
                      </td>

                      {/* 35 Day-Week Cells (W1..W5 for each Day) */}
                      {activeDays.map((day) => {
                        return WEEKS_LIST.map((wId) => {
                          const cell = row.dayWeekMetrics[day][wId];
                          return (
                            <td
                              key={`${row.country}-${day}-${wId}`}
                              onClick={() => cell.hasData && cell.count > 0 && handleInspectCell(row.country, day, wId)}
                              className={`py-1.5 px-1.5 text-center border-r border-slate-800/60 last:border-r-2 last:border-slate-700 transition-colors ${
                                cell.hasData && cell.count > 0 ? 'hover:bg-blue-600/15 cursor-pointer' : ''
                              }`}
                              title={cell.hasData && cell.count > 0 ? `Click to view ${cell.count} AWBs for ${row.country} on ${day} (${wId})` : undefined}
                            >
                              {cell.hasData && cell.count > 0 ? (
                                <div className="p-1 rounded-lg transition-all hover:scale-[1.03]">
                                  <div className={`inline-block px-1.5 py-0.5 rounded font-mono font-black text-xs border shadow-sm ${getTTColorClass(cell.avgTT)}`}>
                                    {cell.avgTT}d
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {cell.minTT}d – {cell.maxTT}d
                                  </div>
                                  <div className="text-[9px] text-slate-500 font-semibold">
                                    {cell.count} {cell.count === 1 ? 'AWB' : 'AWBs'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-700 font-mono text-xs">-</span>
                              )}
                            </td>
                          );
                        });
                      })}

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={37} className="py-12 text-center text-slate-400 space-y-1">
                    <p className="font-bold">No countries found matching &quot;{searchQuery}&quot;</p>
                    <p className="text-xs text-slate-500">Try searching for a different country code.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend / Color Code Guide */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-300">Transit Time Color Guide:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>≤ 5.0 Days (Fast / On-Time)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>5.1 – 8.0 Days (Moderate Delay)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>&gt; 8.0 Days (High Delay)</span>
            </div>
          </div>

          <span className="text-slate-400 text-[11px]">
            ← Scroll horizontally to view all calendar days (Wednesday through Tuesday) • Country column remains frozen on the left →
          </span>
        </div>

      </div>

      {/* 4. AWB LIST DRILL-DOWN MODAL */}
      {inspectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-[96vw] 2xl:max-w-[1550px] max-h-[92vh] p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden bg-slate-950/95 border border-slate-700">
            
            {/* Modal Header */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {inspectedCell.weekId || 'All Weeks'} • {inspectedCell.country}
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        {inspectedCell.country} {inspectedCell.day ? `• ${inspectedCell.day} (${inspectedCell.weekId} - ${inspectedCell.dateLabel})` : '• Full Month'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {inspectedCell.shipments.length.toLocaleString()} Total AWBs
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Showing individual shipment records dispatched for {inspectedCell.country} on {inspectedCell.day || 'all days'}.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedCell(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Table Container */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 my-3">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">AWB Tracking #</th>
                    <th className="py-2.5 px-3">Customer Account</th>
                    <th className="py-2.5 px-3">Shipper Name</th>
                    <th className="py-2.5 px-3">Recipient / City</th>
                    <th className="py-2.5 px-3 text-right">TT (Days)</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-center">Final Resolution</th>
                    <th className="py-2.5 px-3">Delay Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {inspectedCell.shipments.map((s, idx) => (
                    <tr key={`${s.awb}-${idx}`} className="hover:bg-slate-800/50 transition-colors text-slate-200">
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                        {s.awb}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200 max-w-[160px] truncate" title={s.customer}>
                        {s.customer}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-[150px] truncate" title={s.shprName}>
                        {s.shprName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[150px] truncate">
                        <div>{s.recipient || '-'}</div>
                        <div className="text-[10px] text-slate-500">{s.city}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-400">
                        {s.tt}d
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          (s.shipmentType || 'PP').toUpperCase() === 'CC'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {s.shipmentType || 'PP'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.finalResolution?.toLowerCase() === 'delivered'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {s.finalResolution || 'Delivered'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">
                        {s.destinationDelay || s.transitDelay || s.clearanceDelay || s.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedCell(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
