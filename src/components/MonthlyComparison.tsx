import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Percent,
  Package,
  Activity,
  BarChart3,
  BarChart2,
  CalendarDays,
  Calendar,
  Sparkles,
  Filter,
  Users,
  Globe,
  X,
  RotateCcw,
  Eye,
  Download,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Shipment, FilterState } from '../types/logistics';
import { computeMonthlyComparison, MonthlyMetric } from '../utils/monthlyAnalytics';
import { filterShipments } from '../utils/analytics';
import { computeCalendarMatrix, WeekStats } from '../utils/calendarAnalytics';
import { formatExcelDate, formatTT } from '../utils/formatters';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import * as XLSX from 'xlsx';

// Register Chart.js elements
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MonthlyComparisonProps {
  rawShipments: Shipment[];
  filteredShipments?: Shipment[];
  filters?: FilterState;
  allCustomers?: string[];
  allDestinations?: string[];
  allMonths?: string[];
  onCustomerChange?: (customer: string) => void;
  onDestinationChange?: (dest: string) => void;
  onResetFilters?: () => void;
}

// Curated palette for comparing up to 8 distinct months
const MONTH_PALETTES = [
  {
    name: 'Sky / Blue',
    bg: 'rgba(56, 189, 248, 0.85)',
    border: '#0284c7',
    gradient: 'from-sky-500/20 to-blue-600/10',
    borderClass: 'border-sky-500/40',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  },
  {
    name: 'Emerald / Green',
    bg: 'rgba(52, 211, 153, 0.85)',
    border: '#059669',
    gradient: 'from-emerald-500/20 to-teal-600/10',
    borderClass: 'border-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  {
    name: 'Violet / Purple',
    bg: 'rgba(167, 139, 250, 0.85)',
    border: '#7c3aed',
    gradient: 'from-violet-500/20 to-purple-600/10',
    borderClass: 'border-violet-500/40',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30'
  },
  {
    name: 'Amber / Orange',
    bg: 'rgba(251, 191, 36, 0.85)',
    border: '#d97706',
    gradient: 'from-amber-500/20 to-orange-600/10',
    borderClass: 'border-amber-500/40',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  {
    name: 'Rose / Pink',
    bg: 'rgba(251, 113, 133, 0.85)',
    border: '#e11d48',
    gradient: 'from-rose-500/20 to-pink-600/10',
    borderClass: 'border-rose-500/40',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  }
];

export const MonthlyComparison: React.FC<MonthlyComparisonProps> = ({
  rawShipments,
  filteredShipments,
  filters,
  allMonths,
  onCustomerChange,
  onDestinationChange,
  onResetFilters
}) => {
  // Extract active customer and destination filters
  const selectedCustomer = filters?.selectedCustomers?.[0] || '';
  const selectedDestination = filters?.selectedDestinations?.[0] || '';
  const selectedCategoryType = filters?.selectedCategoryType || 'ALL';
  const hasActiveFilters = Boolean(
    selectedCustomer ||
    selectedDestination ||
    (selectedCategoryType && selectedCategoryType !== 'ALL') ||
    (filters?.selectedShippers && filters.selectedShippers.length > 0)
  );

  // Compute filtered dataset across all months for the comparative analysis
  const effectiveShipments = useMemo(() => {
    if (!filters) {
      return filteredShipments && filteredShipments.length > 0 ? filteredShipments : rawShipments;
    }

    // Apply customer, destination, category, shipper, and delay filters
    // Keep selectedMonth: 'ALL' so all tracked months (e.g. July & August) are compared side-by-side!
    const comparisonFilters: FilterState = {
      ...filters,
      selectedMonth: 'ALL'
    };

    return filterShipments(rawShipments, comparisonFilters);
  }, [rawShipments, filteredShipments, filters]);

  const comparison = useMemo(() => {
    return computeMonthlyComparison(effectiveShipments, allMonths);
  }, [effectiveShipments, allMonths]);

  const { months, grandTotalAWBs, overallAvgTT, overallOnTimeRate } = comparison;

  // Chart configuration: Grouped Bar Chart for Weekly TT Comparison (W1–W4/W5)
  const weeklyChartData = useMemo(() => {
    const labels = ['Week 1 (Days 1–7)', 'Week 2 (Days 8–14)', 'Week 3 (Days 15–21)', 'Week 4 (Days 22–28)', 'Week 5 (Days 29+)'];

    const datasets = months.map((m, idx) => {
      const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
      return {
        label: m.monthLabel,
        data: [1, 2, 3, 4, 5].map((w) => m.weeks[w]?.avgTT || 0),
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1.5,
        borderRadius: 8,
        hoverBackgroundColor: palette.border
      };
    });

    return { labels, datasets };
  }, [months]);

  const weeklyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { weight: 'bold' as const, size: 12 },
          padding: 16,
          usePointStyle: true,
          boxWidth: 10
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            const monthIdx = context.datasetIndex;
            const weekNum = context.dataIndex + 1;
            const monthObj = months[monthIdx];
            const weekStats = monthObj?.weeks[weekNum];
            const countStr = weekStats?.count ? ` (${weekStats.count.toLocaleString()} pkgs)` : '';
            return ` ${context.dataset.label}: ${val.toFixed(2)} days${countStr}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { weight: 'bold' as const, size: 11 } }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Average Transit Time (Days)',
          color: '#94a3b8',
          font: { weight: 'bold' as const, size: 11 }
        },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { weight: 'bold' as const, size: 11 } }
      }
    }
  };

  // Calendar Weekday Matrix State & Computation
  const [selectedWeekdayMonth, setSelectedWeekdayMonth] = useState<string>('ALL');

  // Interactive Drilldown Modal State
  const [drilldownTitle, setDrilldownTitle] = useState<string | null>(null);
  const [drilldownShipments, setDrilldownShipments] = useState<Shipment[]>([]);
  const [drilldownPage, setDrilldownPage] = useState<number>(1);
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const pageSize = 15;

  // Open drilldown modal for a cell
  const handleOpenDrilldown = (title: string, list: Shipment[]) => {
    setDrilldownTitle(title);
    setDrilldownShipments(list);
    setDrilldownPage(1);
    setDrilldownSearch('');
  };

  // Filtered drilldown shipments inside modal
  const filteredDrilldownList = useMemo(() => {
    if (!drilldownSearch.trim()) return drilldownShipments;
    const q = drilldownSearch.toLowerCase();
    return drilldownShipments.filter(
      (s) =>
        s.awb.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.shprName.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q)
    );
  }, [drilldownShipments, drilldownSearch]);

  const totalDrilldownPages = Math.ceil(filteredDrilldownList.length / pageSize) || 1;
  const paginatedShipments = filteredDrilldownList.slice(
    (drilldownPage - 1) * pageSize,
    drilldownPage * pageSize
  );

  const handleExportDrilldown = () => {
    const worksheet = XLSX.utils.json_to_sheet(drilldownShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Drilldown_Records');
    XLSX.writeFile(workbook, `Drilldown_${(drilldownTitle || 'Records').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  // Compute Calendar Matrix for Weekday vs Weekly Comparison
  const weekdayMatrixResult = useMemo(() => {
    return computeCalendarMatrix(effectiveShipments, {
      month: selectedWeekdayMonth
    });
  }, [effectiveShipments, selectedWeekdayMonth]);

  const { rows: weekdayRows } = weekdayMatrixResult;

  // Weekday TT Color Helper
  const getTTColorClass = (tt: number, count: number) => {
    if (count === 0 || tt === 0) return 'text-slate-500 bg-slate-800/30 border-slate-700';
    if (tt <= 4.0) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
    if (tt <= 5.0) return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
  };

  // Weekday vs Weekly Transit Time Trend Chart
  const weekdayChartData = useMemo(() => {
    return {
      labels: weekdayRows.map((r) => r.dayName),
      datasets: [
        {
          label: 'Week 1 Avg TT',
          data: weekdayRows.map((r) => r.weeks[1]?.avgTT || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.85)', // Blue
          borderRadius: 6
        },
        {
          label: 'Week 2 Avg TT',
          data: weekdayRows.map((r) => r.weeks[2]?.avgTT || 0),
          backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald
          borderRadius: 6
        },
        {
          label: 'Week 3 Avg TT',
          data: weekdayRows.map((r) => r.weeks[3]?.avgTT || 0),
          backgroundColor: 'rgba(245, 158, 11, 0.85)', // Amber
          borderRadius: 6
        },
        {
          label: 'Week 4 Avg TT',
          data: weekdayRows.map((r) => r.weeks[4]?.avgTT || 0),
          backgroundColor: 'rgba(168, 85, 247, 0.85)', // Purple
          borderRadius: 6
        },
        {
          label: 'Overall Day Avg',
          data: weekdayRows.map((r) => r.overallAvgTT || 0),
          backgroundColor: 'rgba(239, 68, 68, 0.85)', // Rose
          borderRadius: 6
        }
      ]
    };
  }, [weekdayRows]);

  const weekdayChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { weight: 'bold', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw} days`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { weight: 'bold', size: 11 } }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Average Transit Time (Days)',
          color: '#94a3b8',
          font: { weight: 'bold', size: 11 }
        },
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#94a3b8', font: { weight: 'bold', size: 11 } }
      }
    }
  };

  // Export Complete Monthly Comparison to Excel
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Monthly Summary
    const summaryData = months.map((m) => ({
      Month: m.monthLabel,
      'Total AWBs': m.totalAWBs,
      'MoM Volume Change (%)': m.momChangeAWB !== null ? `${m.momChangeAWB}%` : 'Baseline',
      'Average TT (Days)': m.avgTT,
      'MoM TT Change (%)': m.momChangeTT !== null ? `${m.momChangeTT}%` : 'Baseline',
      'Min TT (Days)': m.minTT,
      'Max TT (Days)': m.maxTT,
      'On-Time Deliveries (<=5d)': m.onTimeCount,
      'On-Time Rate (%)': `${m.onTimePercentage}%`,
      'Delayed Deliveries (>5d)': m.delayedCount,
      'Delayed Rate (%)': `${m.delayedPercentage}%`,
      'Delivered Rate (%)': `${m.resolutions.delivered.percentage}%`,
      'RTS Rate (%)': `${m.resolutions.rts.percentage}%`,
      'Total Delays Recorded': m.delays.totalDelayed,
      'Transit Delay AWBs': m.delays.transit.count,
      'Clearance Delay AWBs': m.delays.clearance.count,
      'Destination Delay AWBs': m.delays.destination.count
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWs, 'Monthly_Overview');

    // Sheet 2: Weekly TT Comparison (W1-W5)
    const weeklyData = months.map((m) => ({
      Month: m.monthLabel,
      'Total AWBs': m.totalAWBs,
      'Overall Avg TT': m.avgTT,
      'Week 1 Avg TT': m.weeks[1]?.count ? m.weeks[1].avgTT : 'N/A',
      'Week 1 AWBs': m.weeks[1]?.count || 0,
      'Week 2 Avg TT': m.weeks[2]?.count ? m.weeks[2].avgTT : 'N/A',
      'Week 2 AWBs': m.weeks[2]?.count || 0,
      'Week 3 Avg TT': m.weeks[3]?.count ? m.weeks[3].avgTT : 'N/A',
      'Week 3 AWBs': m.weeks[3]?.count || 0,
      'Week 4 Avg TT': m.weeks[4]?.count ? m.weeks[4].avgTT : 'N/A',
      'Week 4 AWBs': m.weeks[4]?.count || 0,
      'Week 5 Avg TT': m.weeks[5]?.count ? m.weeks[5].avgTT : 'N/A',
      'Week 5 AWBs': m.weeks[5]?.count || 0
    }));
    const weeklyWs = XLSX.utils.json_to_sheet(weeklyData);
    XLSX.utils.book_append_sheet(workbook, weeklyWs, 'Weekly_TT_Velocity');

    // Sheet 3: Calendar Weekday Matrix
    const weekdayExportData = weekdayRows.map((r) => ({
      'Day of Week': r.dayName,
      'Week 1 Avg TT (Days)': r.weeks[1]?.count ? r.weeks[1].avgTT : 'N/A',
      'Week 1 AWBs': r.weeks[1]?.count || 0,
      'Week 2 Avg TT (Days)': r.weeks[2]?.count ? r.weeks[2].avgTT : 'N/A',
      'Week 2 AWBs': r.weeks[2]?.count || 0,
      'Week 3 Avg TT (Days)': r.weeks[3]?.count ? r.weeks[3].avgTT : 'N/A',
      'Week 3 AWBs': r.weeks[3]?.count || 0,
      'Week 4 Avg TT (Days)': r.weeks[4]?.count ? r.weeks[4].avgTT : 'N/A',
      'Week 4 AWBs': r.weeks[4]?.count || 0,
      'Week 5 Avg TT (Days)': r.weeks[5]?.count ? r.weeks[5].avgTT : 'N/A',
      'Week 5 AWBs': r.weeks[5]?.count || 0,
      'Overall Day Avg TT (Days)': r.totalCount ? r.overallAvgTT : 'N/A',
      'Total AWBs': r.totalCount,
      'On-Time %': `${r.onTimePercentage}%`
    }));
    const weekdayWs = XLSX.utils.json_to_sheet(weekdayExportData);
    XLSX.utils.book_append_sheet(workbook, weekdayWs, 'Calendar_Weekday_Matrix');

    // Sheet 4: Delays Breakdown
    const delaysData = months.map((m) => ({
      Month: m.monthLabel,
      'Total AWBs': m.totalAWBs,
      'Total Shipments With Delays': m.delays.totalDelayed,
      'Delay Incidence Rate': `${m.delays.delayedPercentage}%`,
      'Transit Delays': m.delays.transit.count,
      'Transit Delay %': `${m.delays.transit.percentage}%`,
      'Clearance Delays': m.delays.clearance.count,
      'Clearance Delay %': `${m.delays.clearance.percentage}%`,
      'Destination Delays': m.delays.destination.count,
      'Destination Delay %': `${m.delays.destination.percentage}%`,
      'Weekend Delays': m.delays.weekend.count,
      'Top Transit Reason': m.delays.topTransitReasons[0]?.reason || 'None',
      'Top Clearance Reason': m.delays.topClearanceReasons[0]?.reason || 'None',
      'Top Destination Reason': m.delays.topDestinationReasons[0]?.reason || 'None'
    }));
    const delaysWs = XLSX.utils.json_to_sheet(delaysData);
    XLSX.utils.book_append_sheet(workbook, delaysWs, 'Delays_Analysis');

    XLSX.writeFile(workbook, `Monthly_Comparison_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-7 animate-fade-in">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0d1527] to-slate-900 border border-slate-700/80 shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
            <CalendarRange className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Monthly Comparison Analytics
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {months.length} Months Tracked
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Side-by-side performance benchmarks for volume, transit times, on-time delivery, delay categories, and weekly velocities.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0 w-fit"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Monthly Comparison (.xlsx)</span>
        </button>
      </div>

      {/* 1.1 ACTIVE SEARCH / FILTER STATUS BAR */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Active Filters:
            </span>

            {selectedCustomer && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Customer: <strong className="text-white">{selectedCustomer}</strong></span>
                {onCustomerChange && (
                  <button
                    onClick={() => onCustomerChange('ALL')}
                    className="ml-1 p-0.5 rounded-full hover:bg-emerald-500/30 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                    title="Clear customer filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            )}

            {selectedDestination && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/40 shadow-sm">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Destination: <strong className="text-white">{selectedDestination}</strong></span>
                {onDestinationChange && (
                  <button
                    onClick={() => onDestinationChange('ALL')}
                    className="ml-1 p-0.5 rounded-full hover:bg-blue-500/30 text-blue-300 hover:text-white transition-colors cursor-pointer"
                    title="Clear destination filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            )}

            {selectedCategoryType && selectedCategoryType !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm">
                <Package className="w-3.5 h-3.5 text-purple-400" />
                <span>Category: <strong className="text-white">{selectedCategoryType}</strong></span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-bold">
              <span className="font-mono text-white text-sm font-extrabold">{grandTotalAWBs.toLocaleString()}</span> AWBs matched
            </span>
            {onResetFilters && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-500/10"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      )}

      {grandTotalAWBs === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Filter className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-base font-extrabold text-white">
            No Shipments Found
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No shipments match the selected filters {selectedCustomer ? `for customer "${selectedCustomer}"` : ''} {selectedDestination ? `to destination "${selectedDestination}"` : ''} across tracked months.
          </p>
          {onResetFilters && (
            <button
              onClick={onResetFilters}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 2. EXECUTIVE MONTH-OVER-MONTH KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((m, idx) => {
          const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
          return (
            <div
              key={m.monthId}
              className={`glass-card p-5 rounded-2xl border-2 ${palette.borderClass} bg-gradient-to-br ${palette.gradient} backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-4`}
            >
              {/* Card Header: Month Title & Volume */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-purple-400" />
                  <h3 className="text-base font-black text-white">{m.monthLabel}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${palette.badge}`}>
                  {m.totalAWBs.toLocaleString()} AWBs
                </span>
              </div>

              {/* Primary KPIs: Total AWBs & Average TT */}
              <div className="grid grid-cols-2 gap-3">
                {/* Volume & MoM */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Package className="w-3 h-3 text-sky-400" />
                    Total AWBs
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white font-mono">
                      {m.totalAWBs.toLocaleString()}
                    </span>
                  </div>
                  {m.momChangeAWB !== null && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
                      {m.momChangeAWB >= 0 ? (
                        <span className="text-emerald-400 flex items-center">
                          <ArrowUpRight className="w-3.5 h-3.5" /> +{m.momChangeAWB}% MoM
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center">
                          <ArrowDownRight className="w-3.5 h-3.5" /> {m.momChangeAWB}% MoM
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Average TT & MoM */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    Average TT
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white font-mono">
                      {m.avgTT.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Days</span>
                  </div>
                  {m.momChangeTT !== null && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
                      {m.momChangeTT <= 0 ? (
                        <span className="text-emerald-400 flex items-center" title="Lower TT is faster">
                          <TrendingDown className="w-3.5 h-3.5" /> {m.momChangeTT}% faster
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center" title="Higher TT is slower">
                          <TrendingUp className="w-3.5 h-3.5" /> +{m.momChangeTT}% slower
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Transit Time Range: Min TT & Max TT */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Min TT:</span>
                  <span className="text-emerald-400 font-mono font-black">{m.minTT.toFixed(2)}d</span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Max TT:</span>
                  <span className="text-rose-400 font-mono font-black">{m.maxTT.toFixed(2)}d</span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Spread:</span>
                  <span className="text-slate-300 font-mono font-black">{(m.maxTT - m.minTT).toFixed(2)}d</span>
                </div>
              </div>

              {/* On-Time Delivery Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    On-Time Delivery (&le; 5d)
                  </span>
                  <span className="text-emerald-400 font-mono font-black">
                    {m.onTimePercentage}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.min(m.onTimePercentage, 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>{m.onTimeCount.toLocaleString()} on-time</span>
                  <span>{m.delayedCount.toLocaleString()} delayed</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* 3. WEEKLY TT COMPARISON (W1, W2, W3, W4, W5) WITH GRAPH */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border-2 border-slate-700 bg-slate-950/60 shadow-2xl space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-black text-white tracking-tight">
                Weekly TT Comparison: W1, W2, W3, W4 (with Graph)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Compare weekly transit velocity across calendar weeks (Days 1–7, 8–14, 15–21, 22–28, 29+) side-by-side.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Fast (&le; 4.0d)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate (4.1–5.0d)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Slow (&gt; 5.0d)
            </span>
          </div>
        </div>

        {/* The Graph */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <Bar data={weeklyChartData} options={weeklyChartOptions} />
        </div>

        {/* Weekly Comparison Data Matrix Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-center text-xs border-collapse">
            <thead className="bg-[#0f172a] text-slate-300 uppercase text-[10px] font-black tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 text-left font-black">Month</th>
                <th className="py-3 px-4 font-black">Total AWBs</th>
                <th className="py-3 px-4 font-black">Overall Avg TT</th>
                <th className="py-3 px-4 font-black border-l border-slate-800">
                  <div>Week 1 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 1–7</span>
                </th>
                <th className="py-3 px-4 font-black border-l border-slate-800">
                  <div>Week 2 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 8–14</span>
                </th>
                <th className="py-3 px-4 font-black border-l border-slate-800">
                  <div>Week 3 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 15–21</span>
                </th>
                <th className="py-3 px-4 font-black border-l border-slate-800">
                  <div>Week 4 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 22–28</span>
                </th>
                <th className="py-3 px-4 font-black border-l border-slate-800">
                  <div>Week 5 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 29+</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono font-bold text-slate-200">
              {months.map((m, idx) => {
                const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
                return (
                  <tr key={m.monthId} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 text-left font-sans font-black flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${palette.badge}`}></span>
                      <span className="text-white">{m.monthLabel}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {m.totalAWBs.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-amber-400 text-sm font-black">
                      {m.avgTT.toFixed(2)}d
                    </td>
                    {[1, 2, 3, 4, 5].map((w) => {
                      const wData = m.weeks[w];
                      const count = wData?.count || 0;
                      const avg = wData?.avgTT || 0;
                      if (!count) {
                        return (
                          <td key={w} className="py-3.5 px-4 text-slate-600 border-l border-slate-800">
                            -
                          </td>
                        );
                      }
                      const colorClass =
                        avg <= 4.0
                          ? 'text-emerald-400 bg-emerald-950/20'
                          : avg <= 5.0
                          ? 'text-amber-400 bg-amber-950/20'
                          : 'text-rose-400 bg-rose-950/20';

                      return (
                        <td key={w} className={`py-3.5 px-4 border-l border-slate-800 ${colorClass}`}>
                          <div className="font-black text-sm">{avg.toFixed(2)}d</div>
                          <div className="text-[10px] text-slate-400 font-sans font-medium">
                            {count.toLocaleString()} pkgs
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* 3.1 CALENDAR WEEKDAY TRANSIT TIME MATRIX & TREND GRAPH */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border-2 border-slate-700 bg-slate-950/60 shadow-2xl space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-black text-white tracking-tight">
                Calendar Weekday Transit Time Comparison
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Daily delivery performance across calendar weekdays (Sunday–Saturday) and calendar weeks (Days 1–7, 8–14, 15–21, 22–28, 29–31). Click any cell to inspect shipments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Speed Legend */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Fast (&le; 4.0d)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate (4.1–5.0d)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Slow (&gt; 5.0d)
              </span>
            </div>

            {/* Month Filter Selector (if multiple months tracked) */}
            {months.length > 1 && (
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setSelectedWeekdayMonth('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedWeekdayMonth === 'ALL'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Months
                </button>
                {months.map((m) => (
                  <button
                    key={m.monthId}
                    onClick={() => setSelectedWeekdayMonth(m.monthId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedWeekdayMonth === m.monthId
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.monthLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table matching Calendar Weekday matrix */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-center text-xs border-collapse">
            <thead className="bg-[#0f172a] text-slate-300 uppercase text-[10px] font-black tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-4 text-left font-black w-40">
                  Calendar Weekday
                </th>
                <th className="py-3.5 px-3 font-black border-l border-slate-800">
                  <div>Week 1 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 1–7</span>
                </th>
                <th className="py-3.5 px-3 font-black border-l border-slate-800">
                  <div>Week 2 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 8–14</span>
                </th>
                <th className="py-3.5 px-3 font-black border-l border-slate-800">
                  <div>Week 3 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 15–21</span>
                </th>
                <th className="py-3.5 px-3 font-black border-l border-slate-800">
                  <div>Week 4 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 22–28</span>
                </th>
                <th className="py-3.5 px-3 font-black border-l border-slate-800">
                  <div>Week 5 Avg TT</div>
                  <span className="text-[9px] text-slate-400 font-normal">Days 29–31</span>
                </th>
                <th className="py-3.5 px-4 font-black border-l border-slate-800 bg-violet-950/40 text-violet-300">
                  Overall Day Avg TT
                </th>
                <th className="py-3.5 px-4 font-black border-l border-slate-800">
                  Total Shipments
                </th>
                <th className="py-3.5 px-4 font-black border-l border-slate-800">
                  On-Time Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-bold">
              {weekdayRows.map((row) => (
                <tr key={row.dayName} className="hover:bg-slate-900/60 transition-colors">
                  {/* Calendar Weekday Name */}
                  <td className="py-3.5 px-4 text-left font-sans flex items-center gap-2 text-white">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span className="font-extrabold">{row.dayName}</span>
                  </td>

                  {/* Weeks 1 to 5 */}
                  {[1, 2, 3, 4, 5].map((w) => {
                    const wData = row.weeks[w];
                    const hasData = Boolean(wData && wData.count > 0);
                    return (
                      <td key={w} className="py-3 px-3 text-center border-l border-slate-800">
                        {hasData ? (
                          <button
                            onClick={() =>
                              handleOpenDrilldown(
                                `${row.dayName} - Week ${w} (${wData.count.toLocaleString()} Shipments)`,
                                wData.shipments
                              )
                            }
                            className={`group inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border transition-all cursor-pointer hover:scale-105 shadow-sm ${getTTColorClass(
                              wData.avgTT,
                              wData.count
                            )}`}
                            title={`Click to inspect ${wData.count} shipments`}
                          >
                            <span className="text-xs font-black tracking-tight font-mono group-hover:underline">
                              {wData.avgTT.toFixed(2)}d
                            </span>
                            <span className="text-[10px] opacity-80 font-mono">
                              {wData.count.toLocaleString()} pkgs
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Overall Day Avg TT */}
                  <td className="py-3 px-4 text-center border-l border-slate-800 bg-violet-950/20">
                    {row.totalCount > 0 ? (
                      <button
                        onClick={() =>
                          handleOpenDrilldown(
                            `${row.dayName} - All Weeks (${row.totalCount.toLocaleString()} Shipments)`,
                            row.shipments
                          )
                        }
                        className="group inline-flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30 transition-all cursor-pointer hover:scale-105"
                      >
                        <span className="text-xs font-black tracking-tight font-mono group-hover:underline">
                          {row.overallAvgTT.toFixed(2)}d
                        </span>
                        <span className="text-[10px] text-violet-200">Overall Avg</span>
                      </button>
                    ) : (
                      <span className="text-slate-600 font-mono text-xs">-</span>
                    )}
                  </td>

                  {/* Total Shipments */}
                  <td className="py-3 px-4 text-center font-extrabold text-white font-mono border-l border-slate-800">
                    {row.totalCount.toLocaleString()}
                  </td>

                  {/* On-Time Rate */}
                  <td className="py-3 px-4 text-center border-l border-slate-800">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-900 border border-slate-700 text-slate-200 font-mono">
                      {row.totalCount > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{row.onTimePercentage}%</span>
                        </>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* The Graph: Weekday vs Weekly Transit Time Trend */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="text-base font-extrabold text-white tracking-tight">
                Weekday vs Weekly Transit Time Trend
              </h4>
              <p className="text-xs text-slate-400 font-medium">
                Comparing average transit days across Week 1, Week 2, Week 3, Week 4 and Overall Day Average
              </p>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full pt-2">
            <Bar data={weekdayChartData} options={weekdayChartOptions} />
          </div>
        </div>

      </div>

      {/* 4. RECORDED DELAYS & FINAL RESOLUTIONS SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* A. Recorded Delays Comparison */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border-2 border-slate-700 bg-slate-950/60 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-white">
                Recorded Delays Comparison
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">Transit, Clearance & Dest</span>
          </div>

          <div className="space-y-4">
            {months.map((m, idx) => {
              const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
              const { transit, clearance, destination, totalDelayed, delayedPercentage } = m.delays;

              return (
                <div key={m.monthId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-white flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${palette.badge}`}></span>
                      {m.monthLabel}
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {totalDelayed.toLocaleString()} Delayed ({delayedPercentage}%)
                    </span>
                  </div>

                  {/* Delay Categories Breakdown Grid */}
                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Transit Delays</div>
                      <div className="mt-1 font-mono font-black text-sm text-sky-400">
                        {transit.count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {transit.percentage}% of month
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Clearance Delays</div>
                      <div className="mt-1 font-mono font-black text-sm text-purple-400">
                        {clearance.count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {clearance.percentage}% of month
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Dest Delays</div>
                      <div className="mt-1 font-mono font-black text-sm text-amber-400">
                        {destination.count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {destination.percentage}% of month
                      </div>
                    </div>
                  </div>

                  {/* Top Delay Reasons snippet */}
                  {clearance.count > 0 && m.delays.topClearanceReasons[0] && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span className="text-slate-500">Top Clearance Reason:</span>
                      <span className="font-bold text-slate-300 truncate max-w-[220px]">
                        {m.delays.topClearanceReasons[0].reason} ({m.delays.topClearanceReasons[0].count})
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* B. Final Resolution Comparison */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border-2 border-slate-700 bg-slate-950/60 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">
                Final Resolution Comparison
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">Delivery Success & RTS</span>
          </div>

          <div className="space-y-4">
            {months.map((m, idx) => {
              const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
              const { delivered, rts, other } = m.resolutions;

              return (
                <div key={m.monthId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-white flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${palette.badge}`}></span>
                      {m.monthLabel}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {delivered.percentage}% Delivered
                    </span>
                  </div>

                  {/* Multi-segment stacked progress bar */}
                  <div className="w-full h-3 rounded-full bg-slate-950 flex overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${delivered.percentage}%` }}
                      title={`Delivered: ${delivered.percentage}% (${delivered.count.toLocaleString()})`}
                    ></div>
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${rts.percentage}%` }}
                      title={`RTS: ${rts.percentage}% (${rts.count.toLocaleString()})`}
                    ></div>
                    <div
                      className="h-full bg-slate-600"
                      style={{ width: `${other.percentage}%` }}
                      title={`Other: ${other.percentage}% (${other.count.toLocaleString()})`}
                    ></div>
                  </div>

                  {/* Legend Counts */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Delivered</span>
                        <span className="font-mono font-black text-emerald-400">
                          {delivered.count.toLocaleString()} ({delivered.percentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <div>
                        <span className="text-[10px] text-slate-400 block">RTS / Return</span>
                        <span className="font-mono font-black text-rose-400">
                          {rts.count.toLocaleString()} ({rts.percentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Other Resolutions</span>
                        <span className="font-mono font-black text-slate-300">
                          {other.count.toLocaleString()} ({other.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 5. MASTER MONTHLY SUMMARY MATRIX TABLE */}
      <div className="glass-card rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950/60 shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-black text-white">
              Complete Cross-Month Performance Matrix
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-bold font-mono">
            {grandTotalAWBs.toLocaleString()} Total Combined AWBs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead className="bg-[#0f172a] text-slate-300 uppercase text-[10px] font-black tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3 px-4 text-left font-black">Month</th>
                <th className="py-3 px-4 font-black">Volume (AWB)</th>
                <th className="py-3 px-4 font-black">Share of Total</th>
                <th className="py-3 px-4 font-black">MoM Volume</th>
                <th className="py-3 px-4 font-black">Avg TT</th>
                <th className="py-3 px-4 font-black">Min TT</th>
                <th className="py-3 px-4 font-black">Max TT</th>
                <th className="py-3 px-4 font-black">On-Time %</th>
                <th className="py-3 px-4 font-black">Recorded Delays</th>
                <th className="py-3 px-4 font-black">Delivered %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono font-bold text-slate-200">
              {months.map((m, idx) => {
                const palette = MONTH_PALETTES[idx % MONTH_PALETTES.length];
                const shareOfTotal = grandTotalAWBs > 0 ? ((m.totalAWBs / grandTotalAWBs) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={m.monthId} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 text-left font-sans font-black flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${palette.badge}`}></span>
                      <span className="text-white">{m.monthLabel}</span>
                    </td>
                    <td className="py-3.5 px-4 text-white text-sm font-black">
                      {m.totalAWBs.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {shareOfTotal}%
                    </td>
                    <td className="py-3.5 px-4">
                      {m.momChangeAWB !== null ? (
                        m.momChangeAWB >= 0 ? (
                          <span className="text-emerald-400 font-bold">+{m.momChangeAWB}%</span>
                        ) : (
                          <span className="text-rose-400 font-bold">{m.momChangeAWB}%</span>
                        )
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-amber-400 font-black text-sm">
                      {m.avgTT.toFixed(2)}d
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400">
                      {m.minTT.toFixed(2)}d
                    </td>
                    <td className="py-3.5 px-4 text-rose-400">
                      {m.maxTT.toFixed(2)}d
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 font-black">
                        {m.onTimePercentage}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-amber-300">
                      {m.delays.totalDelayed.toLocaleString()} ({m.delays.delayedPercentage}%)
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400 font-black">
                      {m.resolutions.delivered.percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* 6. INTERACTIVE CELL DRILLDOWN MODAL */}
      {drilldownTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {drilldownTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {filteredDrilldownList.length} matching shipment records
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportDrilldown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => setDrilldownTitle(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search filter inside modal */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by AWB, customer, shipper, or destination..."
                  value={drilldownSearch}
                  onChange={(e) => {
                    setDrilldownSearch(e.target.value);
                    setDrilldownPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                    <th className="py-2.5 px-3">AWB</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Shipper</th>
                    <th className="py-2.5 px-3">Dest</th>
                    <th className="py-2.5 px-3">Pickup Date</th>
                    <th className="py-2.5 px-3 text-center">TT (Days)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                  {paginatedShipments.map((s) => (
                    <tr key={s.awb} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {s.awb}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-900 dark:text-white" title={s.customer}>
                        {s.customer || '-'}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-600 dark:text-slate-400" title={s.shprName}>
                        {s.shprName || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {s.destination}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {formatExcelDate(s.pickup)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          (s.tt || 0) <= 4
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : (s.tt || 0) <= 5
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {formatTT(s.tt)}d
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.finalResolution === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {s.finalResolution || 'Delivered'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Page {drilldownPage} of {totalDrilldownPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={drilldownPage === 1}
                  onClick={() => setDrilldownPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={drilldownPage === totalDrilldownPages}
                  onClick={() => setDrilldownPage((p) => Math.min(totalDrilldownPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
