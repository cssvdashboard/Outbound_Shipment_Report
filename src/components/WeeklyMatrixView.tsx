import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Search,
  Download,
  Globe,
  Clock,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Plane,
  X,
  Eye,
  Calendar,
  Layers,
  RotateCcw
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  WeekId,
  WEEKS_METADATA,
  WeeklyMatrixSummary,
  computeWeeklyCountryMatrix,
  exportMatrixToExcel,
  exportMatrixToCSV,
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
  const [selectedWeek, setSelectedWeek] = useState<WeekId>('W1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'volume' | 'avgTT' | 'country'>('volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMetric, setViewMetric] = useState<'all' | 'avg' | 'minmax'>('all');

  // Cell Inspection Modal State
  const [inspectedCell, setInspectedCell] = useState<{
    country: string;
    day?: DayOfWeek;
    dateLabel?: string;
    shipments: Shipment[];
  } | null>(null);

  // Active table filter state & reset handler
  const hasActiveTableFilters = searchQuery.trim() !== '' || sortBy !== 'volume' || sortOrder !== 'desc';

  const handleResetTableFilters = () => {
    setSearchQuery('');
    setSortBy('volume');
    setSortOrder('desc');
  };

  // Compute Weekly Matrix for the chosen week
  const matrixSummary: WeeklyMatrixSummary = useMemo(() => {
    return computeWeeklyCountryMatrix(filteredShipments, selectedWeek);
  }, [filteredShipments, selectedWeek]);

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

  // Handler to open AWB drill-down modal for a country + specific day
  const handleInspectCell = (country: string, day: DayOfWeek) => {
    const weekShipments = filteredShipments.filter((s) => {
      const destMatch = (s.destination || '').toUpperCase().trim() === country.toUpperCase().trim();
      if (!destMatch) return false;

      const d = parsePickupDate(s.pickup);
      if (!d) return false;

      const wId = getWeekIdForDate(d);
      const isWeekMatch = selectedWeek === 'ALL' ? wId !== 'W0' : wId === selectedWeek;
      if (!isWeekMatch) return false;

      return getDayOfWeek(d) === day;
    });

    const dateLabel = matrixSummary.weekMetadata.dayDates[day];
    setInspectedCell({
      country,
      day,
      dateLabel,
      shipments: weekShipments
    });
  };

  // Handler to open AWB drill-down for whole country in that week
  const handleInspectCountryTotal = (country: string) => {
    const weekShipments = filteredShipments.filter((s) => {
      const destMatch = (s.destination || '').toUpperCase().trim() === country.toUpperCase().trim();
      if (!destMatch) return false;

      const d = parsePickupDate(s.pickup);
      if (!d) return false;

      const wId = getWeekIdForDate(d);
      return selectedWeek === 'ALL' ? wId !== 'W0' : wId === selectedWeek;
    });

    setInspectedCell({
      country,
      shipments: weekShipments
    });
  };

  // Daily Trend Chart Data
  const dailyChartData = useMemo(() => {
    const labels = DAYS_OF_WEEK.map((day) => {
      const dateLabel = matrixSummary.weekMetadata.dayDates[day];
      return `${day.slice(0, 3)} (${dateLabel})`;
    });

    const avgTTData = DAYS_OF_WEEK.map((day) => matrixSummary.dailyTotals[day].avgTT);
    const volumeData = DAYS_OF_WEEK.map((day) => matrixSummary.dailyTotals[day].count);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Average Transit Time (Days)',
          data: avgTTData,
          backgroundColor: avgTTData.map((tt) =>
            tt <= 5 ? 'rgba(16, 185, 129, 0.75)' : tt <= 8 ? 'rgba(245, 158, 11, 0.75)' : 'rgba(244, 63, 94, 0.75)'
          ),
          borderColor: avgTTData.map((tt) =>
            tt <= 5 ? '#10b981' : tt <= 8 ? '#f59e0b' : '#f43f5e'
          ),
          borderWidth: 1,
          borderRadius: 8,
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: 'Shipment Volume (AWBs)',
          data: volumeData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderWidth: 2,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 4,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    };
  }, [matrixSummary]);

  const dailyChartOptions = {
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
        ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' as const } }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Avg TT (Days)',
          color: '#94a3b8',
          font: { size: 10 }
        },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Volume (AWBs)',
          color: '#38bdf8',
          font: { size: 10 }
        },
        grid: { drawOnChartArea: false },
        ticks: { color: '#38bdf8', font: { size: 10 } }
      }
    }
  };

  // Helper for TT cell badge color
  const getTTColorClass = (avgTT: number) => {
    if (avgTT <= 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (avgTT <= 8) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP HEADER & WEEK SELECTION TABS */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-5 border border-slate-800/80 bg-slate-950/70">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 shadow-glow">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  Weekly Day-by-Day Transit Time Matrix
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Analyze Average, Min, and Max Transit Times across calendar days (Wednesday – Tuesday) for all countries.
                </p>
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => exportMatrixToExcel(matrixSummary)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Download full matrix as Excel file"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportMatrixToCSV(matrixSummary)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Download full matrix as CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Week Selector Tab Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {WEEKS_METADATA.map((w) => {
            const isSelected = selectedWeek === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeek(w.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border-blue-400 font-black scale-[1.02]'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                <span>{w.label}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {w.dateRange}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC SUMMARY STRIP & DAILY TREND CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Metric Cards (Left - 5 Cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
          
          {/* Total Volume */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Total Volume</span>
              <Plane className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {matrixSummary.totalShipments.toLocaleString()}
              </div>
              <span className="text-xs text-slate-400 font-semibold">Impacted AWBs ({matrixSummary.weekId})</span>
            </div>
          </div>

          {/* Average Transit Time */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Average Transit Time</span>
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

          {/* On-Time Rate */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">On-Time (≤5d) Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {matrixSummary.onTimeRate}%
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                {matrixSummary.onTimeCount.toLocaleString()} on-time AWBs
              </span>
            </div>
          </div>

          {/* Active Destinations */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Destinations</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                {matrixSummary.totalCountries}
              </div>
              <span className="text-xs text-slate-400 font-semibold">Active Countries</span>
            </div>
          </div>

          {/* Date Range Banner (Span 2) */}
          <div className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/60 border border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-300">
                Cycle: <strong className="text-white">{matrixSummary.weekMetadata.label}</strong>
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-300 bg-blue-900/50 px-2.5 py-0.5 rounded-lg border border-blue-800">
              {matrixSummary.weekMetadata.dateRange}
            </span>
          </div>

        </div>

        {/* Daily Trend Chart (Right - 7 Cols) */}
        <div className="lg:col-span-7 glass-card p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Day-by-Day Transit Time Progression (Wednesday → Tuesday)
              </h3>
              <p className="text-[11px] text-slate-400">
                Comparing daily average transit time against dispatch volume
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {matrixSummary.weekId}
            </span>
          </div>

          <div className="h-56 relative w-full">
            <Chart type="bar" data={dailyChartData as any} options={dailyChartOptions as any} />
          </div>
        </div>

      </div>

      {/* 3. COUNTRY MATRIX TABLE VIEW */}
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
              onClick={handleResetTableFilters}
              disabled={!hasActiveTableFilters}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                hasActiveTableFilters
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:scale-[1.02] cursor-pointer shadow-sm'
                  : 'bg-slate-900/60 text-slate-500 border-slate-800 opacity-50 cursor-not-allowed'
              }`}
              title="Reset country search and sorting to default"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${hasActiveTableFilters ? 'text-rose-400' : 'text-slate-500'}`} />
              <span>Reset</span>
            </button>

            <div className="text-xs text-slate-400 font-semibold px-2">
              Showing <strong className="text-white">{displayedRows.length}</strong> of <strong className="text-white">{matrixSummary.totalCountries}</strong> countries
            </div>
          </div>

        </div>

        {/* High Density Matrix Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              {/* Header Row: Column Titles with Specific Dates */}
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                <th className="py-3 px-4 w-48 sticky left-0 bg-slate-950 z-20 border-r border-slate-800">
                  Destination Country
                </th>
                <th className="py-3 px-3 w-28 text-center bg-slate-950/90 border-r border-slate-800">
                  Week Total
                </th>
                {DAYS_OF_WEEK.map((day) => {
                  const dateLabel = matrixSummary.weekMetadata.dayDates[day];
                  return (
                    <th key={day} className="py-3 px-3 text-center border-r border-slate-800/80 last:border-r-0">
                      <div className="font-extrabold text-slate-200">{day}</div>
                      <span className="text-[10px] font-mono text-blue-400 font-normal">
                        {dateLabel}
                      </span>
                    </th>
                  );
                })}
              </tr>

              {/* All-Country Weekly Aggregate Summary Header */}
              <tr className="bg-slate-900/90 border-b border-slate-700/80 text-xs font-bold text-white">
                <td className="py-3 px-4 sticky left-0 bg-slate-900 z-20 border-r border-slate-700/80">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-black text-blue-300">ALL COUNTRIES (AVG)</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-mono font-black border-r border-slate-700/80 bg-blue-950/20">
                  <div className="text-white">{matrixSummary.totalShipments.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">AWBs</span></div>
                  <div className="text-indigo-300 font-extrabold text-[11px]">{matrixSummary.overallAvgTT}d avg</div>
                </td>
                {DAYS_OF_WEEK.map((day) => {
                  const cell = matrixSummary.dailyTotals[day];
                  return (
                    <td key={day} className="py-2.5 px-3 text-center border-r border-slate-800 bg-slate-900/60 last:border-r-0">
                      {cell.hasData ? (
                        <div className="space-y-0.5">
                          <span className={`inline-block px-2 py-0.5 rounded-md font-mono font-black text-xs border ${getTTColorClass(cell.avgTT)}`}>
                            {cell.avgTT}d
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Min: {cell.minTT}d • Max: {cell.maxTT}d
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold">
                            {cell.count.toLocaleString()} AWBs
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-sans">
              {displayedRows.length > 0 ? (
                displayedRows.map((row, idx) => {
                  return (
                    <tr
                      key={row.country}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Country Column */}
                      <td
                        onClick={() => handleInspectCountryTotal(row.country)}
                        className="py-3 px-4 sticky left-0 bg-slate-950/95 group-hover:bg-slate-900 z-10 border-r border-slate-800 transition-colors cursor-pointer"
                        title={`Click to view all ${row.totalCount} shipments for ${row.country}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-mono w-5">
                              {idx + 1}.
                            </span>
                            <span className="font-mono font-black text-sm text-white group-hover:text-blue-400 transition-colors">
                              {row.country}
                            </span>
                          </div>
                          <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                        </div>
                      </td>

                      {/* Country Total Column */}
                      <td
                        onClick={() => handleInspectCountryTotal(row.country)}
                        className="py-2.5 px-3 text-center border-r border-slate-800/80 bg-slate-950/40 group-hover:bg-slate-900/60 cursor-pointer"
                      >
                        <div className="font-mono font-extrabold text-white text-xs">
                          {row.totalCount.toLocaleString()}
                        </div>
                        <div className={`font-mono text-[11px] font-bold ${
                          row.totalAvgTT <= 5 ? 'text-emerald-400' : row.totalAvgTT <= 8 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {row.totalAvgTT}d avg
                        </div>
                      </td>

                      {/* 7 Daily Cells */}
                      {DAYS_OF_WEEK.map((day) => {
                        const cell = row.dayMetrics[day];
                        return (
                          <td
                            key={day}
                            onClick={() => cell.hasData && handleInspectCell(row.country, day)}
                            className={`py-2 px-2.5 text-center border-r border-slate-800/60 last:border-r-0 transition-colors ${
                              cell.hasData ? 'hover:bg-blue-600/15 cursor-pointer' : ''
                            }`}
                            title={cell.hasData ? `Click to view ${cell.count} AWBs for ${row.country} on ${day}` : undefined}
                          >
                            {cell.hasData ? (
                              <div className="p-1.5 rounded-xl transition-all hover:scale-[1.02]">
                                <div className={`inline-block px-2 py-0.5 rounded-lg font-mono font-black text-xs border shadow-sm ${getTTColorClass(cell.avgTT)}`}>
                                  {cell.avgTT}d
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {cell.minTT}d – {cell.maxTT}d
                                </div>
                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                  {cell.count} {cell.count === 1 ? 'AWB' : 'AWBs'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-700 font-mono">-</span>
                            )}
                          </td>
                        );
                      })}

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 space-y-1">
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
            Click any cell or country to view the individual shipment records.
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
                        {selectedWeek} • {inspectedCell.country}
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        {inspectedCell.country} {inspectedCell.day ? `• ${inspectedCell.day} (${inspectedCell.dateLabel})` : '• Full Week'}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {inspectedCell.shipments.length.toLocaleString()} Total AWBs
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Showing individual shipment records dispatched for {inspectedCell.country} in {selectedWeek}.
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
