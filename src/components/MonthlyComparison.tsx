import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  CalendarDays,
  Calendar,
  Sparkles,
  Filter,
  Users,
  Globe,
  X,
  RotateCcw,
  ArrowRightLeft,
  CalendarCheck,
  ChevronRight,
  Search,
  ChevronDown,
  Check
} from 'lucide-react';
import { Shipment, FilterState } from '../types/logistics';
import { computeMonthlyComparison, MonthlyMetric } from '../utils/monthlyAnalytics';
import { filterShipments, searchCustomers } from '../utils/analytics';
import { parseShipmentDate } from '../utils/calendarAnalytics';
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

export const WEEKDAYS = [
  { index: 0, name: 'Sunday', short: 'Sun' },
  { index: 1, name: 'Monday', short: 'Mon' },
  { index: 2, name: 'Tuesday', short: 'Tue' },
  { index: 3, name: 'Wednesday', short: 'Wed' },
  { index: 4, name: 'Thursday', short: 'Thu' },
  { index: 5, name: 'Friday', short: 'Fri' },
  { index: 6, name: 'Saturday', short: 'Sat' }
];

export const WEEK_OPTIONS = [
  { id: 'ALL' as const, label: 'All Weeks', sub: 'W1–W5' },
  { id: 1 as const, label: 'W1', sub: 'Days 1–7' },
  { id: 2 as const, label: 'W2', sub: 'Days 8–14' },
  { id: 3 as const, label: 'W3', sub: 'Days 15–21' },
  { id: 4 as const, label: 'W4', sub: 'Days 22–28' },
  { id: 5 as const, label: 'W5', sub: 'Days 29+' }
];

