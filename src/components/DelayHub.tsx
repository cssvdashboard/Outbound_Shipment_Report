import React, { useState, useMemo, useEffect } from 'react';
import {
  Plane,
  FileText,
  Truck,
  Calendar,
  Search,
  Filter,
  ArrowRight,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Clock,
  Eye,
  ExternalLink,
  ShieldAlert,
  Building,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { RatioBreakdown, MetricSummary, Shipment } from '../types/logistics';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

export interface DelayModalTarget {
  category: 'transit' | 'clearance' | 'destination' | 'weekend';
  reason?: string; // If undefined, shows all delays in that category
  title: string;
}

interface DelayHubProps {
  summary: MetricSummary;
  filteredShipments?: Shipment[];
  transitDelays: RatioBreakdown[];
  clearanceDelays: RatioBreakdown[];
  destinationDelays: RatioBreakdown[];
  onSelectDelayFilter: (category: 'transit' | 'clearance' | 'destination', reason: string) => void;
  activeTransitFilter: string[];
  activeClearanceFilter: string[];
  activeDestinationFilter: string[];
  onNavigateTab: (tab: string) => void;
}

export const DelayHub: React.FC<DelayHubProps> = ({
  summary,
  filteredShipments = [],
  transitDelays,
  clearanceDelays,
  destinationDelays,
  onSelectDelayFilter,
  activeTransitFilter,
  activeClearanceFilter,
  activeDestinationFilter
}) => {
  const [activeCategory, setActiveCategory] = useState<'transit' | 'clearance' | 'destination'>('transit');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State for Delay AWB List Popup Window
  const [modalTarget, setModalTarget] = useState<DelayModalTarget | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(25);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [inspectedShipment, setInspectedShipment] = useState<Shipment | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedShipment) {
          setInspectedShipment(null);
        } else if (modalTarget) {
          setModalTarget(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalTarget, inspectedShipment]);

  const currentList = useMemo(() => {
    let list: RatioBreakdown[] = [];
    if (activeCategory === 'transit') list = transitDelays;
    else if (activeCategory === 'clearance') list = clearanceDelays;
    else list = destinationDelays;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeCategory, transitDelays, clearanceDelays, destinationDelays, searchTerm]);

  // Chart data for top 8 reasons
  const topReasons = currentList.slice(0, 8);
  const barChartData = {
    labels: topReasons.map((r) => (r.name.length > 22 ? r.name.slice(0, 20) + '...' : r.name)),
    datasets: [
      {
        label: 'Count of Delayed AWBs',
        data: topReasons.map((r) => r.count),
        backgroundColor:
          activeCategory === 'transit'
            ? 'rgba(99, 102, 241, 0.85)'
            : activeCategory === 'clearance'
            ? 'rgba(245, 158, 11, 0.85)'
            : 'rgba(239, 68, 68, 0.85)',
        borderColor:
          activeCategory === 'transit'
            ? '#4f46e5'
            : activeCategory === 'clearance'
            ? '#d97706'
            : '#dc2626',
        borderWidth: 1,
        borderRadius: 8
      }
    ]
  };

  const barChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const selectedReason = topReasons[index];
        if (selectedReason) {
          setModalTarget({
            category: activeCategory,
            reason: selectedReason.name,
            title: selectedReason.name
          });
          setModalSearch('');
          setModalCurrentPage(1);
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.raw.toLocaleString()} AWBs (${topReasons[ctx.dataIndex]?.percentage || 0}%) — Click to open AWB list`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' as const } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' as const } }
      }
    }
  };

  const getActiveFilterList = () => {
    if (activeCategory === 'transit') return activeTransitFilter;
    if (activeCategory === 'clearance') return activeClearanceFilter;
    return activeDestinationFilter;
  };

  const activeFiltersForCategory = getActiveFilterList();

  // Filter shipments for the active popup modal
  const modalAllShipments = useMemo(() => {
    if (!modalTarget) return [];
    const { category, reason } = modalTarget;

    return filteredShipments.filter((s) => {
      if (category === 'transit') {
        if (!s.transitDelay || s.transitDelay === '-' || s.transitDelay.trim() === '') return false;
        if (reason && reason !== 'ALL' && s.transitDelay.trim().toLowerCase() !== reason.trim().toLowerCase()) return false;
        return true;
      }
      if (category === 'clearance') {
        if (!s.clearanceDelay || s.clearanceDelay === '-' || s.clearanceDelay.trim() === '') return false;
        if (reason && reason !== 'ALL' && s.clearanceDelay.trim().toLowerCase() !== reason.trim().toLowerCase()) return false;
        return true;
      }
      if (category === 'destination') {
        if (!s.destinationDelay || s.destinationDelay === '-' || s.destinationDelay.trim() === '') return false;
        if (reason && reason !== 'ALL' && s.destinationDelay.trim().toLowerCase() !== reason.trim().toLowerCase()) return false;
        return true;
      }
      if (category === 'weekend') {
        if (!s.weekendDelay) return false;
        const w = s.weekendDelay.toLowerCase().trim();
        if (w !== 'yes' && w === '') return false;
        return true;
      }
      return false;
    });
  }, [modalTarget, filteredShipments]);

  // Search filter inside modal
  const modalFilteredShipments = useMemo(() => {
    if (!modalSearch.trim()) return modalAllShipments;
    const q = modalSearch.toLowerCase().trim();
    return modalAllShipments.filter((s) => {
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
        (s.destinationDelay && s.destinationDelay.toLowerCase().includes(q)) ||
        (s.weekendDelay && s.weekendDelay.toLowerCase().includes(q)) ||
        (s.finalResolution && s.finalResolution.toLowerCase().includes(q))
      );
    });
  }, [modalAllShipments, modalSearch]);

  const modalTotalPages = Math.ceil(modalFilteredShipments.length / modalPageSize) || 1;
  const modalValidCurrentPage = Math.min(modalCurrentPage, modalTotalPages);

  const modalPaginatedData = useMemo(() => {
    const start = (modalValidCurrentPage - 1) * modalPageSize;
    return modalFilteredShipments.slice(start, start + modalPageSize);
  }, [modalFilteredShipments, modalValidCurrentPage, modalPageSize]);

  // Modal Summary Stats
  const modalStats = useMemo(() => {
    if (modalAllShipments.length === 0) return null;
    let sumTT = 0;
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let totalWeight = 0;
    let totalPkgs = 0;
    const countryCounts: Record<string, number> = {};

    for (const s of modalAllShipments) {
      sumTT += s.tt;
      if (s.tt > 0 && s.tt < minTT) minTT = s.tt;
      if (s.tt > maxTT) maxTT = s.tt;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
      if (s.destination) countryCounts[s.destination] = (countryCounts[s.destination] || 0) + 1;
    }

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c, count]) => `${c} (${count})`)
      .join(', ');

    return {
      avgTT: (sumTT / modalAllShipments.length).toFixed(2),
      minTT: minTT === Number.MAX_VALUE ? 0 : minTT.toFixed(2),
      maxTT: maxTT.toFixed(2),
      totalWeight: totalWeight.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      totalPkgs: totalPkgs.toLocaleString(),
      topCountries: topCountries || 'N/A'
    };
  }, [modalAllShipments]);

  // Modal Export Handlers
  const handleExportModalExcel = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    const cleanTitle = (modalTarget?.title || 'Delays').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanTitle);
    XLSX.writeFile(workbook, `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportModalCSV = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    const cleanTitle = (modalTarget?.title || 'Delays').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanTitle);
    XLSX.writeFile(workbook, `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`, {
      bookType: 'csv'
    });
  };

  const getCategoryColor = (cat: 'transit' | 'clearance' | 'destination' | 'weekend') => {
    switch (cat) {
      case 'transit':
        return {
          text: 'text-indigo-400',
          bg: 'bg-indigo-500/20',
          border: 'border-indigo-500/40',
          glow: 'shadow-[0_0_30px_rgba(99,102,241,0.25)]',
          badge: 'bg-indigo-950 text-indigo-300 border-indigo-700'
        };
      case 'clearance':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40',
          glow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
          badge: 'bg-amber-950 text-amber-300 border-amber-700'
        };
      case 'destination':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/20',
          border: 'border-rose-500/40',
          glow: 'shadow-[0_0_30px_rgba(239,68,68,0.25)]',
          badge: 'bg-rose-950 text-rose-300 border-rose-700'
        };
      case 'weekend':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-500/20',
          border: 'border-cyan-500/40',
          glow: 'shadow-[0_0_30px_rgba(6,182,212,0.25)]',
          badge: 'bg-cyan-950 text-cyan-300 border-cyan-700'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP DELAY CATEGORY OVERVIEW CARDS (Clickable -> Opens Modal) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Transit Delays */}
        <div
          onClick={() => {
            setActiveCategory('transit');
            setModalTarget({ category: 'transit', title: 'Transit Delays (All Incidents)' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
            activeCategory === 'transit'
              ? 'ring-2 ring-indigo-500 bg-indigo-950/40 shadow-glow-indigo'
              : 'hover:border-indigo-500/40'
          }`}
          title="Click to view all Transit Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Transit Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.transitDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-indigo-400 font-bold mt-1 flex items-center justify-between">
              <strong>{transitDelays.length} Distinct Causes</strong>
              <span className="text-[10px] text-indigo-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div
          onClick={() => {
            setActiveCategory('clearance');
            setModalTarget({ category: 'clearance', title: 'Customs Clearance Delays (All Causes)' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
            activeCategory === 'clearance'
              ? 'ring-2 ring-amber-500 bg-amber-950/40 shadow-glow-amber'
              : 'hover:border-amber-500/40'
          }`}
          title="Click to view all Customs Clearance Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Customs Clearance Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.clearanceDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-amber-400 font-bold mt-1 flex items-center justify-between">
              <strong>{clearanceDelays.length} Paperwork &amp; Customs Causes</strong>
              <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Destination Delays */}
        <div
          onClick={() => {
            setActiveCategory('destination');
            setModalTarget({ category: 'destination', title: 'Destination Delays (All Exceptions)' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${
            activeCategory === 'destination'
              ? 'ring-2 ring-rose-500 bg-rose-950/40 shadow-glow-rose'
              : 'hover:border-rose-500/40'
          }`}
          title="Click to view all Destination Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Destination Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.destinationDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-rose-400 font-bold mt-1 flex items-center justify-between">
              <strong>{destinationDelays.length} Last-Mile Exception Causes</strong>
              <span className="text-[10px] text-rose-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Weekend Impact Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'weekend', title: 'Weekend & Non-Working Day Hold Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-4 rounded-2xl cursor-pointer transition-all hover:border-cyan-500/50 hover:scale-[1.02] active:scale-[0.98] group"
          title="Click to view all Weekend Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Weekend Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.weekendDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-cyan-400 font-bold mt-1 flex items-center justify-between">
              <strong>Non-working day holds</strong>
              <span className="text-[10px] text-cyan-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. CATEGORY BREAKDOWN & CHART INTERFACE */}
      <div className="glass-panel p-5 rounded-2xl space-y-5 border border-slate-800/80">
        
        {/* Header with Category Tabs and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 light:border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveCategory('transit'); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'transit'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span><strong>Transit Delay Breakdown ({transitDelays.length})</strong></span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveCategory('clearance'); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'clearance'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span><strong>Clearance Delay Breakdown ({clearanceDelays.length})</strong></span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveCategory('destination'); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'destination'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span><strong>Destination Delay Breakdown ({destinationDelays.length})</strong></span>
            </button>
          </div>

          {/* Search inside reasons */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeCategory} reasons...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
        </div>

        {/* Breakdown Grid: Chart on Left, Ranked Reason Table on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart View */}
          <div className="lg:col-span-5 glass-card p-4 rounded-xl flex flex-col justify-between border border-slate-800/80">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                  <strong>Top Root-Cause Distribution</strong>
                </h3>
                <span className="text-[10px] text-sky-400 font-bold">
                  Click bar to view AWBs
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3 font-medium">
                Ranking top delay reasons by total impacted shipments
              </p>
              <div className="h-64 relative cursor-pointer">
                {topReasons.length > 0 ? (
                  <Bar data={barChartData} options={barChartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                    No delay data available.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 font-semibold">
              <span><strong>Showing top {topReasons.length} reasons</strong></span>
              <span className="font-mono font-bold text-slate-200">
                <strong>{topReasons.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} AWBs</strong>
              </span>
            </div>
          </div>

          {/* Ranked Table View */}
          <div className="lg:col-span-7 glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-slate-800/80">
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0b0f19] border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center"><strong>#</strong></th>
                    <th className="py-2.5 px-3"><strong>Delay Reason Description (Click to view AWBs)</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>AWB Count</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>Share (%)</strong></th>
                    <th className="py-2.5 px-3 text-center"><strong>Action</strong></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentList.map((item, idx) => {
                    const isFiltered = activeFiltersForCategory.includes(item.name);
                    return (
                      <tr
                        key={item.name}
                        onClick={() => {
                          setModalTarget({
                            category: activeCategory,
                            reason: item.name,
                            title: item.name
                          });
                          setModalSearch('');
                          setModalCurrentPage(1);
                        }}
                        className={`hover:bg-slate-800/60 transition-all cursor-pointer group ${
                          isFiltered ? 'bg-blue-600/15' : ''
                        }`}
                        title={`Click to pop up full AWB list for: ${item.name}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          <strong>{idx + 1}</strong>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-blue-300 transition-colors">
                              <strong>{item.name}</strong>
                            </span>
                            <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                            {isFiltered && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                                <strong>Filter Active</strong>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                          <strong>{item.count.toLocaleString()}</strong>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                            <strong>{item.percentage}%</strong>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setModalTarget({
                                category: activeCategory,
                                reason: item.name,
                                title: item.name
                              });
                              setModalSearch('');
                              setModalCurrentPage(1);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/40 shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer"
                            title="Open AWB List Modal"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span><strong>View AWBs</strong></span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between font-medium">
              <span>Click on any <strong>Delay Reason</strong> or <strong>View</strong> to open the full AWB list popup window.</span>
              <span className="font-bold text-slate-300">
                Total for category: <strong>{currentList.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} AWBs</strong>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 3. FULL-FEATURED POPUP MODAL FOR DELAY AWB LIST EXPLORER */}
      {modalTarget && (() => {
        const catStyle = getCategoryColor(modalTarget.category);
        const categoryLabel =
          modalTarget.category === 'transit'
            ? 'Transit Delay'
            : modalTarget.category === 'clearance'
            ? 'Customs Clearance Delay'
            : modalTarget.category === 'destination'
            ? 'Destination Delay'
            : 'Weekend Delay';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className={`glass-panel w-full max-w-[96vw] 2xl:max-w-[1600px] max-h-[92vh] p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden bg-slate-950/95 border ${catStyle.border} ${catStyle.glow}`}>
              
              {/* Modal Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                      {modalTarget.category === 'transit' ? (
                        <Plane className="w-5 h-5" />
                      ) : modalTarget.category === 'clearance' ? (
                        <FileText className="w-5 h-5" />
                      ) : modalTarget.category === 'destination' ? (
                        <Truck className="w-5 h-5" />
                      ) : (
                        <Calendar className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${catStyle.badge}`}>
                          {categoryLabel}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          <span className={catStyle.text}>
                            {modalTarget.title}
                          </span>
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          {modalAllShipments.length.toLocaleString()} Total Impacted AWBs
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Showing all individual shipment records impacted by this delay cause.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalTarget(null)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Metrics Strip */}
                {modalStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Transit Time</span>
                      <span className="text-sm sm:text-base font-extrabold text-indigo-400 font-mono">
                        {modalStats.avgTT} <span className="text-xs font-normal text-slate-400">days</span>
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Min: {modalStats.minTT}d • Max: {modalStats.maxTT}d
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Volume &amp; Wt</span>
                      <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                        {modalAllShipments.length.toLocaleString()} <span className="text-xs font-normal text-slate-400">AWBs</span>
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {modalStats.totalWeight} kg • {modalStats.totalPkgs} pcs
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 sm:col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Top Impacted Destinations</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate block mt-0.5">
                        {modalStats.topCountries}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Countries with highest concentration of this delay
                      </span>
                    </div>
                  </div>
                )}

                {/* Search & Export Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={modalSearch}
                      onChange={(e) => {
                        setModalSearch(e.target.value);
                        setModalCurrentPage(1);
                      }}
                      placeholder="Search within this delay list (AWB, Shipper, Customer, Country, City, Remarks...)"
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    {modalSearch && (
                      <button
                        onClick={() => setModalSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportModalExcel}
                      disabled={modalFilteredShipments.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span><strong>Export Excel</strong></span>
                    </button>
                    <button
                      onClick={handleExportModalCSV}
                      disabled={modalFilteredShipments.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span><strong>Export CSV</strong></span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Table Content */}
              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-900/60 my-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">AWB Number</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Shipper</th>
                      <th className="py-2.5 px-3">Destination</th>
                      <th className="py-2.5 px-3 text-right">TT (Days)</th>
                      <th className="py-2.5 px-3 text-center">Final Resolution</th>
                      <th className="py-2.5 px-3">Delay Remarks / Details</th>
                      <th className="py-2.5 px-3 text-center">Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {modalPaginatedData.length > 0 ? (
                      modalPaginatedData.map((s, idx) => {
                        const globalIndex = (modalValidCurrentPage - 1) * modalPageSize + idx + 1;
                        const isDelivered = s.finalResolution?.toLowerCase() === 'delivered';
                        const isNegativeRes = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(s.finalResolution?.toLowerCase().trim());
                        
                        const delayText =
                          modalTarget.category === 'transit'
                            ? s.transitDelay
                            : modalTarget.category === 'clearance'
                            ? s.clearanceDelay
                            : modalTarget.category === 'destination'
                            ? s.destinationDelay
                            : s.weekendDelay === 'Yes' ? 'Weekend Non-working day hold' : s.weekendDelay || 'Weekend Delay';

                        return (
                          <tr
                            key={s.awb}
                            onClick={() => setInspectedShipment(s)}
                            className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                            title="Click to view full dossier"
                          >
                            <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                              {globalIndex}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-white group-hover:text-blue-400">
                              {s.awb}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-200 max-w-[160px] truncate" title={s.customer}>
                              {s.customer}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-[140px] truncate" title={s.shprName}>
                              {s.shprName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white">{s.destination}</span>
                              {s.city && <span className="text-slate-400 text-[11px] block">{s.city}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-400">
                              {s.tt}d
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isNegativeRes
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black'
                                  : isDelivered
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {s.finalResolution || 'Delivered'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-[200px] truncate" title={s.remarks || delayText}>
                              <span className="text-slate-200 font-bold block truncate">{delayText}</span>
                              {s.remarks && s.remarks !== delayText && (
                                <span className="text-slate-400 text-[10px] block truncate">{s.remarks}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setInspectedShipment(s)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-sky-400 hover:text-white transition-all shadow-sm hover:shadow-blue-500/30 cursor-pointer"
                                title="View full AWB dossier"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No shipments matching current query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Rows:</span>
                  <select
                    value={modalPageSize}
                    onChange={(e) => {
                      setModalPageSize(Number(e.target.value));
                      setModalCurrentPage(1);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>
                    Showing{' '}
                    <strong className="text-white">
                      {modalFilteredShipments.length > 0 ? (modalValidCurrentPage - 1) * modalPageSize + 1 : 0}
                    </strong>{' '}
                    -{' '}
                    <strong className="text-white">
                      {Math.min(modalValidCurrentPage * modalPageSize, modalFilteredShipments.length)}
                    </strong>{' '}
                    of <strong className="text-white">{modalFilteredShipments.length}</strong> records
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={modalValidCurrentPage <= 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs">
                    Page {modalValidCurrentPage} of {modalTotalPages}
                  </span>
                  <button
                    onClick={() => setModalCurrentPage((p) => Math.min(p + 1, modalTotalPages))}
                    disabled={modalValidCurrentPage >= modalTotalPages}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setModalTarget(null)}
                    className="ml-3 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 4. SINGLE SHIPMENT DOSSIER SUB-MODAL */}
      {inspectedShipment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl relative bg-slate-950 border border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">AWB #{inspectedShipment.awb}</h3>
                  <p className="text-xs text-slate-400">MAWB: {inspectedShipment.mawb || 'N/A'}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedShipment(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Customer</span>
                <span className="font-bold text-white block mt-0.5">{inspectedShipment.customer}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Shipper</span>
                <span className="font-bold text-white block mt-0.5">{inspectedShipment.shprName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Destination / Recipient</span>
                <span className="font-bold text-white block mt-0.5">
                  {inspectedShipment.destination} ({inspectedShipment.city || 'N/A'})
                </span>
                <span className="text-slate-400 text-[11px] block">{inspectedShipment.recipient}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Transit Time (TT)</span>
                <span className="font-bold text-indigo-400 text-base font-mono block mt-0.5">
                  {inspectedShipment.tt} days
                </span>
                <span className="text-slate-400 text-[11px]">{inspectedShipment.ttRange}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Transit Delay</span>
                <span className="font-bold text-indigo-300 block mt-0.5">
                  {inspectedShipment.transitDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Clearance Delay</span>
                <span className="font-bold text-amber-300 block mt-0.5">
                  {inspectedShipment.clearanceDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Destination Delay</span>
                <span className="font-bold text-rose-300 block mt-0.5">
                  {inspectedShipment.destinationDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Final Resolution</span>
                <span className={`font-bold block mt-0.5 ${
                  inspectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(inspectedShipment.finalResolution)
                    ? 'text-rose-400 font-extrabold'
                    : 'text-amber-400'
                }`}>
                  {inspectedShipment.finalResolution || 'Delivered'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 col-span-2">
                <span className="text-slate-500 block text-[10px]">Pkg &amp; Weight</span>
                <span className="font-bold text-white block mt-0.5">
                  {inspectedShipment.weight} kg • {inspectedShipment.pkgCount} pcs
                </span>
              </div>
            </div>

            {inspectedShipment.remarks && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <span className="text-slate-500 block text-[10px]">Remarks</span>
                <p className="text-slate-300 mt-0.5">{inspectedShipment.remarks}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedShipment(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
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
