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
  ChevronDown,
  Download,
  AlertTriangle,
  Clock,
  Eye,
  ExternalLink,
  ShieldAlert,
  Building,
  MapPin,
  CheckCircle2,
  Globe,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { RatioBreakdown, MetricSummary, Shipment } from '../types/logistics';
import { formatExcelDate, formatWeight } from '../utils/formatters';
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
  const [hubSelectedCountry, setHubSelectedCountry] = useState<string | null>(null);

  // Modal State for Delay AWB List Popup Window
  const [modalTarget, setModalTarget] = useState<DelayModalTarget | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(25);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [inspectedShipment, setInspectedShipment] = useState<Shipment | null>(null);
  const [modalSelectedCountry, setModalSelectedCountry] = useState<string | null>(null);
  const [showCountryBreakdownModal, setShowCountryBreakdownModal] = useState<boolean>(false);
  const [countryModalSearch, setCountryModalSearch] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const openModal = (target: DelayModalTarget) => {
    setModalTarget(target);
    setModalSelectedCountry(hubSelectedCountry || null);
    setSortField(null);
    setSortOrder('asc');
    setModalSearch('');
    setModalCurrentPage(1);
  };

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

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCountryBreakdownModal) {
          setShowCountryBreakdownModal(false);
        } else if (inspectedShipment) {
          setInspectedShipment(null);
        } else if (modalTarget) {
          setModalTarget(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalTarget, inspectedShipment, showCountryBreakdownModal]);

  // Unique destinations across filtered shipments for main tab dropdown
  const hubCountryList = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filteredShipments) {
      if (s.destination) {
        const d = s.destination.trim().toUpperCase();
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({
        country,
        count
      }));
  }, [filteredShipments]);

  const currentList = useMemo(() => {
    let list: RatioBreakdown[] = [];
    if (hubSelectedCountry) {
      const countryShipments = filteredShipments.filter(
        (s) => (s.destination || '').trim().toUpperCase() === hubSelectedCountry.trim().toUpperCase()
      );
      const countMap: Record<string, number> = {};
      let totalCategoryCount = 0;

      for (const s of countryShipments) {
        let reason = '';
        if (activeCategory === 'transit' && s.transitDelay && s.transitDelay !== '-') {
          reason = s.transitDelay.trim();
        } else if (activeCategory === 'clearance' && s.clearanceDelay && s.clearanceDelay !== '-') {
          reason = s.clearanceDelay.trim();
        } else if (activeCategory === 'destination' && s.destinationDelay && s.destinationDelay !== '-') {
          reason = s.destinationDelay.trim();
        }
        if (reason) {
          countMap[reason] = (countMap[reason] || 0) + 1;
          totalCategoryCount++;
        }
      }

      list = Object.entries(countMap)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalCategoryCount > 0 ? Number(((count / totalCategoryCount) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.count - a.count);
    } else {
      if (activeCategory === 'transit') list = transitDelays;
      else if (activeCategory === 'clearance') list = clearanceDelays;
      else list = destinationDelays;
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeCategory, hubSelectedCountry, filteredShipments, transitDelays, clearanceDelays, destinationDelays, searchTerm]);

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
          openModal({
            category: activeCategory,
            reason: selectedReason.name,
            title: selectedReason.name
          });
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
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#64748b', font: { size: 10, weight: 'bold' as const } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#475569', font: { size: 11, weight: 'bold' as const } }
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

  // Country breakdown for active delay modal
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

  // Search, country filter, and column sorting inside modal
  const modalFilteredShipments = useMemo(() => {
    let list = modalAllShipments;

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
          (s.destinationDelay && s.destinationDelay.toLowerCase().includes(q)) ||
          (s.weekendDelay && s.weekendDelay.toLowerCase().includes(q)) ||
          (s.finalResolution && s.finalResolution.toLowerCase().includes(q))
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
        } else if (sortField === 'finalResolution') {
          cmp = (a.finalResolution || '').localeCompare(b.finalResolution || '');
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return list;
  }, [modalAllShipments, modalSelectedCountry, modalSearch, sortField, sortOrder]);

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
      topCountries: topCountries || 'None'
    };
  }, [modalAllShipments, modalCountryBreakdown]);

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
          text: 'text-indigo-700 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-500/20',
          border: 'border-indigo-200 dark:border-indigo-500/40',
          glow: 'shadow-[0_0_25px_rgba(99,102,241,0.15)] dark:shadow-[0_0_30px_rgba(99,102,241,0.25)]',
          badge: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700'
        };
      case 'clearance':
        return {
          text: 'text-amber-700 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-500/20',
          border: 'border-amber-200 dark:border-amber-500/40',
          glow: 'shadow-[0_0_25px_rgba(245,158,11,0.15)] dark:shadow-[0_0_30px_rgba(245,158,11,0.25)]',
          badge: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700'
        };
      case 'destination':
        return {
          text: 'text-rose-700 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-500/20',
          border: 'border-rose-200 dark:border-rose-500/40',
          glow: 'shadow-[0_0_25px_rgba(239,68,68,0.15)] dark:shadow-[0_0_30px_rgba(239,68,68,0.25)]',
          badge: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700'
        };
      case 'weekend':
        return {
          text: 'text-cyan-700 dark:text-cyan-400',
          bg: 'bg-cyan-50 dark:bg-cyan-500/20',
          border: 'border-cyan-200 dark:border-cyan-500/40',
          glow: 'shadow-[0_0_25px_rgba(6,182,212,0.15)] dark:shadow-[0_0_30px_rgba(6,182,212,0.25)]',
          badge: 'bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700'
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
            openModal({ category: 'transit', title: 'Transit Delays (All Incidents)' });
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-2 ${
            activeCategory === 'transit'
              ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm dark:shadow-glow-indigo'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/40'
          }`}
          title="Click to view all Transit Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <strong>Transit Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/20">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              <strong>{summary.transitDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-indigo-700 dark:text-indigo-400 font-bold mt-1 flex items-center justify-between">
              <strong>{transitDelays.length} Distinct Causes</strong>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div
          onClick={() => {
            setActiveCategory('clearance');
            openModal({ category: 'clearance', title: 'Customs Clearance Delays (All Causes)' });
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-2 ${
            activeCategory === 'clearance'
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 shadow-sm dark:shadow-glow-amber'
              : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/40'
          }`}
          title="Click to view all Customs Clearance Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <strong>Customs Clearance Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              <strong>{summary.clearanceDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-400 font-bold mt-1 flex items-center justify-between">
              <strong>{clearanceDelays.length} Paperwork &amp; Customs Causes</strong>
              <span className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Destination Delays */}
        <div
          onClick={() => {
            setActiveCategory('destination');
            openModal({ category: 'destination', title: 'Destination Delays (All Exceptions)' });
          }}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-2 ${
            activeCategory === 'destination'
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm dark:shadow-glow-rose'
              : 'border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/40'
          }`}
          title="Click to view all Destination Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <strong>Destination Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              <strong>{summary.destinationDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-rose-700 dark:text-rose-400 font-bold mt-1 flex items-center justify-between">
              <strong>{destinationDelays.length} Last-Mile Exception Causes</strong>
              <span className="text-[10px] text-rose-600 dark:text-rose-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

        {/* Weekend Impact Delays */}
        <div
          onClick={() => {
            openModal({ category: 'weekend', title: 'Weekend & Non-Working Day Hold Delays' });
          }}
          className="glass-card p-4 rounded-2xl cursor-pointer transition-all border-2 border-slate-300 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:scale-[1.02] active:scale-[0.98] group"
          title="Click to view all Weekend Delay AWBs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <strong>Weekend Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/20 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              <strong>{summary.weekendDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-cyan-700 dark:text-cyan-400 font-bold mt-1 flex items-center justify-between">
              <strong>Non-working day holds</strong>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-300 font-semibold flex items-center gap-0.5">
                View AWBs →
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. CATEGORY BREAKDOWN & CHART INTERFACE */}
      <div className="glass-panel p-5 rounded-2xl space-y-5 border-2 border-slate-300 dark:border-slate-700">
        
        {/* Header with Category Tabs and Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveCategory('transit'); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'transit'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60'
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
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60'
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
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span><strong>Destination Delay Breakdown ({destinationDelays.length})</strong></span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Country Dropdown for Main DelayHub Tabs */}
            <div className="relative min-w-[200px]">
              <Globe className="w-3.5 h-3.5 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={hubSelectedCountry || ''}
                onChange={(e) => setHubSelectedCountry(e.target.value || null)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 focus:border-emerald-500 rounded-xl pl-8 pr-8 py-1.5 text-xs font-bold text-slate-800 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-xs"
                title="Filter delay reasons by destination country"
              >
                <option value="" className="bg-slate-900 text-slate-300 font-medium">
                  All Destinations ({hubCountryList.length} countries)
                </option>
                {hubCountryList.map((c, idx) => (
                  <option key={c.country} value={c.country} className="bg-slate-900 text-white font-mono">
                    {`${idx + 1}.\u00A0\u00A0${c.country} - ${c.count.toLocaleString()} AWB`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {hubSelectedCountry && (
              <button
                type="button"
                onClick={() => setHubSelectedCountry(null)}
                className="text-xs font-bold text-rose-500 hover:text-rose-400 underline cursor-pointer"
              >
                Reset
              </button>
            )}

            {/* Search inside reasons */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${activeCategory} reasons...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>
          </div>
        </div>

        {/* Breakdown Grid: Chart on Left, Ranked Reason Table on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart View */}
          <div className="lg:col-span-5 glass-card p-4 rounded-xl flex flex-col justify-between border-2 border-slate-300 dark:border-slate-700">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-300 tracking-wider">
                  <strong>Top Root-Cause Distribution</strong>
                </h3>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                  Click bar to view AWBs
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">
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
            <div className="mt-3 pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 font-semibold">
              <span><strong>Showing top {topReasons.length} reasons</strong></span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <strong>{topReasons.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} AWBs</strong>
              </span>
            </div>
          </div>

          {/* Ranked Table View */}
          <div className="lg:col-span-7 glass-card rounded-xl overflow-hidden flex flex-col justify-between border-2 border-slate-300 dark:border-slate-700">
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-[#0b0f19] border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center"><strong>#</strong></th>
                    <th className="py-2.5 px-3"><strong>Delay Reason Description (Click to view AWBs)</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>AWB Count</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>Share (%)</strong></th>
                    <th className="py-2.5 px-3 text-center"><strong>Action</strong></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {currentList.map((item, idx) => {
                    const isFiltered = activeFiltersForCategory.includes(item.name);
                    return (
                      <tr
                        key={item.name}
                        onClick={() => {
                          openModal({
                            category: activeCategory,
                            reason: item.name,
                            title: item.name
                          });
                        }}
                        className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all cursor-pointer group ${
                          isFiltered ? 'bg-blue-50 dark:bg-blue-600/15' : 'even:bg-slate-50/40 dark:even:bg-slate-900/30'
                        }`}
                        title={`Click to pop up full AWB list for: ${item.name}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px] font-bold">
                          <strong>{idx + 1}</strong>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                              <strong>{item.name}</strong>
                            </span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 dark:text-blue-400" />
                            {isFiltered && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-500/30">
                                <strong>Filter Active</strong>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white font-mono">
                          <strong>{item.count.toLocaleString()}</strong>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-mono text-[11px] font-bold">
                            <strong>{item.percentage}%</strong>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              openModal({
                                category: activeCategory,
                                reason: item.name,
                                title: item.name
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 dark:bg-blue-600/20 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white dark:border-blue-500/40 shadow-sm hover:shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer"
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

            <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between font-medium">
              <span>Click on any <strong>Delay Reason</strong> or <strong>View</strong> to open the full AWB list popup window.</span>
              <span className="font-bold text-slate-800 dark:text-slate-300">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in">
            <div className={`w-full max-w-[96vw] 2xl:max-w-[1600px] max-h-[92vh] p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden bg-white dark:bg-slate-950/95 border ${catStyle.border} ${catStyle.glow}`}>
              
              {/* Modal Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border-2 ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
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
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${catStyle.badge}`}>
                          {categoryLabel}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          <span className={catStyle.text}>
                            {modalTarget.title}
                          </span>
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border shadow-2xs ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                          {modalAllShipments.length.toLocaleString()} Total Impacted AWBs
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                        Showing all individual shipment records impacted by this delay cause.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalTarget(null)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-slate-700 transition-colors cursor-pointer shadow-2xs"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Metrics Strip */}
                {modalStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700 shadow-sm">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">Average Transit Time</span>
                      <span className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {modalStats.avgTT} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">days</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono font-medium mt-0.5">
                        Min: {modalStats.minTT}d • Max: {modalStats.maxTT}d
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700 shadow-sm">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">Total Volume &amp; Wt</span>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                        {modalAllShipments.length.toLocaleString()} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">AWBs</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono font-medium mt-0.5">
                        {modalStats.totalWeight} kg • {modalStats.totalPkgs} pcs
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700 shadow-sm sm:col-span-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
                              className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
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
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer flex items-center gap-0.5"
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
                          className="w-full bg-slate-50 border border-slate-300 text-slate-800 hover:border-emerald-500 focus:border-emerald-500 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer appearance-none shadow-2xs dark:bg-slate-950 dark:border-slate-700 dark:text-emerald-400 dark:hover:border-emerald-500/60"
                        >
                          <option value="" className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 font-medium">
                            All Destinations ({modalAllShipments.length.toLocaleString()} AWBs • {modalCountryBreakdown.length} countries)
                          </option>
                          {modalCountryBreakdown.map((item, idx) => (
                            <option
                              key={item.country}
                              value={item.country}
                              className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white font-mono"
                            >
                              {`${idx + 1}.\u00A0\u00A0${item.country} - ${item.count.toLocaleString()} AWB`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Top list footer */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                        <span className="truncate font-mono font-medium">
                          {modalSelectedCountry
                            ? `Selected: ${modalSelectedCountry} (${modalCountryBreakdown.find(c => c.country === modalSelectedCountry)?.count || 0} AWBs)`
                            : `Top: ${modalStats.topCountries}`}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0 ml-2">Sorted by volume</span>
                      </div>
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
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs"
                    />
                    {modalSearch && (
                      <button
                        onClick={() => setModalSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
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
                      disabled={modalFilteredShipments.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 dark:bg-emerald-600/20 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white dark:border-emerald-500/30 text-xs font-black transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      onClick={handleExportModalCSV}
                      disabled={modalFilteredShipments.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white border border-blue-300 dark:bg-blue-600/20 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white dark:border-blue-500/30 text-xs font-black transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Table Content */}
              <div className="flex-1 overflow-x-auto overflow-y-auto border-2 border-slate-300 dark:border-slate-700 rounded-2xl bg-white shadow-sm my-2 max-h-[58vh] dark:bg-slate-950">
                <table className="w-full text-center text-xs border-collapse min-w-[950px]">
                  <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider z-10 select-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="py-2.5 px-2.5 w-12 text-center text-slate-500 dark:text-slate-400 align-middle">#</th>
                      <th
                        onClick={() => handleSort('awb')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by AWB Tracking #"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'awb' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>AWB Tracking #</span>
                          {renderSortIcon('awb')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('destination')}
                        className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Destination"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'destination' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Dest</span>
                          {renderSortIcon('destination')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('customer')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Customer Account"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'customer' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Customer Account</span>
                          {renderSortIcon('customer')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('shprName')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Shipper Name"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'shprName' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Shipper Name</span>
                          {renderSortIcon('shprName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('recipient')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Recipient / City"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'recipient' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Recipient / City</span>
                          {renderSortIcon('recipient')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('pickup')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Pickup Date"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'pickup' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Pickup Date</span>
                          {renderSortIcon('pickup')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('weight')}
                        className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Weight"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'weight' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Weight (kg)</span>
                          {renderSortIcon('weight')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('tt')}
                        className="py-2.5 px-2.5 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Transit Time"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'tt' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>TT (Days)</span>
                          {renderSortIcon('tt')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('finalResolution')}
                        className="py-2.5 px-3 text-center align-middle cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors group"
                        title="Click to sort by Final Resolution"
                      >
                        <div className="inline-flex items-center justify-center gap-1 mx-auto">
                          <span className={sortField === 'finalResolution' ? 'text-blue-600 dark:text-sky-300 font-black' : ''}>Final Resolution</span>
                          {renderSortIcon('finalResolution')}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center align-middle">Delay Reason &amp; Remarks</th>
                      <th className="py-2.5 px-2.5 text-center align-middle">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-sans dark:divide-slate-800/80 dark:bg-slate-950">
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
                            key={`${s.awb}-${idx}`}
                            onClick={() => setInspectedShipment(s)}
                            className="hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer group dark:hover:bg-slate-900/90 dark:text-slate-200"
                            title="Click to view full dossier"
                          >
                            <td className="py-2 px-2.5 text-center text-slate-500 font-mono font-bold text-[11px] align-middle">
                              {globalIndex}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-600 hover:text-blue-700 dark:text-sky-400 dark:hover:text-sky-300 hover:underline text-center align-middle">
                              {s.awb}
                            </td>
                            <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-white font-mono text-center align-middle">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                                {s.destination}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white max-w-[150px] truncate text-center align-middle mx-auto" title={s.customer}>
                              {s.customer || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[150px] truncate font-medium text-center align-middle mx-auto" title={s.shprName}>
                              {s.shprName || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[140px] truncate text-center align-middle">
                              <div className="font-semibold text-slate-900 dark:text-white truncate text-center">{s.recipient || '-'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate text-center">{s.city || '-'}</div>
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap text-center align-middle">
                              {formatExcelDate(s.pickup)}
                            </td>
                            <td className="py-2 px-2.5 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap text-center align-middle">
                              {s.weight ? `${formatWeight(s.weight)}` : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-center align-middle font-mono font-black text-indigo-600 dark:text-indigo-400">
                              {Number(s.tt || 0).toFixed(1)} d
                            </td>
                            <td className="py-2 px-3 text-center align-middle">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border shadow-xs ${
                                isNegativeRes
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/50'
                                  : isDelivered
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/50'
                                  : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/50'
                              }`}>
                                {s.finalResolution || 'Delivered'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate text-center align-middle" title={s.remarks || delayText}>
                              <span className="text-slate-900 dark:text-slate-100 font-bold block truncate">{delayText}</span>
                              {s.remarks && s.remarks !== delayText && (
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium block truncate">{s.remarks}</span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setInspectedShipment(s)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white border border-slate-300 dark:bg-slate-900 dark:hover:bg-blue-600 dark:text-sky-400 dark:hover:text-white dark:border-slate-700 transition-all shadow-xs cursor-pointer inline-flex items-center justify-center"
                                title="View full AWB dossier"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 font-semibold">
                          No shipments matching current query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Rows:</span>
                  <select
                    value={modalPageSize}
                    onChange={(e) => {
                      setModalPageSize(Number(e.target.value));
                      setModalCurrentPage(1);
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs text-slate-900 dark:text-white font-medium shadow-2xs"
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
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-white cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    Page {modalValidCurrentPage} of {modalTotalPages}
                  </span>
                  <button
                    onClick={() => setModalCurrentPage((p) => Math.min(p + 1, modalTotalPages))}
                    disabled={modalValidCurrentPage >= modalTotalPages}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-700 dark:text-white cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setModalTarget(null)}
                    className="ml-3 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white text-xs cursor-pointer border border-slate-300 dark:border-slate-700 shadow-2xs"
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
                          <h3 className="text-base sm:text-lg font-black text-white">
                            Country-Wise Impacted Shipments
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {modalTarget.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Total <strong className="text-white font-mono">{modalAllShipments.length.toLocaleString()}</strong> AWBs across <strong className="text-white font-mono">{modalCountryBreakdown.length}</strong> countries
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCountryBreakdownModal(false)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2 my-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Countries</span>
                      <span className="text-lg font-black text-white font-mono">{modalCountryBreakdown.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Impacted Shipments</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{modalAllShipments.length.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Top Concentration</span>
                      <span className="text-lg font-black text-sky-400 font-mono">
                        {modalCountryBreakdown[0] ? `${modalCountryBreakdown[0].country} (${modalCountryBreakdown[0].count.toLocaleString()})` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Search inside Country List */}
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={countryModalSearch}
                      onChange={(e) => setCountryModalSearch(e.target.value)}
                      placeholder="Search country code (e.g. US, IN, BR, CA)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
                    />
                  </div>

                  {/* Countries Ranked Table */}
                  <div className="flex-1 overflow-y-auto border border-slate-800/80 rounded-2xl bg-slate-900/50 divide-y divide-slate-800/60">
                    <div className="sticky top-0 bg-slate-900 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider grid grid-cols-12 gap-2 border-b border-slate-800">
                      <span className="col-span-2 text-center">Rank</span>
                      <span className="col-span-2 text-center">Country</span>
                      <span className="col-span-3 text-center">Impacted Shipments</span>
                      <span className="col-span-3 text-center">Share (%)</span>
                      <span className="col-span-2 text-center">Action</span>
                    </div>

                    {filteredCountryBreakdown.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No countries found matching "{countryModalSearch}"
                      </div>
                    ) : (
                      filteredCountryBreakdown.map((item, idx) => (
                        <div
                          key={item.country}
                          className="px-4 py-2.5 text-xs grid grid-cols-12 gap-2 items-center hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="col-span-2 text-center font-mono font-bold text-slate-400 text-[11px]">
                            #{idx + 1}
                          </span>
                          <span className="col-span-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-white text-xs">
                              {item.country}
                            </span>
                          </span>
                          <span className="col-span-3 text-center font-mono font-bold text-emerald-400">
                            {item.count.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">AWBs</span>
                          </span>
                          <div className="col-span-3 flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(item.percentage, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-300 w-9 text-right">
                              {item.percentage}%
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setModalSelectedCountry(item.country);
                                setModalCurrentPage(1);
                                setShowCountryBreakdownModal(false);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white text-[10px] font-bold border border-emerald-500/30 transition-all cursor-pointer"
                            >
                              Filter Table
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Click <strong>Filter Table</strong> to isolate records for that destination</span>
                    <button
                      type="button"
                      onClick={() => setShowCountryBreakdownModal(false)}
                      className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            </div>
          </div>
        );
      })()}

      {/* 4. SINGLE SHIPMENT DOSSIER SUB-MODAL */}
      {inspectedShipment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85 backdrop-blur-md animate-fade-in">
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
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Customer</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.customer}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Shipper</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.shprName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Destination / Recipient</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.destination} ({inspectedShipment.city || 'N/A'})
                </span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px] block font-medium">{inspectedShipment.recipient}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Transit Time (TT)</span>
                <span className="font-black text-indigo-700 dark:text-indigo-400 text-base font-mono block mt-0.5">
                  {Number(inspectedShipment.tt || 0).toFixed(1)} days
                </span>
                <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">{inspectedShipment.ttRange}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Transit Delay</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 block mt-0.5">
                  {inspectedShipment.transitDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Clearance Delay</span>
                <span className="font-bold text-amber-700 dark:text-amber-300 block mt-0.5">
                  {inspectedShipment.clearanceDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Destination Delay</span>
                <span className="font-bold text-rose-700 dark:text-rose-300 block mt-0.5">
                  {inspectedShipment.destinationDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Final Resolution</span>
                <span className={`font-black block mt-0.5 ${
                  inspectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(inspectedShipment.finalResolution)
                    ? 'text-rose-700 dark:text-rose-400 font-extrabold'
                    : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {inspectedShipment.finalResolution || 'Delivered'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Pkg &amp; Weight</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.weight} kg • {inspectedShipment.pkgCount} pcs
                </span>
              </div>
            </div>

            {inspectedShipment.remarks && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Remarks</span>
                <p className="text-slate-800 dark:text-slate-300 mt-0.5 font-medium">{inspectedShipment.remarks}</p>
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

    </div>
  );
};