export const MonthlyComparison: React.FC<MonthlyComparisonProps> = ({
  rawShipments,
  filteredShipments,
  filters,
  allCustomers,
  allDestinations,
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

  // State for Side-by-Side Weekday & Week Comparison
  const [selectedWeek, setSelectedWeek] = useState<number | 'ALL'>(1);
  const [selectedWeekday, setSelectedWeekday] = useState<number | 'ALL'>(1); // Monday by default
  const [leftMonthId, setLeftMonthId] = useState<string>('');
  const [rightMonthId, setRightMonthId] = useState<string>('');

  // Synchronize leftMonthId and rightMonthId when months load
  useEffect(() => {
    if (months.length > 0) {
      if (!leftMonthId || !months.some(m => m.monthId === leftMonthId)) {
        setLeftMonthId(months[0].monthId);
      }
      if (!rightMonthId || !months.some(m => m.monthId === rightMonthId)) {
        setRightMonthId(months.length > 1 ? months[1].monthId : months[0].monthId);
      }
    }
  }, [months, leftMonthId, rightMonthId]);

  // Local search states for Section 3B Customer & Destination inputs
  const [sectionCustomerSearch, setSectionCustomerSearch] = useState('');
  const [sectionDestSearch, setSectionDestSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const destDropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside handlers for customer & destination dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute matching customers
  const matchingCustomers = useMemo(() => {
    return searchCustomers(rawShipments, sectionCustomerSearch, 40);
  }, [rawShipments, sectionCustomerSearch]);

  const totalDistinctCustomersCount = useMemo(() => {
    if (allCustomers && allCustomers.length > 0) return allCustomers.length;
    const set = new Set<string>();
    rawShipments.forEach((s) => {
      if (s.customer) set.add(s.customer.trim());
    });
    return set.size;
  }, [allCustomers, rawShipments]);

  // Compute destination counts from raw shipments
  const destinationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of rawShipments) {
      if (s.destination) {
        const dest = s.destination.trim().toUpperCase();
        map.set(dest, (map.get(dest) || 0) + 1);
      }
    }
    return map;
  }, [rawShipments]);

  const distinctDestinations = useMemo(() => {
    if (allDestinations && allDestinations.length > 0) return allDestinations;
    return Array.from(destinationCounts.keys()).sort();
  }, [allDestinations, destinationCounts]);

  const matchingDestinations: string[] = useMemo(() => {
    if (!sectionDestSearch.trim()) return distinctDestinations.slice(0, 40);
    const q = sectionDestSearch.trim().toUpperCase();
    return distinctDestinations.filter((d: string) => d.includes(q)).slice(0, 40);
  }, [distinctDestinations, sectionDestSearch]);

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsCustomerDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingCustomers.length > 0) {
        onCustomerChange?.(matchingCustomers[0].name);
        setSectionCustomerSearch('');
        setIsCustomerDropdownOpen(false);
      }
    }
  };

  const handleDestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDestDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingDestinations.length > 0) {
        onDestinationChange?.(matchingDestinations[0]);
        setSectionDestSearch('');
        setIsDestDropdownOpen(false);
      }
    }
  };

  // Index effective shipments by monthId, weekday (0-6), and week (1-5) for instant retrieval
  const weekdayShipmentsIndex = useMemo(() => {
    const index: Record<string, Shipment[]> = {};

    effectiveShipments.forEach((s) => {
      const d = parseShipmentDate(s.pickup);
      if (!d) return;
      const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const dayOfWeek = d.getUTCDay(); // 0 = Sun .. 6 = Sat
      const dayOfMonth = d.getUTCDate();
      const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5); // 1..5

      // Key combinations for multi-level fast querying
      const keys = [
        `${monthKey}__W${weekNum}__D${dayOfWeek}`,
        `${monthKey}__WALL__D${dayOfWeek}`,
        `${monthKey}__W${weekNum}__DALL`,
        `${monthKey}__WALL__DALL`
      ];

      keys.forEach((k) => {
        if (!index[k]) index[k] = [];
        index[k].push(s);
      });
    });

    return index;
  }, [effectiveShipments]);

  // Helper to compute TT stats for any month, week, and weekday
  const getStats = (mId: string, week: number | 'ALL', day: number | 'ALL') => {
    const key = `${mId}__W${week}__D${day}`;
    const list = weekdayShipmentsIndex[key] || [];
    const valid = list.filter(
      (s) => typeof s.tt === 'number' && !isNaN(s.tt) && s.tt > 0
    );
    const count = list.length;
    if (valid.length === 0) {
      return { count: 0, avgTT: 0, minTT: 0, maxTT: 0, onTimeRate: 0, delayedCount: 0 };
    }
    const tts = valid.map((s) => s.tt);
    const sum = tts.reduce((a, b) => a + b, 0);
    const avgTT = Number((sum / valid.length).toFixed(2));
    const minTT = Number(Math.min(...tts).toFixed(2));
    const maxTT = Number(Math.max(...tts).toFixed(2));
    const onTimeCount = valid.filter((s) => s.tt <= 5).length;
    const delayedCount = valid.filter((s) => s.tt > 5).length;
    const onTimeRate = Number(((onTimeCount / valid.length) * 100).toFixed(1));
    return { count, avgTT, minTT, maxTT, onTimeRate, delayedCount };
  };

  const activeLeftMonth = months.find((m) => m.monthId === leftMonthId) || months[0];
  const activeRightMonth =
    months.find((m) => m.monthId === rightMonthId) ||
    (months.length > 1 ? months[1] : months[0]);

  const leftStats = activeLeftMonth ? getStats(activeLeftMonth.monthId, selectedWeek, selectedWeekday) : null;
  const rightStats = activeRightMonth ? getStats(activeRightMonth.monthId, selectedWeek, selectedWeekday) : null;

  // Velocity deltas between Month A and Month B
  const ttDiff =
    leftStats && rightStats && leftStats.count > 0 && rightStats.count > 0
      ? Number((rightStats.avgTT - leftStats.avgTT).toFixed(2))
      : null;

  const ttPercentDiff =
    leftStats && rightStats && leftStats.avgTT > 0 && rightStats.count > 0
      ? Number((((rightStats.avgTT - leftStats.avgTT) / leftStats.avgTT) * 100).toFixed(1))
      : null;

  const volDiff =
    leftStats && rightStats ? rightStats.count - leftStats.count : 0;

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

    // Sheet 3: Delays Breakdown
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

    // Sheet 4: Weekday MoM TT Comparison (Avg, Min, Max by Week & Day)
    const weekdayExportData: any[] = [];
    [1, 2, 3, 4, 5].forEach((w) => {
      WEEKDAYS.forEach((day) => {
        const leftS = activeLeftMonth ? getStats(activeLeftMonth.monthId, w, day.index) : null;
        const rightS = activeRightMonth ? getStats(activeRightMonth.monthId, w, day.index) : null;
        const diff =
          leftS && rightS && leftS.count > 0 && rightS.count > 0
            ? Number((rightS.avgTT - leftS.avgTT).toFixed(2))
            : 'N/A';

        weekdayExportData.push({
          Week: `Week ${w}`,
          Weekday: day.name,
          [`${activeLeftMonth?.monthLabel || 'Month A'} Total AWBs`]: leftS?.count || 0,
          [`${activeLeftMonth?.monthLabel || 'Month A'} Avg TT (Days)`]: leftS?.count ? leftS.avgTT : 'N/A',
          [`${activeLeftMonth?.monthLabel || 'Month A'} Min TT (Days)`]: leftS?.count ? leftS.minTT : 'N/A',
          [`${activeLeftMonth?.monthLabel || 'Month A'} Max TT (Days)`]: leftS?.count ? leftS.maxTT : 'N/A',
          [`${activeLeftMonth?.monthLabel || 'Month A'} On-Time %`]: leftS?.count ? `${leftS.onTimeRate}%` : 'N/A',
          [`${activeRightMonth?.monthLabel || 'Month B'} Total AWBs`]: rightS?.count || 0,
          [`${activeRightMonth?.monthLabel || 'Month B'} Avg TT (Days)`]: rightS?.count ? rightS.avgTT : 'N/A',
          [`${activeRightMonth?.monthLabel || 'Month B'} Min TT (Days)`]: rightS?.count ? rightS.minTT : 'N/A',
          [`${activeRightMonth?.monthLabel || 'Month B'} Max TT (Days)`]: rightS?.count ? rightS.maxTT : 'N/A',
          [`${activeRightMonth?.monthLabel || 'Month B'} On-Time %`]: rightS?.count ? `${rightS.onTimeRate}%` : 'N/A',
          'TT Difference (Days)': diff
        });
      });
    });
    const weekdayWs = XLSX.utils.json_to_sheet(weekdayExportData);
    XLSX.utils.book_append_sheet(workbook, weekdayWs, 'Weekday_MoM_TT');

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

      {/* 3B. SIDE-BY-SIDE MONTH TT COMPARISON BY WEEK & CALENDAR WEEKDAY */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border-2 border-indigo-500/40 bg-slate-950/70 shadow-2xl space-y-6">
        
        {/* Section Header & Subtitle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <ArrowRightLeft className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Side-by-Side Month TT Comparison: By Week & Calendar Weekday
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-medium pl-11">
              Select any week (<span className="text-indigo-400 font-bold">W1–W5</span>) and individual calendar weekday (<span className="text-purple-400 font-bold">Sunday–Saturday</span>) to compare <span className="text-amber-400 font-bold">Avg TT</span>, <span className="text-emerald-400 font-bold">Min TT</span>, and <span className="text-rose-400 font-bold">Max TT</span> side-by-side simultaneously.
            </p>
          </div>

          {/* Controls Column: Month Switcher on top, Short Customer & Destination Search below it */}
          <div className="flex flex-col items-start lg:items-end gap-2 self-start lg:self-center shrink-0">
            {/* Month Switcher Controls: [Left: Month v] ⇄ [Right: Month v] */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700 shadow-sm">
                <select
                  value={activeLeftMonth?.monthId}
                  onChange={(e) => setLeftMonthId(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-sky-400 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {months.map((m) => (
                    <option key={m.monthId} value={m.monthId} disabled={m.monthId === rightMonthId}>
                      Left: {m.monthLabel}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const temp = leftMonthId;
                    setLeftMonthId(rightMonthId);
                    setRightMonthId(temp);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Swap Left and Right Months"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                </button>

                <select
                  value={activeRightMonth?.monthId}
                  onChange={(e) => setRightMonthId(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-emerald-400 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {months.map((m) => (
                    <option key={m.monthId} value={m.monthId} disabled={m.monthId === leftMonthId}>
                      Right: {m.monthLabel}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold hidden sm:flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-400" />
                  Filtered
                </span>
              )}
            </div>

            {/* Compact Customer & Destination Search Bars (Just Below It) */}
            <div className="flex items-center gap-2">
              {/* Short Customer Search */}
              <div className="relative w-44 sm:w-48" ref={customerDropdownRef}>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-400">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={sectionCustomerSearch !== '' ? sectionCustomerSearch : (selectedCustomer || '')}
                    onChange={(e) => {
                      setSectionCustomerSearch(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onKeyDown={handleCustomerKeyDown}
                    placeholder="Search customer..."
                    className={`w-full pl-7 pr-7 py-1 rounded-lg text-xs bg-slate-950 text-slate-100 placeholder-slate-500 border transition-all focus:outline-none ${
                      selectedCustomer
                        ? 'border-emerald-500/70 ring-1 ring-emerald-500/40 text-emerald-300 font-bold'
                        : 'border-slate-700 hover:border-slate-600 focus:border-indigo-500'
                    }`}
                  />
                  {(sectionCustomerSearch || selectedCustomer) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSectionCustomerSearch('');
                        onCustomerChange?.('ALL');
                      }}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Clear customer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-emerald-400 cursor-pointer"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${isCustomerDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {isCustomerDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-64 max-h-56 overflow-y-auto z-50 rounded-xl bg-[#0b1329] border border-slate-700 shadow-2xl divide-y divide-slate-800">
                    <div className="p-2 bg-slate-950/90 text-[10px] font-bold text-slate-400 flex items-center justify-between sticky top-0 z-10 border-b border-slate-800">
                      <span>Customers ({matchingCustomers.length})</span>
                      <span className="text-slate-500">{totalDistinctCustomersCount} Total</span>
                    </div>
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          onCustomerChange?.('ALL');
                          setSectionCustomerSearch('');
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-900 font-semibold cursor-pointer"
                      >
                        All Customers
                      </button>
                      {matchingCustomers.map((cust) => (
                        <button
                          key={cust.name}
                          type="button"
                          onClick={() => {
                            onCustomerChange?.(cust.name);
                            setSectionCustomerSearch('');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                            selectedCustomer?.toLowerCase() === cust.name.toLowerCase()
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="truncate pr-2">{cust.name}</span>
                          <span className="text-[10px] font-mono opacity-80">{cust.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Short Destination Search */}
              <div className="relative w-32 sm:w-36" ref={destDropdownRef}>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-blue-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={sectionDestSearch !== '' ? sectionDestSearch : (selectedDestination || '')}
                    onChange={(e) => {
                      setSectionDestSearch(e.target.value.toUpperCase());
                      setIsDestDropdownOpen(true);
                    }}
                    onFocus={() => setIsDestDropdownOpen(true)}
                    onKeyDown={handleDestKeyDown}
                    placeholder="Destination..."
                    className={`w-full pl-7 pr-7 py-1 rounded-lg text-xs bg-slate-950 text-slate-100 placeholder-slate-500 border transition-all focus:outline-none ${
                      selectedDestination
                        ? 'border-blue-500/70 ring-1 ring-blue-500/40 text-blue-300 font-bold'
                        : 'border-slate-700 hover:border-slate-600 focus:border-indigo-500'
                    }`}
                  />
                  {(sectionDestSearch || selectedDestination) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSectionDestSearch('');
                        onDestinationChange?.('ALL');
                      }}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Clear destination"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-blue-400 cursor-pointer"
                    >
                      <ChevronDown className={`w-3 h-3 transition-transform ${isDestDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {isDestDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 max-h-56 overflow-y-auto z-50 rounded-xl bg-[#0b1329] border border-slate-700 shadow-2xl divide-y divide-slate-800">
                    <div className="p-2 bg-slate-950/90 text-[10px] font-bold text-slate-400 flex items-center justify-between sticky top-0 z-10 border-b border-slate-800">
                      <span>Destinations ({matchingDestinations.length})</span>
                      <span className="text-slate-500">{distinctDestinations.length} Total</span>
                    </div>
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDestinationChange?.('ALL');
                          setSectionDestSearch('');
                          setIsDestDropdownOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-900 font-semibold cursor-pointer"
                      >
                        All Destinations
                      </button>
                      {matchingDestinations.map((code: string) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            onDestinationChange?.(code);
                            setSectionDestSearch('');
                            setIsDestDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                            selectedDestination?.toUpperCase() === code.toUpperCase()
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="font-mono font-bold">{code}</span>
                          <span className="text-[10px] font-mono opacity-80">
                            {destinationCounts.get(code) || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reset button if active */}
              {(selectedCustomer || selectedDestination) && (
                <button
                  type="button"
                  onClick={() => {
                    onCustomerChange?.('ALL');
                    onDestinationChange?.('ALL');
                    setSectionCustomerSearch('');
                    setSectionDestSearch('');
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer"
                  title="Reset Customer & Destination"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INTERACTIVE CONTROLS */}
        <div className="space-y-3.5 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
          
          {/* 1. Week Selector (W1, W2, W3, W4, W5, All Weeks) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-1.5 min-w-[130px] text-xs font-black uppercase tracking-wider text-indigo-300">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <span>1. Choose Week:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {WEEK_OPTIONS.map((opt) => {
                const isActive = selectedWeek === opt.id;
                return (
                  <button
                    key={String(opt.id)}
                    onClick={() => setSelectedWeek(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400 scale-[1.02]'
                        : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-normal ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                      ({opt.sub})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Calendar Weekday Selector (Sunday - Saturday, All Days) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 min-w-[130px] text-xs font-black uppercase tracking-wider text-purple-300">
              <CalendarCheck className="w-4 h-4 text-purple-400" />
              <span>2. Choose Day:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 flex-1">
              <button
                onClick={() => setSelectedWeekday('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedWeekday === 'ALL'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400 scale-[1.02]'
                    : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800'
                }`}
              >
                All Weekdays
              </button>
              {WEEKDAYS.map((day) => {
                const isActive = selectedWeekday === day.index;
                return (
                  <button
                    key={day.index}
                    onClick={() => setSelectedWeekday(day.index)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400 scale-[1.02]'
                        : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800'
                    }`}
                  >
                    <span>{day.name}</span>
                    <span className={`text-[10px] font-mono font-medium ${isActive ? 'text-purple-200' : 'text-slate-500'}`}>
                      {day.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* 3. SIDE-BY-SIDE HERO COMPARISON CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
          
          {/* LEFT MONTH HERO CARD */}
          <div className="lg:col-span-5 rounded-2xl border-2 border-sky-500/30 bg-gradient-to-br from-sky-950/20 via-slate-950 to-slate-950 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
            <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-sky-400 ring-4 ring-sky-400/20"></span>
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    {activeLeftMonth?.monthLabel || 'Left Month'}
                  </h4>
                  <div className="text-[11px] text-sky-400 font-mono font-semibold">
                    {selectedWeek === 'ALL' ? 'All Weeks (W1–W5)' : `Week ${selectedWeek} (${WEEK_OPTIONS.find(w => w.id === selectedWeek)?.sub})`} • {selectedWeekday === 'ALL' ? 'All Weekdays' : WEEKDAYS[selectedWeekday].name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-black text-white">
                  {(leftStats?.count || 0).toLocaleString()} pkgs
                </div>
                <div className="text-[10px] text-slate-400">Total Volume</div>
              </div>
            </div>

            {/* Triad Metric Tiles: Avg TT, Min TT, Max TT */}
            <div className="grid grid-cols-3 gap-2.5 relative z-10">
              {/* Avg TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Avg TT</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-amber-400">
                  {leftStats && leftStats.count > 0 ? `${leftStats.avgTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Mean velocity</div>
              </div>

              {/* Min TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Min TT</span>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                  {leftStats && leftStats.count > 0 ? `${leftStats.minTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Fastest parcel</div>
              </div>

              {/* Max TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Max TT</span>
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-rose-400">
                  {leftStats && leftStats.count > 0 ? `${leftStats.maxTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Slowest parcel</div>
              </div>
            </div>

            {/* Performance Footer */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono relative z-10">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">On-Time (≤5d):</span>
                <span className="font-bold text-emerald-400">
                  {leftStats && leftStats.count > 0 ? `${leftStats.onTimeRate}%` : 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Delayed (&gt;5d):</span>
                <span className="font-bold text-rose-400">
                  {leftStats && leftStats.count > 0 ? `${leftStats.delayedCount} pkgs` : '0'}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER DELTA / VELOCITY BRIDGE */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="text-center space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                MoM Delta
              </div>
              {ttDiff !== null ? (
                <div className="space-y-1">
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                      ttDiff < 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : ttDiff > 0
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {ttDiff < 0 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : ttDiff > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : null}
                    <span>{ttDiff > 0 ? `+${ttDiff.toFixed(2)}d` : `${ttDiff.toFixed(2)}d`}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">
                    {ttDiff < 0 ? (
                      <span className="text-emerald-400 font-semibold">{Math.abs(ttPercentDiff || 0)}% Faster</span>
                    ) : ttDiff > 0 ? (
                      <span className="text-rose-400 font-semibold">{Math.abs(ttPercentDiff || 0)}% Slower</span>
                    ) : (
                      'Identical'
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-mono">-</span>
              )}
            </div>

            {/* Volume Delta */}
            <div className="text-center pt-2 border-t border-slate-800 w-full">
              <div className="text-[9px] text-slate-500 font-mono">Vol Delta</div>
              <div className={`text-xs font-mono font-bold ${volDiff >= 0 ? 'text-sky-400' : 'text-slate-400'}`}>
                {volDiff > 0 ? `+${volDiff.toLocaleString()}` : volDiff.toLocaleString()}
              </div>
            </div>
          </div>

          {/* RIGHT MONTH HERO CARD */}
          <div className="lg:col-span-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-950 to-slate-950 p-5 shadow-xl relative overflow-hidden flex flex-col justify-between space-y-4">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 relative z-10">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20"></span>
                <div>
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    {activeRightMonth?.monthLabel || 'Right Month'}
                  </h4>
                  <div className="text-[11px] text-emerald-400 font-mono font-semibold">
                    {selectedWeek === 'ALL' ? 'All Weeks (W1–W5)' : `Week ${selectedWeek} (${WEEK_OPTIONS.find(w => w.id === selectedWeek)?.sub})`} • {selectedWeekday === 'ALL' ? 'All Weekdays' : WEEKDAYS[selectedWeekday].name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-black text-white">
                  {(rightStats?.count || 0).toLocaleString()} pkgs
                </div>
                <div className="text-[10px] text-slate-400">Total Volume</div>
              </div>
            </div>

            {/* Triad Metric Tiles: Avg TT, Min TT, Max TT */}
            <div className="grid grid-cols-3 gap-2.5 relative z-10">
              {/* Avg TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Avg TT</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-amber-400">
                  {rightStats && rightStats.count > 0 ? `${rightStats.avgTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Mean velocity</div>
              </div>

              {/* Min TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Min TT</span>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                  {rightStats && rightStats.count > 0 ? `${rightStats.minTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Fastest parcel</div>
              </div>

              {/* Max TT */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>Max TT</span>
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-xl sm:text-2xl font-mono font-black text-rose-400">
                  {rightStats && rightStats.count > 0 ? `${rightStats.maxTT.toFixed(2)}d` : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Slowest parcel</div>
              </div>
            </div>

            {/* Performance Footer */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono relative z-10">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">On-Time (≤5d):</span>
                <span className="font-bold text-emerald-400">
                  {rightStats && rightStats.count > 0 ? `${rightStats.onTimeRate}%` : 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Delayed (&gt;5d):</span>
                <span className="font-bold text-rose-400">
                  {rightStats && rightStats.count > 0 ? `${rightStats.delayedCount} pkgs` : '0'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 4. SIDE-BY-SIDE ALL WEEKDAYS COMPARISON TABLE FOR SELECTED WEEK */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>Detailed Calendar Weekdays for {selectedWeek === 'ALL' ? 'All Weeks' : `Week ${selectedWeek}`}</span>
              <span className="text-xs text-slate-400 font-normal">
                (Click any row to select that weekday above)
              </span>
            </h4>
            <span className="text-xs text-indigo-400 font-bold">
              {activeLeftMonth?.monthLabel} vs {activeRightMonth?.monthLabel}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-[11px] font-black uppercase text-slate-400 border-b border-slate-800">
                  <th className="py-3 px-4 text-left">Calendar Weekday</th>
                  <th className="py-3 px-3 text-sky-400 bg-sky-950/20 border-l border-slate-800" colSpan={4}>
                    {activeLeftMonth?.monthLabel || 'Month A'}
                  </th>
                  <th className="py-3 px-3 text-emerald-400 bg-emerald-950/20 border-l border-slate-800" colSpan={4}>
                    {activeRightMonth?.monthLabel || 'Month B'}
                  </th>
                  <th className="py-3 px-3 text-indigo-300 border-l border-slate-800">
                    MoM Velocity Delta
                  </th>
                </tr>
                <tr className="bg-slate-900/60 text-[10px] font-bold text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-4 text-left">Day</th>
                  <th className="py-2 px-2 text-slate-300 border-l border-slate-800">Avg TT</th>
                  <th className="py-2 px-2 text-emerald-400">Min TT</th>
                  <th className="py-2 px-2 text-rose-400">Max TT</th>
                  <th className="py-2 px-2 text-slate-400">AWBs</th>
                  <th className="py-2 px-2 text-slate-300 border-l border-slate-800">Avg TT</th>
                  <th className="py-2 px-2 text-emerald-400">Min TT</th>
                  <th className="py-2 px-2 text-rose-400">Max TT</th>
                  <th className="py-2 px-2 text-slate-400">AWBs</th>
                  <th className="py-2 px-3 text-indigo-300 border-l border-slate-800">Δ Avg TT (Speed)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                {WEEKDAYS.map((day) => {
                  const isSelected = selectedWeekday === day.index;
                  const leftS = activeLeftMonth ? getStats(activeLeftMonth.monthId, selectedWeek, day.index) : null;
                  const rightS = activeRightMonth ? getStats(activeRightMonth.monthId, selectedWeek, day.index) : null;
                  const dDiff =
                    leftS && rightS && leftS.count > 0 && rightS.count > 0
                      ? Number((rightS.avgTT - leftS.avgTT).toFixed(2))
                      : null;

                  return (
                    <tr
                      key={day.index}
                      onClick={() => setSelectedWeekday(day.index)}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/40 text-white font-bold ring-1 ring-inset ring-indigo-500/50'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-left font-sans font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-indigo-400 ring-2 ring-indigo-400/40' : 'bg-slate-600'
                            }`}
                          ></span>
                          <span className={isSelected ? 'text-indigo-300' : 'text-slate-200'}>{day.name}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                            ACTIVE
                          </span>
                        )}
                      </td>

                      {/* Left Month: Avg, Min, Max, AWBs */}
                      <td className="py-2.5 px-2 font-bold text-amber-400 border-l border-slate-800">
                        {leftS && leftS.count > 0 ? `${leftS.avgTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-emerald-400 font-medium">
                        {leftS && leftS.count > 0 ? `${leftS.minTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-rose-400 font-medium">
                        {leftS && leftS.count > 0 ? `${leftS.maxTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-400 text-[11px]">
                        {leftS ? leftS.count.toLocaleString() : '0'}
                      </td>

                      {/* Right Month: Avg, Min, Max, AWBs */}
                      <td className="py-2.5 px-2 font-bold text-amber-400 border-l border-slate-800">
                        {rightS && rightS.count > 0 ? `${rightS.avgTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-emerald-400 font-medium">
                        {rightS && rightS.count > 0 ? `${rightS.minTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-rose-400 font-medium">
                        {rightS && rightS.count > 0 ? `${rightS.maxTT.toFixed(2)}d` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-400 text-[11px]">
                        {rightS ? rightS.count.toLocaleString() : '0'}
                      </td>

                      {/* Delta */}
                      <td className="py-2.5 px-3 border-l border-slate-800">
                        {dDiff !== null ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              dDiff < 0
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : dDiff > 0
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {dDiff < 0 ? '▼' : dDiff > 0 ? '▲' : '•'}{' '}
                            {dDiff > 0 ? `+${dDiff.toFixed(2)}d` : `${dDiff.toFixed(2)}d`}{' '}
                            <span className="text-[9px] font-normal">
                              ({dDiff < 0 ? 'Faster' : dDiff > 0 ? 'Slower' : 'Same'})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

    </div>
  );
};
