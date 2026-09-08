import React, { useState, useMemo, useEffect } from 'react';
import {
  Globe,
  Search,
  ArrowUpDown,
  Download,
  ShieldAlert,
  Plane,
  MapPin,
  Calendar,
  AlertTriangle,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  FileSpreadsheet,
  Layers,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CountryPerformance, Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

interface CountryMatrixProps {
  countryData: CountryPerformance[];
  totalAWBs: number;
  shipments?: Shipment[];
  rawShipments?: Shipment[];
}

export interface CountryModalTarget {
  countryCode?: string; // If undefined, applies to all destinations
  category: 'all' | 'clearance' | 'transit' | 'destination' | 'weekend' | 'totalDelays';
  title: string;
}

type SortField =
  | 'countryCode'
  | 'awbCount'
  | 'avgTT'
  | 'minTT'
  | 'maxTT'
  | 'onTimePercentage'
  | 'clearanceDelays'
  | 'transitDelays'
  | 'destinationDelays'
  | 'weekendDelays'
  | 'totalDelays';

type SortOrder = 'asc' | 'desc';

export const CountryMatrix: React.FC<CountryMatrixProps> = ({
  countryData,
  totalAWBs,
  shipments = [],
  rawShipments = []
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('awbCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modal State for Country & Delay AWB List Popup Window
  const [modalTarget, setModalTarget] = useState<CountryModalTarget | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(25);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [inspectedShipment, setInspectedShipment] = useState<Shipment | null>(null);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

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

  const effectiveShipments = useMemo(() => {
    return shipments && shipments.length > 0 ? shipments : (rawShipments || []);
  }, [shipments, rawShipments]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let list = [...countryData];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.countryCode.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const valA: any = a[sortField] ?? 0;
      const valB: any = b[sortField] ?? 0;

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [countryData, searchTerm, sortField, sortOrder]);

  // Aggregate totals across all countries
  const summaryTotals = useMemo(() => {
    let totalClearance = 0;
    let totalTransit = 0;
    let totalDestination = 0;
    let totalWeekend = 0;
    let totalAllDelays = 0;

    for (const c of countryData) {
      totalClearance += c.clearanceDelays || 0;
      totalTransit += c.transitDelays || 0;
      totalDestination += c.destinationDelays || 0;
      totalWeekend += c.weekendDelays || 0;
      totalAllDelays += c.totalDelays || 0;
    }

    return {
      totalClearance,
      totalTransit,
      totalDestination,
      totalWeekend,
      totalAllDelays,
      countriesCount: countryData.length
    };
  }, [countryData]);

  const handleExport = () => {
    if (filteredAndSortedData.length === 0) return;

    const exportRows = filteredAndSortedData.map((c) => {
      const share = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(2) : '0';
      const delayRate = c.awbCount > 0 ? ((c.totalDelays / c.awbCount) * 100).toFixed(2) : '0';

      return {
        'Country Code': c.countryCode,
        'Volume (AWB)': c.awbCount,
        'Volume Share (%)': `${share}%`,
        'Avg TT (Days)': c.avgTT,
        'Min TT (Days)': c.minTT,
        'Max TT (Days)': c.maxTT,
        'On-Time (%)': `${c.onTimePercentage}%`,
        'On-Time Count': c.onTimeCount,
        'Clearance Delays': c.clearanceDelays,
        'Transit Delays': c.transitDelays,
        'Destination Delays': c.destinationDelays,
        'Weekend Delays': c.weekendDelays,
        'Total Delays': c.totalDelays,
        'Delay Rate (%)': `${delayRate}%`
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Country_Performance');
    XLSX.writeFile(workbook, `Destination_Performance_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter shipments for the active popup modal
  const modalAllShipments = useMemo(() => {
    if (!modalTarget || effectiveShipments.length === 0) return [];
    const { countryCode, category } = modalTarget;

    return effectiveShipments.filter((s) => {
      // 1. Destination Country check
      if (countryCode) {
        const destCode = (s.destination || 'UNKNOWN').toUpperCase().trim();
        if (destCode !== countryCode.toUpperCase().trim()) return false;
      }

      // 2. Category check
      if (category === 'all') {
        return true;
      }

      if (category === 'clearance') {
        return Boolean(s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '');
      }

      if (category === 'transit') {
        return Boolean(s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '');
      }

      if (category === 'destination') {
        return Boolean(s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '');
      }

      if (category === 'weekend') {
        const wd = (s.weekendDelay || '').toString().toLowerCase().trim();
        return wd === 'yes' || wd === '1' || wd === 'true';
      }

      if (category === 'totalDelays') {
        const hasClearance = Boolean(s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '');
        const hasTransit = Boolean(s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '');
        const hasDest = Boolean(s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '');
        const wd = (s.weekendDelay || '').toString().toLowerCase().trim();
        const hasWeekend = wd === 'yes' || wd === '1' || wd === 'true';
        const isTtDelayed = typeof s.tt === 'number' && s.tt > 5;
        return hasClearance || hasTransit || hasDest || hasWeekend || isTtDelayed;
      }

      return true;
    });
  }, [modalTarget, effectiveShipments]);

  // Search filter inside modal
  const modalFilteredShipments = useMemo(() => {
    if (!modalSearch.trim()) return modalAllShipments;
    const q = modalSearch.toLowerCase().trim();
    return modalAllShipments.filter((s) => {
      return (
        (s.awb && s.awb.toLowerCase().includes(q)) ||
        (s.customer && s.customer.toLowerCase().includes(q)) ||
        (s.shprName && s.shprName.toLowerCase().includes(q)) ||
        (s.destination && s.destination.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.destLocCd && s.destLocCd.toLowerCase().includes(q)) ||
        (s.finalResolution && s.finalResolution.toLowerCase().includes(q)) ||
        (s.transitDelay && s.transitDelay.toLowerCase().includes(q)) ||
        (s.clearanceDelay && s.clearanceDelay.toLowerCase().includes(q)) ||
        (s.destinationDelay && s.destinationDelay.toLowerCase().includes(q)) ||
        (s.remarks && s.remarks.toLowerCase().includes(q))
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
    const total = modalAllShipments.length;
    let sumTT = 0;
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let onTimeCount = 0;
    let totalWeight = 0;
    let totalPkgs = 0;

    for (const s of modalAllShipments) {
      const tt = typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0;
      sumTT += tt;
      if (tt > 0 && tt < minTT) minTT = tt;
      if (tt > maxTT) maxTT = tt;
      if (tt <= 5) onTimeCount++;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
    }

    return {
      total,
      avgTT: (sumTT / total).toFixed(2),
      minTT: minTT === Number.MAX_VALUE ? '0.00' : minTT.toFixed(2),
      maxTT: maxTT.toFixed(2),
      onTimeRate: ((onTimeCount / total) * 100).toFixed(1),
      totalWeight: Math.round(totalWeight).toLocaleString(),
      totalPkgs: totalPkgs.toLocaleString()
    };
  }, [modalAllShipments]);

  // Modal Export Handlers
  const handleExportModalExcel = () => {
    if (modalFilteredShipments.length === 0) return;
    const exportData = modalFilteredShipments.map((s, idx) => ({
      '#': idx + 1,
      'AWB Number': s.awb,
      'Customer': s.customer,
      'Shipper': s.shprName,
      'Dest Location': s.destLocCd || '',
      'Destination': s.destination,
      'City': s.city || '',
      'Pickup Date': s.pickup || '',
      'Transit Time (Days)': s.tt,
      'TT Range': s.ttRange,
      'Final Resolution': s.finalResolution || 'Delivered',
      'Clearance Delay': s.clearanceDelay || '',
      'Transit Delay': s.transitDelay || '',
      'Destination Delay': s.destinationDelay || '',
      'Weekend Delay': s.weekendDelay || '',
      'Remarks': s.remarks || '',
      'Weight (kg)': s.weight,
      'Package Count': s.pkgCount
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AWB_List');
    const cleanTitle = (modalTarget?.title || 'AWB_List').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    XLSX.writeFile(workbook, `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportModalCSV = () => {
    if (modalFilteredShipments.length === 0) return;
    const exportData = modalFilteredShipments.map((s, idx) => ({
      '#': idx + 1,
      'AWB Number': s.awb,
      'Customer': s.customer,
      'Shipper': s.shprName,
      'Dest Location': s.destLocCd || '',
      'Destination': s.destination,
      'City': s.city || '',
      'Pickup Date': s.pickup || '',
      'Transit Time (Days)': s.tt,
      'TT Range': s.ttRange,
      'Final Resolution': s.finalResolution || 'Delivered',
      'Clearance Delay': s.clearanceDelay || '',
      'Transit Delay': s.transitDelay || '',
      'Destination Delay': s.destinationDelay || '',
      'Weekend Delay': s.weekendDelay || '',
      'Remarks': s.remarks || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const cleanTitle = (modalTarget?.title || 'AWB_List').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    link.setAttribute('download', `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyAllAWBs = () => {
    if (modalFilteredShipments.length === 0) return;
    const awbText = modalFilteredShipments.map(s => s.awb).join('\n');
    navigator.clipboard.writeText(awbText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingleAWB = (awb: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header with Title and Search/Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              <strong>Destination Performance Matrix</strong>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 font-bold border border-sky-300 dark:border-sky-500/30">
              {filteredAndSortedData.length} Countries
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Comprehensive country-by-country delivery speeds, on-time rates, volume distribution, and delay breakdowns.
            <span className="text-sky-700 dark:text-sky-400 font-semibold ml-1">Click on any number or row to view the underlying AWB list.</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Country Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter country code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 shadow-inner"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer shadow-sm"
            title="Export country performance table with full delay breakdown to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline"><strong>Export</strong></span>
          </button>
        </div>
      </div>

      {/* Delay Summary KPI Cards (Clickable -> Opens Modal) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'totalDelays', title: 'All Destinations — Total Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-3 rounded-xl border border-slate-200 dark:border-yellow-500/40 bg-white dark:bg-yellow-500/10 flex items-center gap-3 cursor-pointer hover:border-amber-400 dark:hover:border-yellow-400 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"
          title="Click to view all delayed shipments across all destinations"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform dark:bg-yellow-500/20 dark:border dark:border-yellow-500/40 dark:text-yellow-400">
            <AlertTriangle className="w-4 h-4 text-white dark:text-yellow-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-amber-700 dark:group-hover:text-yellow-200 transition-colors">
              <strong>Total Delays</strong>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-700 dark:text-yellow-400 font-mono group-hover:underline">
              <strong>{summaryTotals.totalAllDelays.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'clearance', title: 'All Destinations — Clearance Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-3 rounded-xl border border-slate-200 dark:border-purple-500/40 bg-white dark:bg-purple-500/10 flex items-center gap-3 cursor-pointer hover:border-purple-400 dark:hover:border-purple-400 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"
          title="Click to view all clearance delay shipments"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform dark:bg-purple-500/20 dark:border dark:border-purple-500/40 dark:text-purple-400">
            <ShieldAlert className="w-4 h-4 text-white dark:text-purple-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-purple-700 dark:group-hover:text-purple-200 transition-colors">
              <strong>Clearance Delays</strong>
            </div>
            <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-400 font-mono group-hover:underline">
              <strong>{summaryTotals.totalClearance.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Transit Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'transit', title: 'All Destinations — Transit Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-3 rounded-xl border border-slate-200 dark:border-sky-500/40 bg-white dark:bg-sky-500/10 flex items-center gap-3 cursor-pointer hover:border-sky-400 dark:hover:border-sky-400 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"
          title="Click to view all transit delay shipments"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-500 text-white shadow-sm shadow-sky-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform dark:bg-sky-500/20 dark:border dark:border-sky-500/40 dark:text-sky-400">
            <Plane className="w-4 h-4 text-white dark:text-sky-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-sky-700 dark:group-hover:text-sky-200 transition-colors">
              <strong>Transit Delays</strong>
            </div>
            <div className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-400 font-mono group-hover:underline">
              <strong>{summaryTotals.totalTransit.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Destination Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'destination', title: 'All Destinations — Destination Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-3 rounded-xl border border-slate-200 dark:border-amber-500/40 bg-white dark:bg-amber-500/10 flex items-center gap-3 cursor-pointer hover:border-amber-400 dark:hover:border-amber-400 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"
          title="Click to view all destination delay shipments"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform dark:bg-amber-500/20 dark:border dark:border-amber-500/40 dark:text-amber-400">
            <MapPin className="w-4 h-4 text-white dark:text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors">
              <strong>Dest. Delays</strong>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400 font-mono group-hover:underline">
              <strong>{summaryTotals.totalDestination.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Weekend Delays */}
        <div
          onClick={() => {
            setModalTarget({ category: 'weekend', title: 'All Destinations — Weekend Delays' });
            setModalSearch('');
            setModalCurrentPage(1);
          }}
          className="glass-card p-3 rounded-xl border border-slate-200 dark:border-rose-500/40 bg-white dark:bg-rose-500/10 flex items-center gap-3 col-span-2 sm:col-span-1 cursor-pointer hover:border-rose-400 dark:hover:border-rose-400 hover:scale-[1.02] active:scale-[0.98] transition-all group shadow-sm hover:shadow-md"
          title="Click to view all weekend delay shipments"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-500 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform dark:bg-rose-500/20 dark:border dark:border-rose-500/40 dark:text-rose-400">
            <Calendar className="w-4 h-4 text-white dark:text-rose-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider group-hover:text-rose-700 dark:group-hover:text-rose-200 transition-colors">
              <strong>Weekend Delays</strong>
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-700 dark:text-rose-400 font-mono group-hover:underline">
              <strong>{summaryTotals.totalWeekend.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container with high-contrast, prominent grid borders and centered content */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/40">
        <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-center text-xs min-w-[1000px] border-collapse border-spacing-0">
            <thead className="sticky top-0 bg-slate-100 dark:bg-[#0f172a] border-b-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider z-10 shadow-sm">
              <tr className="border-b border-slate-300 dark:border-slate-600">
                <th
                  onClick={() => handleSort('countryCode')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Country</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('awbCount')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Volume (AWB)</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avgTT')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Avg TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('minTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Min TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Max TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('onTimePercentage')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r-2 border-slate-400 dark:border-slate-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>On-Time %</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('clearanceDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors font-black bg-slate-100 dark:bg-purple-950/20 border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                    <span className="text-purple-900 dark:text-purple-300 font-black"><strong>Clearance</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-purple-700 dark:text-purple-400/80" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('transitDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors font-black bg-slate-100 dark:bg-sky-950/20 border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Plane className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                    <span className="text-sky-900 dark:text-sky-300 font-black"><strong>Transit</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-sky-700 dark:text-sky-400/80" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('destinationDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors font-black bg-slate-100 dark:bg-amber-950/20 border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span className="text-amber-900 dark:text-amber-300 font-black"><strong>Dest. Delay</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-amber-700 dark:text-amber-400/80" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('weekendDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-black bg-slate-100 dark:bg-rose-950/20 border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                    <span className="text-rose-900 dark:text-rose-300 font-black"><strong>Weekend</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-rose-700 dark:text-rose-400/80" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalDelays')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-amber-100/60 dark:hover:bg-yellow-950/40 transition-colors font-black bg-slate-100 dark:bg-yellow-950/20"
                >
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-yellow-400" />
                    <span className="text-amber-900 dark:text-yellow-300 font-black"><strong>Total Delays</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-amber-700 dark:text-yellow-400/80" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700/80 font-sans">
              {filteredAndSortedData.map((c) => {
                const sharePct = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(1) : 0;

                return (
                  <tr
                    key={c.countryCode}
                    className="hover:bg-blue-50/60 dark:hover:bg-slate-800/60 transition-colors border-b border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 even:bg-slate-50/70 dark:even:bg-slate-900/80"
                  >
                    {/* Country Code (Clickable) */}
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white text-center align-middle border-r border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setModalTarget({ countryCode: c.countryCode, category: 'all', title: `${c.countryCode} — All Outbound Shipments` });
                          setModalSearch('');
                          setModalCurrentPage(1);
                        }}
                        className="flex items-center justify-center gap-2 mx-auto cursor-pointer group hover:opacity-90"
                        title={`Click to view all ${c.awbCount.toLocaleString()} shipments to ${c.countryCode}`}
                      >
                        <span className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-300 text-blue-900 dark:bg-slate-800 dark:border-slate-600 dark:text-sky-400 flex items-center justify-center font-mono text-xs font-black shadow-xs shrink-0 group-hover:border-blue-500 group-hover:bg-blue-200 dark:group-hover:bg-sky-950/60 transition-colors">
                          <strong>{c.countryCode}</strong>
                        </span>
                        <span className="text-slate-950 dark:text-white font-black text-sm group-hover:text-blue-600 dark:group-hover:text-sky-300 group-hover:underline transition-colors">
                          <strong>{c.countryCode}</strong>
                        </span>
                      </button>
                    </td>

                    {/* Volume (AWB) (Clickable) */}
                    <td className="py-2.5 px-3 text-center align-middle font-black text-slate-900 dark:text-white font-mono border-r border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setModalTarget({ countryCode: c.countryCode, category: 'all', title: `${c.countryCode} — All Outbound Shipments` });
                          setModalSearch('');
                          setModalCurrentPage(1);
                        }}
                        className="flex flex-col items-center justify-center mx-auto cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/70 p-1 rounded-xl transition-all w-full"
                        title={`Click to view all ${c.awbCount.toLocaleString()} AWBs for ${c.countryCode}`}
                      >
                        <div className="text-slate-950 dark:text-white text-sm font-black group-hover:text-blue-600 dark:group-hover:text-sky-300 group-hover:underline transition-colors">
                          <strong>{c.awbCount.toLocaleString()}</strong>
                        </div>
                        <div className="text-[11px] text-slate-700 dark:text-slate-400 group-hover:text-slate-950 dark:group-hover:text-slate-200 font-black font-sans">
                          <strong>{sharePct}% of total</strong>
                        </div>
                      </button>
                    </td>

                    {/* Avg TT */}
                    <td className="py-2.5 px-3 text-center align-middle font-mono font-black text-sm border-r border-slate-300 dark:border-slate-700">
                      <span
                        className={
                          c.avgTT <= 4.5
                            ? 'text-emerald-700 dark:text-emerald-400 font-black text-sm'
                            : c.avgTT <= 5.5
                            ? 'text-amber-700 dark:text-amber-400 font-black text-sm'
                            : 'text-rose-700 dark:text-rose-400 font-black text-sm'
                        }
                      >
                        <strong>{c.avgTT} d</strong>
                      </span>
                    </td>

                    {/* Min TT */}
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-950 dark:text-slate-300 font-black border-r border-slate-300 dark:border-slate-700">
                      <strong>{c.minTT} d</strong>
                    </td>

                    {/* Max TT */}
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-950 dark:text-slate-300 font-black border-r border-slate-300 dark:border-slate-700">
                      <strong>{c.maxTT} d</strong>
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-2.5 px-3 text-center align-middle border-r-2 border-slate-400 dark:border-slate-600">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                          <strong>{c.onTimePercentage}%</strong>
                        </span>
                        <div className="w-10 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 hidden sm:block overflow-hidden border border-slate-300 dark:border-slate-700">
                          <div
                            className="bg-emerald-600 dark:bg-emerald-400 h-1.5 rounded-full"
                            style={{ width: `${Math.min(c.onTimePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Clearance Delays (Clickable) */}
                    <td className="py-2.5 px-2 text-center align-middle dark:bg-purple-950/20 border-r border-slate-300 dark:border-slate-700">
                      {c.clearanceDelays > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ countryCode: c.countryCode, category: 'clearance', title: `${c.countryCode} — Clearance Delays` });
                            setModalSearch('');
                            setModalCurrentPage(1);
                          }}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-mono font-black bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-500/25 dark:text-purple-200 dark:border-purple-400/40 shadow-xs hover:bg-purple-200 hover:border-purple-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title={`Click to view ${c.clearanceDelays} clearance delay AWBs for ${c.countryCode}`}
                        >
                          <strong>{c.clearanceDelays}</strong>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-black"><strong>-</strong></span>
                      )}
                    </td>

                    {/* Transit Delays (Clickable) */}
                    <td className="py-2.5 px-2 text-center align-middle dark:bg-sky-950/20 border-r border-slate-300 dark:border-slate-700">
                      {c.transitDelays > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ countryCode: c.countryCode, category: 'transit', title: `${c.countryCode} — Transit Delays` });
                            setModalSearch('');
                            setModalCurrentPage(1);
                          }}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-mono font-black bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-500/25 dark:text-sky-200 dark:border-sky-400/40 shadow-xs hover:bg-sky-200 hover:border-sky-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title={`Click to view ${c.transitDelays} transit delay AWBs for ${c.countryCode}`}
                        >
                          <strong>{c.transitDelays}</strong>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-black"><strong>-</strong></span>
                      )}
                    </td>

                    {/* Destination Delays (Clickable) */}
                    <td className="py-2.5 px-2 text-center align-middle dark:bg-amber-950/20 border-r border-slate-300 dark:border-slate-700">
                      {c.destinationDelays > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ countryCode: c.countryCode, category: 'destination', title: `${c.countryCode} — Destination Delays` });
                            setModalSearch('');
                            setModalCurrentPage(1);
                          }}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-mono font-black bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-400/40 shadow-xs hover:bg-amber-200 hover:border-amber-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title={`Click to view ${c.destinationDelays} destination delay AWBs for ${c.countryCode}`}
                        >
                          <strong>{c.destinationDelays}</strong>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-black"><strong>-</strong></span>
                      )}
                    </td>

                    {/* Weekend Delays (Clickable) */}
                    <td className="py-2.5 px-2 text-center align-middle dark:bg-rose-950/20 border-r border-slate-300 dark:border-slate-700">
                      {c.weekendDelays > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ countryCode: c.countryCode, category: 'weekend', title: `${c.countryCode} — Weekend Delays` });
                            setModalSearch('');
                            setModalCurrentPage(1);
                          }}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-mono font-black bg-rose-100 text-rose-950 border border-rose-300 dark:bg-rose-500/25 dark:text-rose-200 dark:border-rose-400/40 shadow-xs hover:bg-rose-200 hover:border-rose-400 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                          title={`Click to view ${c.weekendDelays} weekend delay AWBs for ${c.countryCode}`}
                        >
                          <strong>{c.weekendDelays}</strong>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-black"><strong>-</strong></span>
                      )}
                    </td>

                    {/* Total Delays (Clickable) */}
                    <td className="py-2.5 px-3 text-center align-middle dark:bg-yellow-950/20">
                      {c.totalDelays > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ countryCode: c.countryCode, category: 'totalDelays', title: `${c.countryCode} — Total Delays` });
                            setModalSearch('');
                            setModalCurrentPage(1);
                          }}
                          className="flex flex-col items-center justify-center mx-auto cursor-pointer group hover:scale-105 active:scale-95 transition-all w-full"
                          title={`Click to view all ${c.totalDelays} delayed AWBs for ${c.countryCode}`}
                        >
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md text-[11px] font-mono font-black bg-amber-100 text-amber-950 border border-amber-400 dark:bg-yellow-500/30 dark:text-yellow-200 dark:border-yellow-400/60 shadow-xs group-hover:bg-amber-200 group-hover:border-amber-500">
                            <strong>{c.totalDelays}</strong>
                          </span>
                          <span className="text-[11px] text-amber-950 dark:text-yellow-400 font-mono font-black mt-0.5 group-hover:underline">
                            <strong>{c.awbCount > 0 ? ((c.totalDelays / c.awbCount) * 100).toFixed(2) : 0}%</strong>
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-black"><strong>-</strong></span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AWB LIST POPUP WINDOW MODAL                                              */}
      {/* ========================================================================= */}
      {modalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalTarget(null);
            }
          }}
        >
          <div className="glass-panel w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-4 sm:p-6 overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-500/30 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {modalTarget.title}
                    </h3>
                    {modalTarget.countryCode && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40">
                        {modalTarget.countryCode}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                      {modalAllShipments.length.toLocaleString()} Total AWBs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Viewing individual shipment records. Click any row to inspect complete tracking milestones &amp; notes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalTarget(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Strip */}
            {modalStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 shrink-0">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Average Transit Time</span>
                  <span className="text-sm sm:text-base font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
                    {modalStats.avgTT} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">days</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Min: {modalStats.minTT}d • Max: {modalStats.maxTT}d
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">On-Time Delivery Rate</span>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {modalStats.onTimeRate}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Delivered within 5 days SLA
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Total Volume</span>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {modalStats.total.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">AWBs</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {modalStats.totalPkgs} packages
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Total Weight</span>
                  <span className="text-sm sm:text-base font-extrabold text-sky-700 dark:text-sky-400 font-mono">
                    {modalStats.totalWeight} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kg</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Combined gross cargo weight
                  </span>
                </div>
              </div>
            )}

            {/* Search & Export Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setModalCurrentPage(1);
                  }}
                  placeholder="Search within this list (AWB, Customer, Shipper, Destination, Delay Reason, Remarks...)"
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyAllAWBs}
                  disabled={modalFilteredShipments.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                  title="Copy all AWBs to clipboard"
                >
                  {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />}
                  <span>{copiedAll ? 'Copied!' : 'Copy AWBs'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportModalExcel}
                  disabled={modalFilteredShipments.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportModalCSV}
                  disabled={modalFilteredShipments.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white border border-blue-300 dark:border-blue-500/30 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 my-1 min-h-[260px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">AWB Number</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Shipper</th>
                    <th className="py-2.5 px-3 text-center">Dest</th>
                    <th className="py-2.5 px-3 text-right">TT (Days)</th>
                    <th className="py-2.5 px-3 text-center">Resolution</th>
                    <th className="py-2.5 px-3">Delay Reason / Remarks</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {modalPaginatedData.length > 0 ? (
                    modalPaginatedData.map((s, idx) => {
                      const globalIndex = (modalValidCurrentPage - 1) * modalPageSize + idx + 1;
                      const isDelivered = s.finalResolution?.toLowerCase() === 'delivered';
                      const isNegativeRes = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(s.finalResolution?.toLowerCase().trim() || '');

                      const delayBadge = s.clearanceDelay && s.clearanceDelay !== '-' ? (
                        <span className="inline-flex items-center gap-1 text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/10 px-2 py-0.5 rounded border border-purple-300 dark:border-purple-500/30 text-[10px] font-semibold">
                          <ShieldAlert className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          {s.clearanceDelay}
                        </span>
                      ) : s.transitDelay && s.transitDelay !== '-' ? (
                        <span className="inline-flex items-center gap-1 text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-500/10 px-2 py-0.5 rounded border border-sky-300 dark:border-sky-500/30 text-[10px] font-semibold">
                          <Plane className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                          {s.transitDelay}
                        </span>
                      ) : s.destinationDelay && s.destinationDelay !== '-' ? (
                        <span className="inline-flex items-center gap-1 text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/30 text-[10px] font-semibold">
                          <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          {s.destinationDelay}
                        </span>
                      ) : (s.weekendDelay || '').toString().toLowerCase().includes('yes') ? (
                        <span className="inline-flex items-center gap-1 text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/10 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-500/30 text-[10px] font-semibold">
                          <Calendar className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Weekend Hold
                        </span>
                      ) : s.remarks ? (
                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[200px] block" title={s.remarks}>
                          {s.remarks}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">-</span>
                      );

                      return (
                        <tr
                          key={s.awb}
                          onClick={() => setInspectedShipment(s)}
                          className="hover:bg-blue-50/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group text-slate-800 dark:text-slate-200"
                          title="Click to view full dossier"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {globalIndex}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                            <div className="flex items-center gap-1.5">
                              <span>{s.awb}</span>
                              <button
                                type="button"
                                onClick={(e) => handleCopySingleAWB(s.awb, e)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                                title="Copy AWB"
                              >
                                {copiedAwb === s.awb ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 max-w-[160px] truncate" title={s.customer}>
                            {s.customer}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={s.shprName}>
                            {s.shprName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-sky-700 dark:text-sky-400 text-[11px] border border-slate-300 dark:border-slate-700">
                              {s.destination}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={typeof s.tt === 'number' && s.tt <= 5 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                              {typeof s.tt === 'number' ? Number(s.tt).toFixed(1) : s.tt} d
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDelivered
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                                  : isNegativeRes
                                  ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 font-black'
                                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                              }`}
                            >
                              {s.finalResolution || 'Delivered'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {delayBadge}
                          </td>
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setInspectedShipment(s)}
                              className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 dark:bg-sky-500/15 dark:hover:bg-sky-500/30 text-sky-800 dark:text-sky-300 hover:text-sky-950 dark:hover:text-white border border-sky-300 dark:border-sky-500/30 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Inspect dossier"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <Package className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No shipment records found</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Try refining your search filter</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer with Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 text-slate-600 dark:text-slate-400 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={modalPageSize}
                    onChange={(e) => {
                      setModalPageSize(Number(e.target.value));
                      setModalCurrentPage(1);
                    }}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-white text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page</span>
                </div>

                <span className="text-slate-300 dark:text-slate-500">|</span>

                <span>
                  Showing{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {modalFilteredShipments.length > 0 ? (modalValidCurrentPage - 1) * modalPageSize + 1 : 0}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {Math.min(modalValidCurrentPage * modalPageSize, modalFilteredShipments.length)}
                  </strong>{' '}
                  of <strong className="text-slate-900 dark:text-white">{modalFilteredShipments.length.toLocaleString()}</strong> records
                </span>
              </div>

              {/* Pagination Page Jump Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setModalCurrentPage(Math.max(1, modalValidCurrentPage - 1))}
                  disabled={modalValidCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-2.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  {modalValidCurrentPage} / {modalTotalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setModalCurrentPage(Math.min(modalTotalPages, modalValidCurrentPage + 1))}
                  disabled={modalValidCurrentPage === modalTotalPages}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE SHIPMENT DOSSIER SUB-MODAL                                        */}
      {/* ========================================================================= */}
      {inspectedShipment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 dark:bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl relative bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">AWB #{inspectedShipment.awb}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">MAWB: {inspectedShipment.mawb || 'N/A'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedShipment(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Customer</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.customer}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Shipper</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{inspectedShipment.shprName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Destination / Recipient</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.destination} ({inspectedShipment.city || 'N/A'})
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{inspectedShipment.recipient}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Transit Time (TT)</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-400 text-base font-mono block mt-0.5">
                  {inspectedShipment.tt} days
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">{inspectedShipment.ttRange}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Transit Delay</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-300 block mt-0.5">
                  {inspectedShipment.transitDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Clearance Delay</span>
                <span className="font-bold text-amber-700 dark:text-amber-300 block mt-0.5">
                  {inspectedShipment.clearanceDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Destination Delay</span>
                <span className="font-bold text-rose-700 dark:text-rose-300 block mt-0.5">
                  {inspectedShipment.destinationDelay || 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Final Resolution</span>
                <span className={`font-bold block mt-0.5 ${
                  inspectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(inspectedShipment.finalResolution)
                    ? 'text-rose-700 dark:text-rose-400 font-extrabold'
                    : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {inspectedShipment.finalResolution || 'Delivered'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2">
                <span className="text-slate-500 block text-[10px]">Pkg &amp; Weight</span>
                <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                  {inspectedShipment.weight} kg • {inspectedShipment.pkgCount} pcs
                </span>
              </div>
            </div>

            {inspectedShipment.remarks && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500 block text-[10px]">Remarks</span>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">{inspectedShipment.remarks}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedShipment(null)}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
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
