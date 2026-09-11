import React, { useState, useMemo } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Plane,
  FileText,
  Truck,
  X,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Globe,
  Layers,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { MetricSummary, RatioBreakdown, Shipment } from '../types/logistics';
import { formatExcelDate, formatWeight } from '../utils/formatters';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface ExecutiveOverviewProps {
  summary: MetricSummary;
  deliveryTimeline: RatioBreakdown[];
  finalResolutions: RatioBreakdown[];
  filteredShipments: Shipment[];
  rawShipments: Shipment[];
  selectedFinalResolution: string | null;
  selectedTTRange: string | null;
  onSelectResolution: (resolution: string) => void;
  onSelectTTRange: (range: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  summary,
  deliveryTimeline,
  finalResolutions,
  filteredShipments,
  selectedTTRange,
  onSelectTTRange,
  onNavigateTab
}) => {
  // Modal state for Final Resolution Popup
  const [modalResolution, setModalResolution] = useState<string | null>(null);
  const [modalSelectedCategory, setModalSelectedCategory] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(25);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [inspectedShipment, setInspectedShipment] = useState<Shipment | null>(null);
  const [showCauseBreakdown, setShowCauseBreakdown] = useState<boolean>(false);
  const [showCountryBreakdownModal, setShowCountryBreakdownModal] = useState<boolean>(false);
  const [countryModalSearch, setCountryModalSearch] = useState<string>('');
  const [modalSelectedCountry, setModalSelectedCountry] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setModalCurrentPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortField === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-sky-400 inline-block shrink-0 transition-transform" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-sky-400 inline-block shrink-0 transition-transform" />
      );
    }
    return (
      <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-40 group-hover:opacity-100 group-hover:text-slate-300 inline-block shrink-0 transition-opacity" />
    );
  };

  // Helper to extract the primary reason/delay for any shipment
  const getShipmentPrimaryReason = (s: Shipment): string => {
    if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') return s.destinationDelay.trim();
    if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') return s.clearanceDelay.trim();
    if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') return s.transitDelay.trim();
    if (s.remarks && s.remarks !== '-' && s.remarks.trim() !== '') return s.remarks.trim();
    if (s.weekendDelay && s.weekendDelay.toLowerCase() === 'yes') return 'Weekend Hold';
    return 'Other / Unspecified';
  };

  // Donut chart config for Delivery Timeline
  const timelineChartData = {
    labels: deliveryTimeline.map((d) => `${d.name} (${d.percentage}%)`),
    datasets: [
      {
        data: deliveryTimeline.map((d) => d.count),
        backgroundColor: ['#10b981', '#f59e0b'],
        borderColor: ['#047857', '#d97706'],
        borderWidth: 2,
        hoverOffset: 8
      }
    ]
  };

  const timelineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const val = context.raw || 0;
            const total = summary.totalCount;
            const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
            return ` ${val.toLocaleString()} AWBs (${pct}%)`;
          }
        }
      }
    },
    cutout: '72%'
  };

  const totalDelays = summary.transitDelayCount + summary.clearanceDelayCount + summary.destinationDelayCount + (summary.weekendDelayCount || 0);
  const delayRate = summary.totalCount > 0 ? ((totalDelays / summary.totalCount) * 100).toFixed(2) : '0';

  // Filter shipments for the active popup modal resolution based on current active filters
  const modalAllShipments = useMemo(() => {
    if (!modalResolution) return [];
    return filteredShipments.filter((s) => s.finalResolution === modalResolution);
  }, [modalResolution, filteredShipments]);

  // Compute category/root-cause breakdown for the active resolution modal (specifically for RTS, Undelivered, etc.)
  const modalCategoryBreakdown = useMemo(() => {
    if (modalAllShipments.length === 0) return [];
    const countMap: Record<string, number> = {};

    for (const s of modalAllShipments) {
      const reason = getShipmentPrimaryReason(s);
      countMap[reason] = (countMap[reason] || 0) + 1;
    }

    const total = modalAllShipments.length;
    return Object.entries(countMap)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: ((count / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }, [modalAllShipments]);

  // Close modal on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedShipment) {
          setInspectedShipment(null);
        } else if (modalResolution) {
          setModalResolution(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalResolution, inspectedShipment]);

  const modalFilteredShipments = useMemo(() => {
    let list = modalAllShipments;

    if (modalSelectedCategory) {
      list = list.filter((s) => getShipmentPrimaryReason(s).toLowerCase() === modalSelectedCategory.toLowerCase());
    }

    if (modalSelectedCountry) {
      list = list.filter((s) => (s.destination || '').trim().toLowerCase() === modalSelectedCountry.trim().toLowerCase());
    }

    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase().trim();
      list = list.filter((s) => {
        return (
          s.awb.toLowerCase().includes(q) ||
          s.shprName.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q) ||
          s.destination.toLowerCase().includes(q) ||
          (s.recipient && s.recipient.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.remarks && s.remarks.toLowerCase().includes(q)) ||
          (s.clearanceDelay && s.clearanceDelay.toLowerCase().includes(q)) ||
          (s.transitDelay && s.transitDelay.toLowerCase().includes(q)) ||
          (s.destinationDelay && s.destinationDelay.toLowerCase().includes(q))
        );
      });
    }

    if (sortField) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'awb') {
          cmp = (a.awb || '').localeCompare(b.awb || '', undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortField === 'destination') {
          cmp = (a.destination || '').localeCompare(b.destination || '');
        } else if (sortField === 'customer') {
          cmp = (a.customer || '').localeCompare(b.customer || '');
        } else if (sortField === 'shprName') {
          cmp = (a.shprName || '').localeCompare(b.shprName || '');
        } else if (sortField === 'recipient') {
          const recA = (a.recipient || a.city || '').toLowerCase();
          const recB = (b.recipient || b.city || '').toLowerCase();
          cmp = recA.localeCompare(recB);
        } else if (sortField === 'pickup') {
          const dateA = a.pickup ? new Date(a.pickup).getTime() : 0;
          const dateB = b.pickup ? new Date(b.pickup).getTime() : 0;
          cmp = dateA - dateB;
        } else if (sortField === 'weight') {
          cmp = (Number(a.weight) || 0) - (Number(b.weight) || 0);
        } else if (sortField === 'tt') {
          cmp = (Number(a.tt) || 0) - (Number(b.tt) || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [modalAllShipments, modalSelectedCategory, modalSelectedCountry, modalSearch, sortField, sortOrder]);

  const modalTotalPages = Math.ceil(modalFilteredShipments.length / modalPageSize) || 1;
  const modalValidCurrentPage = Math.min(modalCurrentPage, modalTotalPages);

  const modalPaginatedData = useMemo(() => {
    const start = (modalValidCurrentPage - 1) * modalPageSize;
    return modalFilteredShipments.slice(start, start + modalPageSize);
  }, [modalFilteredShipments, modalValidCurrentPage, modalPageSize]);

  // Country breakdown for active resolution modal
  const modalCountryBreakdown = useMemo(() => {
    if (modalAllShipments.length === 0) return [];
    const countryCounts: Record<string, number> = {};
    for (const s of modalAllShipments) {
      const dest = (s.destination || 'UNKNOWN').trim().toUpperCase();
      countryCounts[dest] = (countryCounts[dest] || 0) + 1;
    }
    const total = modalAllShipments.length;
    return Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({
        country,
        count,
        percentage: Number(((count / total) * 100).toFixed(1))
      }));
  }, [modalAllShipments]);

  const filteredCountryBreakdown = useMemo(() => {
    if (!countryModalSearch.trim()) return modalCountryBreakdown;
    const q = countryModalSearch.trim().toLowerCase();
    return modalCountryBreakdown.filter((c) => c.country.toLowerCase().includes(q));
  }, [modalCountryBreakdown, countryModalSearch]);

  // Modal Summary Stats
  const modalStats = useMemo(() => {
    if (modalAllShipments.length === 0) return null;
    let sumTT = 0;
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let totalWeight = 0;
    let totalPkgs = 0;

    for (const s of modalAllShipments) {
      sumTT += s.tt;
      if (s.tt > 0 && s.tt < minTT) minTT = s.tt;
      if (s.tt > maxTT) maxTT = s.tt;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
    }

    const topCountries = modalCountryBreakdown
      .slice(0, 4)
      .map(({ country, count }) => `${country} (${count})`)
      .join(', ');

    return {
      avgTT: (sumTT / modalAllShipments.length).toFixed(2),
      minTT: minTT === Number.MAX_VALUE ? 0 : minTT.toFixed(2),
      maxTT: maxTT.toFixed(2),
      totalWeight: Math.round(totalWeight),
      totalPkgs,
      topCountries: topCountries || 'N/A'
    };
  }, [modalAllShipments, modalCountryBreakdown]);

  // Modal Export Handlers
  const handleExportModalExcel = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Resolution_${modalResolution}`);
    XLSX.writeFile(workbook, `Resolution_${modalResolution}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportModalCSV = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Resolution_${modalResolution}`);
    XLSX.writeFile(workbook, `Resolution_${modalResolution}_${new Date().toISOString().slice(0, 10)}.csv`, {
      bookType: 'csv'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total AWB Volume */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/40 border-2 border-sky-100 dark:border-white/10 hover:border-sky-400 dark:hover:border-sky-500/50 shadow-sm hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-sky-500/10 blur-xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />
          <div className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/30 dark:bg-sky-500/15 dark:text-sky-400 dark:border dark:border-sky-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <Package className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Total Shipments</strong>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
            <strong>{summary.totalCount.toLocaleString()}</strong>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span><strong className="text-slate-900 dark:text-slate-200">{(summary.totalWeight / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> Tons</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span><strong className="text-slate-900 dark:text-slate-200">{summary.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong> Kg</span>
          </div>
        </div>

        {/* Transit Time Performance */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl relative overflow-hidden group flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/40 border-2 border-indigo-100 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-md transition-all">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
          <div className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border dark:border-indigo-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Average Transit Time</strong>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight flex items-baseline justify-center gap-1.5">
            <span><strong>{summary.avgTT}</strong></span>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">days</span>
          </div>
        </div>

        {/* Delivery Timeline (Within 4-5 Days) */}
        <div
          onClick={() => onSelectTTRange('Within 4-5 Days')}
          className={`glass-card p-4 sm:p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/40 border-2 ${
            selectedTTRange === 'Within 4-5 Days'
              ? 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 shadow-glow-emerald'
              : 'border-emerald-100 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/50 shadow-sm hover:shadow-md'
          }`}
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border dark:border-emerald-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>On-Time Rate (≤ 5 Days)</strong>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight flex items-baseline justify-center gap-1">
            <span><strong>{summary.onTimePercentage}%</strong></span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span><strong className="text-emerald-700 dark:text-emerald-400 font-mono font-black">{summary.onTimeCount.toLocaleString()}</strong> AWBs</span>
          </div>
        </div>

        {/* Delay Bottlenecks */}
        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 sm:p-5 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-amber-400 dark:hover:border-amber-500/50 transition-all flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900/40 border-2 border-amber-200 dark:border-white/10 shadow-sm hover:shadow-md"
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:border dark:border-amber-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Recorded Delay Cases</strong>
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight flex items-baseline justify-center gap-2">
            <span><strong>{totalDelays.toLocaleString()}</strong></span>
            <span className="text-xs font-black text-amber-700 dark:text-slate-400 font-mono bg-amber-100/70 dark:bg-transparent px-2 py-0.5 rounded-md border border-amber-300 dark:border-none">({delayRate}%)</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-2 text-xs font-bold text-slate-700 dark:text-slate-400">
            <span>Transit: <strong className="text-sky-600 dark:text-sky-400 font-mono font-black">{summary.transitDelayCount}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Clear: <strong className="text-purple-600 dark:text-purple-400 font-mono font-black">{summary.clearanceDelayCount}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Dest: <strong className="text-amber-600 dark:text-amber-400 font-mono font-black">{summary.destinationDelayCount}</strong></span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>Wknd: <strong className="text-rose-600 dark:text-rose-400 font-mono font-black">{summary.weekendDelayCount}</strong></span>
          </div>
        </div>

      </div>

      {/* 2. DELIVERY TIMELINE & FINAL RESOLUTION SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REQUIREMENT 2: Delivery Timeline Breakdown */}
        <div className="lg:col-span-5 glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delivery Timeline Distribution
                </h2>
              </div>
            </div>

            {/* Donut Chart Container */}
            <div className="h-56 my-3 relative flex items-center justify-center">
              <Doughnut data={timelineChartData} options={timelineChartOptions} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none select-none text-center">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <strong>On-Time</strong>
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight leading-tight">
                  <strong>{summary.onTimePercentage}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Metric Detail Cards */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onSelectTTRange('Within 4-5 Days')}
              className={`p-3 sm:p-4 rounded-2xl text-left transition-all bg-white dark:bg-slate-900/40 border-2 ${
                selectedTTRange === 'Within 4-5 Days'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-400/30 shadow-glow-emerald'
                  : 'border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/15 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-black mb-1">
                <span className="text-emerald-800 dark:text-emerald-400 font-extrabold uppercase text-[11px] tracking-wider">Within 4–5 Days</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-300 dark:border-none">{summary.onTimePercentage}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1">
                {summary.onTimeCount.toLocaleString()}
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">AWBs</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-emerald-950/60 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 dark:bg-emerald-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${summary.onTimePercentage}%` }}
                />
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-1.5 font-bold">
                {selectedTTRange === 'Within 4-5 Days' ? '✓ Filter Applied (Click to reset)' : 'Click to filter on-time →'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTTRange('More Than 5 Days')}
              className={`p-3 sm:p-4 rounded-2xl text-left transition-all bg-white dark:bg-slate-900/40 border-2 ${
                selectedTTRange === 'More Than 5 Days'
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-400/30 shadow-glow-amber'
                  : 'border-amber-200 dark:border-amber-500/20 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/15 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-black mb-1">
                <span className="text-amber-800 dark:text-amber-400 font-extrabold uppercase text-[11px] tracking-wider">&gt; 5 Working Days</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-none">{summary.delayedTimelinePercentage}%</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1">
                {summary.delayedTimelineCount.toLocaleString()}
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">AWBs</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-amber-950/60 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${summary.delayedTimelinePercentage}%` }}
                />
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400/80 mt-1.5 font-bold">
                {selectedTTRange === 'More Than 5 Days' ? '✓ Filter Applied (Click to reset)' : 'Click to filter delayed →'}
              </div>
            </button>
          </div>
        </div>

        {/* REQUIREMENT 3: Final Resolution Breakdown (CLICK TO OPEN POPUP MODAL) */}
        <div className="lg:col-span-7 glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Final Resolution &amp; Outcome Status
                </h2>
              </div>
            </div>

            {/* Visual Status Progress Multi-Bar */}
            <div className="my-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Delivery Success vs Exceptions</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {finalResolutions.find(r => r.name.toLowerCase() === 'delivered')?.percentage || 0}% Delivered
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex border border-slate-200 dark:border-transparent">
                {finalResolutions.map((res) => (
                  <div
                    key={res.name}
                    className="h-full transition-all duration-500 cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setModalResolution(res.name);
                      setModalSelectedCategory(null);
                      setModalSelectedCountry(null);
                      setSortField(null);
                      setSortOrder('asc');
                      setShowCauseBreakdown(false);
                      setModalSearch('');
                      setModalCurrentPage(1);
                    }}
                    style={{
                      width: `${Math.max(res.percentage, res.count > 0 ? 0.8 : 0)}%`,
                      backgroundColor: res.color
                    }}
                    title={`Click to open popup: ${res.name} (${res.count} AWBs / ${res.percentage}%)`}
                  />
                ))}
              </div>
            </div>

            {/* Resolution Cards Grid - Interactive Clickable Cards (Opens Popup Modal) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {finalResolutions.map((res) => {
                const isNegative = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(res.name.toLowerCase().trim());
                const isSuccess = res.name.toLowerCase().trim() === 'delivered';

                return (
                  <button
                    key={res.name}
                    type="button"
                    onClick={() => {
                      setModalResolution(res.name);
                      setModalSelectedCategory(null);
                      setModalSelectedCountry(null);
                      setSortField(null);
                      setSortOrder('asc');
                      setShowCauseBreakdown(false);
                      setModalSearch('');
                      setModalCurrentPage(1);
                    }}
                    className={`p-3 rounded-2xl text-left transition-all relative overflow-hidden group border ${
                      isNegative
                        ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400 hover:bg-rose-100/60 shadow-xs hover:shadow-md dark:bg-slate-900/90 dark:border-rose-500/50 dark:hover:border-rose-400 dark:shadow-[0_0_15px_rgba(244,63,94,0.15)] dark:hover:shadow-[0_0_25px_rgba(244,63,94,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                        : isSuccess
                        ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/60 shadow-xs hover:shadow-md dark:bg-gradient-to-br dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900 dark:border-emerald-900/50 dark:hover:border-emerald-500 dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80 shadow-xs hover:shadow-md dark:bg-slate-900/80 dark:border-slate-800 dark:hover:border-blue-500/60 dark:hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isNegative ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs dark:shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse flex-shrink-0" />
                        ) : isSuccess ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs dark:shadow-[0_0_8px_rgba(16,185,129,0.8)] flex-shrink-0" />
                        ) : (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: res.color }}
                          />
                        )}
                        <span className={`text-xs font-bold truncate ${
                          isNegative 
                            ? 'text-slate-800 dark:text-white dark:group-hover:text-rose-200 font-extrabold' 
                            : isSuccess 
                            ? 'text-slate-800 dark:text-emerald-200 dark:group-hover:text-emerald-100 font-extrabold' 
                            : 'text-slate-800 dark:text-slate-200 dark:group-hover:text-blue-300 font-bold'
                        }`}>
                          {res.name}
                        </span>
                      </div>
                      {isNegative && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 dark:shadow-[0_0_8px_rgba(244,63,94,0.2)]">
                          Negative
                        </span>
                      )}
                      {isSuccess && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                          Success
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between">
                      <span className={`text-lg font-black font-mono tracking-tight ${
                        isNegative 
                          ? 'text-rose-700 dark:text-rose-400 dark:group-hover:text-rose-300' 
                          : isSuccess 
                          ? 'text-emerald-700 dark:text-emerald-400 dark:group-hover:text-emerald-300' 
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {res.count.toLocaleString()}
                      </span>
                      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isNegative 
                          ? 'bg-white text-rose-700 border border-rose-200 shadow-2xs dark:bg-slate-800 dark:text-rose-300 dark:border-rose-900/50' 
                          : isSuccess 
                          ? 'bg-white text-emerald-800 border border-emerald-200 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50' 
                          : 'bg-white text-slate-700 border border-slate-200 shadow-2xs dark:text-slate-400 dark:bg-slate-800/80 dark:border-slate-700/50'
                      }`}>
                        {res.percentage}%
                      </span>
                    </div>

                    <div className={`mt-1.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                      isNegative ? 'text-rose-700 dark:text-rose-400' : isSuccess ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {isNegative ? (
                        <><AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Negative outlier • View popup →</>
                      ) : isSuccess ? (
                        <><CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Delivered • View popup →</>
                      ) : (
                        <><Eye className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Click to view details →</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Hub Navigation Link */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end text-xs">
            <button
              onClick={() => onNavigateTab('delays')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              Open Delay Hub <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 3. FULL-FEATURED POPUP MODAL FOR FINAL RESOLUTION EXPLORER */}
      {modalResolution && (() => {
        const isModalNegative = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(modalResolution.toLowerCase().trim());
        const isModalSuccess = modalResolution.toLowerCase().trim() === 'delivered';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fade-in">
            <div className={`w-full max-w-[96vw] 2xl:max-w-[1600px] max-h-[92vh] p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden bg-white dark:bg-slate-950/95 border ${
              isModalNegative 
                ? 'border-rose-300 dark:border-rose-500/50 shadow-xl dark:shadow-[0_0_40px_rgba(239,68,68,0.25)]' 
                : isModalSuccess 
                ? 'border-emerald-300 dark:border-emerald-500/40 shadow-xl dark:shadow-[0_0_30px_rgba(16,185,129,0.15)]' 
                : 'border-blue-300 dark:border-blue-500/40 shadow-xl'
            }`}>
              
              {/* Modal Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isModalNegative
                        ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/40 dark:shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        : isModalSuccess
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/40'
                        : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'
                    }`}>
                      {isModalNegative ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                          Final Resolution:{' '}
                          <span className={`font-black ${
                            isModalNegative ? 'text-rose-600 dark:text-rose-400' : isModalSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>
                            {modalResolution}
                          </span>
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          isModalNegative
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                            : isModalSuccess
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                        }`}>
                          {modalAllShipments.length.toLocaleString()} Total AWBs
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setModalResolution(null);
                      setShowCountryBreakdownModal(false);
                    }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

              {/* Quick Metrics Strip - Option C: Dark Command-Center Block */}
              {modalStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Average Transit Time</span>
                    <span className="text-base sm:text-lg font-black text-indigo-400 font-mono">
                      {modalStats.avgTT} <span className="text-xs font-medium text-slate-400">days</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono font-medium mt-0.5">
                      Min: {modalStats.minTT}d • Max: {modalStats.maxTT}d
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Volume &amp; Wt</span>
                    <span className="text-base sm:text-lg font-black text-white font-mono">
                      {modalAllShipments.length.toLocaleString()} AWBs
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono font-medium mt-0.5">
                      {modalStats.totalWeight.toLocaleString()} kg • {modalStats.totalPkgs.toLocaleString()} pkgs
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 col-span-2 shadow-md flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Top Destination
                      </span>
                      <div className="flex items-center gap-2">
                        {modalSelectedCountry && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalSelectedCountry(null);
                              setModalCurrentPage(1);
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                          >
                            Reset ({modalSelectedCountry})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCountryModalSearch('');
                            setShowCountryBreakdownModal(true);
                          }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                          title="View all in popup window"
                        >
                          View Breakdown ({modalCountryBreakdown.length}) →
                        </button>
                      </div>
                    </div>

                    {/* Dropdown list for Top Destination */}
                    <div className="relative mt-1.5">
                      <select
                        value={modalSelectedCountry || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModalSelectedCountry(val || null);
                          setModalCurrentPage(1);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 hover:border-emerald-500/60 focus:border-emerald-500 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-xs"
                      >
                        <option value="" className="bg-slate-900 text-slate-300 font-medium">
                          All Destinations ({modalAllShipments.length.toLocaleString()} AWBs • {modalCountryBreakdown.length} countries)
                        </option>
                        {modalCountryBreakdown.map((item, idx) => (
                          <option
                            key={item.country}
                            value={item.country}
                            className="bg-slate-900 text-white font-mono"
                          >
                            #{idx + 1} {item.country} — {item.count.toLocaleString()} AWBs ({item.percentage}%)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-medium">
                      <span className="truncate">
                        {modalSelectedCountry
                          ? `Filtered to ${modalSelectedCountry}: ${modalFilteredShipments.length} matching shipments`
                          : `Top: ${modalStats.topCountries}`}
                      </span>
                      <span className="text-slate-500 shrink-0 ml-2">Sorted by volume</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Categorized Root-Cause / Delay Reason Breakdown (Specifically for RTS, Undelivered & All Statuses) */}
              {modalCategoryBreakdown.length > 0 && (
                <div className="mb-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900/90 dark:border-slate-800/80 space-y-2.5 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                        <strong>Root Cause &amp; Delay Reason Breakdown ({modalCategoryBreakdown.length} Distinct Causes)</strong>
                      </span>
                      {modalSelectedCategory && !showCauseBreakdown && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30">
                          Active Cause: {modalSelectedCategory}
                        </span>
                      )}
                    </div>

                    {/* On / Off Switch for Cause Breakdown */}
                    <div className="flex items-center gap-2.5 bg-white border border-slate-200 shadow-2xs dark:bg-slate-950/80 dark:border-slate-800 px-2.5 py-1 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none">
                        {showCauseBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showCauseBreakdown}
                        onClick={() => setShowCauseBreakdown(!showCauseBreakdown)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer border ${
                          showCauseBreakdown
                            ? 'bg-blue-600 border-blue-500 justify-end'
                            : 'bg-slate-300 dark:bg-slate-800 border-slate-400 dark:border-slate-600 justify-start'
                        }`}
                        title={showCauseBreakdown ? 'Click to hide causes and expand AWB table' : 'Click to show all cause breakdown pills'}
                      >
                        <div className="bg-white w-3.5 h-3.5 rounded-full shadow-md" />
                      </button>
                    </div>
                  </div>

                  {showCauseBreakdown && (
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto no-scrollbar pt-0.5 animate-fade-in">
                      {/* All Causes Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setModalSelectedCategory(null);
                          setModalCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                          modalSelectedCategory === null
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/35 border border-blue-500 scale-[1.02]'
                            : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-300 shadow-2xs dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:border-slate-700'
                        }`}
                      >
                        <span><strong>All Causes</strong></span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-black/30 dark:text-white font-bold">
                          {modalAllShipments.length}
                        </span>
                      </button>

                      {/* Individual Reason Chips */}
                      {modalCategoryBreakdown.map((cat) => {
                        const isSelected = modalSelectedCategory?.toLowerCase() === cat.reason.toLowerCase();
                        return (
                          <button
                            key={cat.reason}
                            type="button"
                            onClick={() => {
                              setModalSelectedCategory(isSelected ? null : cat.reason);
                              setModalCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 group ${
                              isSelected
                                ? isModalNegative
                                  ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white shadow-lg shadow-rose-600/35 border border-rose-400/60 scale-[1.02] ring-2 ring-rose-500/30'
                                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/35 border border-blue-400/60 scale-[1.02] ring-2 ring-blue-500/30'
                                : 'bg-white text-slate-800 hover:bg-rose-50 hover:text-rose-900 border border-slate-300 shadow-2xs dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white dark:border-slate-700/80 dark:hover:border-slate-500'
                            }`}
                          >
                            <span><strong>{cat.reason}</strong></span>
                            <span className={`font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-white/25 text-white font-black'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-slate-900 dark:text-rose-300 dark:border-rose-900/40 dark:group-hover:border-rose-500/40'
                            }`}>
                              <strong>{cat.count} AWBs ({cat.percentage}%)</strong>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Search & Export Toolbar inside Modal */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setModalCurrentPage(1);
                    }}
                    placeholder={`Search within ${modalResolution} (AWB, Shipper, Customer, Destination, Remarks)...`}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-xs dark:bg-slate-900 dark:border-slate-700/80 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {sortField && (
                    <button
                      type="button"
                      onClick={() => setSortField(null)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-300 text-xs font-semibold transition-all cursor-pointer"
                      title="Clear active sorting"
                    >
                      <span>Sorted: <strong className="text-white capitalize">{sortField === 'destination' ? 'Dest' : sortField === 'shprName' ? 'Shipper' : sortField === 'tt' ? 'TT' : sortField}</strong> ({sortOrder.toUpperCase()})</span>
                      <X className="w-3 h-3 text-sky-400 hover:text-white ml-0.5" />
                    </button>
                  )}

                  <button
                    onClick={handleExportModalExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold border border-emerald-300 hover:border-emerald-600 shadow-xs transition-all dark:bg-emerald-600/20 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white dark:border-emerald-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel</span>
                  </button>

                  <button
                    onClick={handleExportModalCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold border border-blue-300 hover:border-blue-600 shadow-xs transition-all dark:bg-blue-600/20 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white dark:border-blue-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Table Container - Option C: Dark Command-Center Grid */}
            <div className={`flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-lg my-1 transition-all ${
              showCauseBreakdown ? 'max-h-[46vh]' : 'max-h-[62vh]'
            }`}>
              <table className="w-full text-center text-xs min-w-[950px]">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300 font-bold uppercase text-[10px] tracking-wider z-10 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('awb')}
                      className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by AWB Tracking #"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'awb' ? 'text-sky-300 font-black' : ''}>AWB Tracking #</span>
                        {renderSortIcon('awb')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('destination')}
                      className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Destination"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'destination' ? 'text-sky-300 font-black' : ''}>Dest</span>
                        {renderSortIcon('destination')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customer')}
                      className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Customer Account"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'customer' ? 'text-sky-300 font-black' : ''}>Customer Account</span>
                        {renderSortIcon('customer')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('shprName')}
                      className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Shipper Name"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'shprName' ? 'text-sky-300 font-black' : ''}>Shipper Name</span>
                        {renderSortIcon('shprName')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('recipient')}
                      className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Recipient / City"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'recipient' ? 'text-sky-300 font-black' : ''}>Recipient / City</span>
                        {renderSortIcon('recipient')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('pickup')}
                      className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Pickup Date"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'pickup' ? 'text-sky-300 font-black' : ''}>Pickup Date</span>
                        {renderSortIcon('pickup')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('weight')}
                      className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Weight"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'weight' ? 'text-sky-300 font-black' : ''}>Weight (kg)</span>
                        {renderSortIcon('weight')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('tt')}
                      className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-800/80 transition-colors group"
                      title="Click to sort by Transit Time"
                    >
                      <div className="inline-flex items-center justify-center gap-1 mx-auto">
                        <span className={sortField === 'tt' ? 'text-sky-300 font-black' : ''}>TT (Days)</span>
                        {renderSortIcon('tt')}
                      </div>
                    </th>
                    <th className="py-2.5 px-2.5 text-center align-middle">Timeline</th>
                    <th className="py-2.5 px-3 text-center align-middle">Logged Delays &amp; Remarks</th>
                    <th className="py-2.5 px-2 text-center align-middle">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950 font-sans">
                  {modalPaginatedData.map((s, idx) => (
                    <tr key={`${s.awb}-${idx}`} className="hover:bg-slate-900/90 text-slate-200 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-sky-400 group-hover:text-sky-300 hover:underline text-center align-middle">{s.awb}</td>
                      <td className="py-2 px-2.5 font-bold text-white font-mono text-center align-middle">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200">
                          {s.destination}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-white max-w-[150px] truncate text-center align-middle mx-auto" title={s.customer}>
                        {s.customer || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-[150px] truncate font-medium text-center align-middle mx-auto" title={s.shprName}>
                        {s.shprName || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-[140px] truncate text-center align-middle">
                        <div className="font-semibold text-white truncate text-center">{s.recipient || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate text-center">{s.city || '-'}</div>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap text-center align-middle">
                        {formatExcelDate(s.pickup)}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-slate-200 whitespace-nowrap text-center align-middle">
                        {s.weight ? `${formatWeight(s.weight)}` : '-'}
                      </td>
                      <td className="py-2 px-2.5 font-mono font-bold text-indigo-400 text-center align-middle">
                        {Number(s.tt || 0).toFixed(1)} d
                      </td>
                      <td className="py-2 px-2.5 text-center align-middle">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            s.tt <= 5
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {s.tt <= 5 ? '≤5d' : '>5d'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] max-w-[180px] truncate text-center align-middle">
                        <div className="flex items-center justify-center truncate">
                          {s.remarks && s.remarks !== '-' ? (
                            <span className="text-amber-300 font-bold truncate" title={s.remarks}>
                              {s.remarks}
                            </span>
                          ) : s.clearanceDelay && s.clearanceDelay !== '-' ? (
                            <span className="text-amber-400 font-bold truncate" title={s.clearanceDelay}>
                              📋 {s.clearanceDelay}
                            </span>
                          ) : s.transitDelay && s.transitDelay !== '-' ? (
                            <span className="text-indigo-400 font-bold truncate" title={s.transitDelay}>
                              ✈️ {s.transitDelay}
                            </span>
                          ) : s.destinationDelay && s.destinationDelay !== '-' ? (
                            <span className="text-rose-400 font-bold truncate" title={s.destinationDelay}>
                              🚚 {s.destinationDelay}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center align-middle">
                        <button
                          onClick={() => setInspectedShipment(s)}
                          className="p-1 rounded bg-slate-900 hover:bg-blue-600 text-sky-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          title="Inspect full details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {modalPaginatedData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400 font-semibold">
                        No shipment records match &quot;{modalSearch}&quot; for status {modalResolution}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Pagination Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Rows:</span>
                <select
                  value={modalPageSize}
                  onChange={(e) => {
                    setModalPageSize(Number(e.target.value));
                    setModalCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-800 dark:text-white font-medium shadow-2xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {modalFilteredShipments.length > 0 ? (modalValidCurrentPage - 1) * modalPageSize + 1 : 0}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(modalValidCurrentPage * modalPageSize, modalFilteredShipments.length)}
                  </strong>{' '}
                  of <strong className="text-slate-900 dark:text-white">{modalFilteredShipments.length}</strong> records
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={modalValidCurrentPage <= 1}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 disabled:opacity-30 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-transparent dark:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  Page {modalValidCurrentPage} of {modalTotalPages}
                </span>
                <button
                  onClick={() => setModalCurrentPage((p) => Math.min(p + 1, modalTotalPages))}
                  disabled={modalValidCurrentPage >= modalTotalPages}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 disabled:opacity-30 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-transparent dark:text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setModalResolution(null)}
                  className="ml-3 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-transparent dark:text-white text-xs cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>

            {/* 4. COUNTRY-WISE IMPACTED SHIPMENTS POPUP MODAL */}
            {showCountryBreakdownModal && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in">
                <div className="w-full max-w-2xl max-h-[88vh] p-5 sm:p-6 rounded-3xl flex flex-col shadow-2xl relative overflow-hidden bg-slate-950 border border-emerald-500/40 text-slate-200">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-extrabold text-white">
                            Country-Wise Impacted Shipments
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                            {modalResolution}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Total <strong className="text-white font-mono">{modalAllShipments.length.toLocaleString()} AWBs</strong> across{' '}
                          <strong className="text-white font-mono">{modalCountryBreakdown.length} countries</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCountryBreakdownModal(false)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Close popup"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quick Summary Cards */}
                  <div className="grid grid-cols-3 gap-2.5 my-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Countries</span>
                      <span className="text-base font-black text-white font-mono">{modalCountryBreakdown.length}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Impacted Shipments</span>
                      <span className="text-base font-black text-emerald-400 font-mono">{modalAllShipments.length.toLocaleString()}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-center truncate">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Top Concentration</span>
                      <span className="text-base font-black text-sky-400 font-mono truncate block">
                        {modalCountryBreakdown[0] ? `${modalCountryBreakdown[0].country} (${modalCountryBreakdown[0].count})` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={countryModalSearch}
                      onChange={(e) => setCountryModalSearch(e.target.value)}
                      placeholder="Search country code (e.g. US, IN, BR, CA)..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-medium"
                    />
                    {countryModalSearch && (
                      <button
                        type="button"
                        onClick={() => setCountryModalSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Country List Table */}
                  <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 max-h-[46vh]">
                    <table className="w-full text-center text-xs">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-300 font-bold uppercase text-[10px] tracking-wider z-10">
                        <tr>
                          <th className="py-2.5 px-3 text-center">Rank</th>
                          <th className="py-2.5 px-3 text-center">Country</th>
                          <th className="py-2.5 px-3 text-center">Impacted Shipments</th>
                          <th className="py-2.5 px-4 text-center min-w-[140px]">Share (%)</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-sans">
                        {filteredCountryBreakdown.map((item, index) => (
                          <tr key={item.country} className="hover:bg-slate-900/90 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-[11px]">
                              #{index + 1}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-xs text-white">
                                {item.country}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-sm text-emerald-400">
                              {item.count.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">AWBs</span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-[11px] text-slate-300 min-w-[38px] text-right">
                                  {item.percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalSelectedCountry(item.country);
                                  setModalCurrentPage(1);
                                  setShowCountryBreakdownModal(false);
                                }}
                                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-emerald-600 hover:text-white border border-slate-700 text-emerald-400 text-[10px] font-bold transition-colors cursor-pointer"
                                title={`Filter main table to ${item.country}`}
                              >
                                Filter Table
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredCountryBreakdown.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 font-medium">
                              No countries match &quot;{countryModalSearch}&quot;
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-3.5 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Showing <strong className="text-white font-mono">{filteredCountryBreakdown.length}</strong> of{' '}
                      <strong className="text-white font-mono">{modalCountryBreakdown.length}</strong> countries
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCountryBreakdownModal(false)}
                      className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700 cursor-pointer transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )})()}

      {/* Single Shipment Detail Sub-Modal */}
      {inspectedShipment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 dark:bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">AWB #{inspectedShipment.awb}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">MAWB: {inspectedShipment.mawb || 'N/A'}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedShipment(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Customer</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.customer}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Shipper</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.shprName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Destination / Recipient</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.destination} ({inspectedShipment.city || 'N/A'})
                </span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px] block">{inspectedShipment.recipient}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Transit Time (TT)</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-base font-mono block mt-0.5">
                  {inspectedShipment.tt} days
                </span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">{inspectedShipment.ttRange}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Final Resolution</span>
                <span className={`font-black block mt-0.5 ${
                  inspectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(inspectedShipment.finalResolution)
                    ? 'text-rose-600 dark:text-rose-400 font-extrabold'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {inspectedShipment.finalResolution}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Pkg &amp; Weight</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.weight} kg • {inspectedShipment.pkgCount} pcs
                </span>
              </div>
            </div>

            {inspectedShipment.description && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Description</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5 font-medium">{inspectedShipment.description}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedShipment(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. QUICK OPERATIONAL SUMMARY HIGHLIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 sm:p-5 rounded-2xl cursor-pointer bg-white dark:bg-slate-900/40 border-2 border-indigo-100 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-sm hover:shadow-md"
        >
          <div className="absolute top-3.5 right-3.5 p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border dark:border-indigo-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <Plane className="w-4 h-4" />
          </div>
          <div className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Transit Delay Incidents</strong>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-white mt-1.5 flex items-baseline justify-center gap-1.5">
            <span><strong>{summary.transitDelayCount.toLocaleString()}</strong></span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">AWBs</span>
          </div>
          <span className="text-xs text-indigo-700 dark:text-indigo-400 font-extrabold mt-1.5 group-hover:underline">
            CDG, US, Gateway bottlenecks →
          </span>
        </div>

        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 sm:p-5 rounded-2xl cursor-pointer bg-white dark:bg-slate-900/40 border-2 border-amber-200 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-sm hover:shadow-md"
        >
          <div className="absolute top-3.5 right-3.5 p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:border dark:border-amber-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Customs Clearance Delays</strong>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-white mt-1.5 flex items-baseline justify-center gap-1.5">
            <span><strong>{summary.clearanceDelayCount.toLocaleString()}</strong></span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">AWBs</span>
          </div>
          <span className="text-xs text-amber-700 dark:text-amber-400 font-extrabold mt-1.5 group-hover:underline">
            Invoices, KYC, Inspections →
          </span>
        </div>

        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 sm:p-5 rounded-2xl cursor-pointer bg-white dark:bg-slate-900/40 border-2 border-rose-200 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-sm hover:shadow-md"
        >
          <div className="absolute top-3.5 right-3.5 p-2.5 rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/30 dark:bg-rose-500/15 dark:text-rose-400 dark:border dark:border-rose-500/20 dark:shadow-none group-hover:scale-110 transition-transform">
            <Truck className="w-4 h-4" />
          </div>
          <div className="text-xs font-black text-slate-700 dark:text-slate-400 uppercase tracking-wider">
            <strong>Destination Delays</strong>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-white mt-1.5 flex items-baseline justify-center gap-1.5">
            <span><strong>{summary.destinationDelayCount.toLocaleString()}</strong></span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">AWBs</span>
          </div>
          <span className="text-xs text-rose-700 dark:text-rose-400 font-extrabold mt-1.5 group-hover:underline">
            Last-mile &amp; delivery exceptions →
          </span>
        </div>
      </div>

    </div>
  );
};
