import React, { useState, useMemo, useEffect } from 'react';
import {
  Globe,
  Search,
  ArrowUpDown,
  Download,
  MapPin,
  Calendar,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Package,
  FileSpreadsheet,
  Layers,
  Eye
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
  countryCode?: string; // If undefined or 'ALL', applies to all destinations
  category: 'all' | 'day1to4' | 'day5' | 'day6' | 'day7' | 'day8Plus' | 'undelivered' | 'clearance' | 'transit' | 'destination' | 'weekend' | 'totalDelays';
  title: string;
}

type SortField =
  | 'countryCode'
  | 'awbCount'
  | 'totalWeight'
  | 'onTimePercentage'
  | 'day1to4Count'
  | 'day5Count'
  | 'day6Count'
  | 'day7Count'
  | 'day8PlusCount'
  | 'minTT'
  | 'maxTT';

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

  // Modal State for Country & Day-Wise AWB List Popup Window
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

  // Weight lookup map per country as an extra safeguard
  const countryWeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of effectiveShipments) {
      const code = (s.destination || 'UNKNOWN').toUpperCase();
      map.set(code, (map.get(code) || 0) + (s.weight || 0));
    }
    return map;
  }, [effectiveShipments]);

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
      let valA: any = a[sortField] ?? 0;
      let valB: any = b[sortField] ?? 0;

      if (sortField === 'totalWeight') {
        valA = a.totalWeight ?? (countryWeightMap.get(a.countryCode.toUpperCase()) || 0);
        valB = b.totalWeight ?? (countryWeightMap.get(b.countryCode.toUpperCase()) || 0);
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [countryData, countryWeightMap, searchTerm, sortField, sortOrder]);

  const handleExport = () => {
    if (filteredAndSortedData.length === 0) return;

    const exportRows = filteredAndSortedData.map((c) => {
      const share = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(2) : '0';
      const weightInKg = c.totalWeight ?? (countryWeightMap.get(c.countryCode.toUpperCase()) || 0);
      const weightInTons = weightInKg / 1000;

      return {
        'Country Code': c.countryCode,
        'Volume (AWB)': c.awbCount,
        'Volume Share (%)': `${share}%`,
        'Weight (Tons)': Number(weightInTons.toFixed(2)),
        'Weight (Kg)': Number(weightInKg.toFixed(1)),
        'On-Time (%)': `${c.onTimePercentage}%`,
        'On-Time Count (<=5d)': c.onTimeCount,
        'Day 1–4 (AWB)': c.day1to4Count,
        'Day 1–4 (%)': `${c.day1to4Percentage}%`,
        'Day 5 (AWB)': c.day5Count,
        'Day 5 (%)': `${c.day5Percentage}%`,
        'Day 6 (AWB)': c.day6Count,
        'Day 6 (%)': `${c.day6Percentage}%`,
        'Day 7 (AWB)': c.day7Count,
        'Day 7 (%)': `${c.day7Percentage}%`,
        'Day 8+ (AWB)': c.day8PlusCount,
        'Day 8+ (%)': `${c.day8PlusPercentage}%`,
        'Undelivered (AWB)': c.undeliveredCount,
        'Min TT (Days)': c.minTT,
        'Max TT (Days)': c.maxTT
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Destination_DayWise');
    XLSX.writeFile(workbook, `Destination_DayWise_Breakdown_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter shipments for the active popup modal
  const modalAllShipments = useMemo(() => {
    if (!modalTarget || effectiveShipments.length === 0) return [];
    const { countryCode, category } = modalTarget;

    return effectiveShipments.filter((s) => {
      // 1. Destination Country check
      if (countryCode && countryCode !== 'ALL') {
        const destCode = (s.destination || 'UNKNOWN').toUpperCase().trim();
        if (destCode !== countryCode.toUpperCase().trim()) return false;
      }

      // 2. Category check
      if (category === 'all') {
        return true;
      }

      const tt = typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0;

      if (category === 'day1to4') {
        return s.ttRange === 'Day 1–4' || s.ttRange === 'Within 4 Days' || (tt > 0 && tt <= 4);
      }
      if (category === 'day5') {
        return s.ttRange === 'Day 5' || s.ttRange === 'Within 5 Days' || (tt > 4 && tt <= 5);
      }
      if (category === 'day6') {
        return s.ttRange === 'Day 6' || s.ttRange === 'Within 6 Days' || (tt > 5 && tt <= 6);
      }
      if (category === 'day7') {
        return s.ttRange === 'Day 7' || s.ttRange === 'Within 7 Days' || (tt > 6 && tt <= 7);
      }
      if (category === 'day8Plus') {
        return s.ttRange === 'Day 8+' || s.ttRange === 'More Than 7 Days' || tt > 7;
      }
      if (category === 'undelivered') {
        return s.ttRange === 'Undelivered' || (s.finalResolution?.toLowerCase() !== 'delivered' && tt <= 0);
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
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let onTimeCount = 0;
    let totalWeight = 0;
    let totalPkgs = 0;

    for (const s of modalAllShipments) {
      const tt = typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0;
      if (tt > 0 && tt < minTT) minTT = tt;
      if (tt > maxTT) maxTT = tt;
      if (tt > 0 && tt <= 5) onTimeCount++;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
    }

    return {
      total,
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
      'Delivery Milestone': s.ttRange,
      'Final Resolution': s.finalResolution || 'Delivered',
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
      'Delivery Milestone': s.ttRange,
      'Final Resolution': s.finalResolution || 'Delivered',
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

  // Milestone styling map
  const milestoneBadgeMap: Record<string, string> = {
    'Day 1–4': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
    'Day 5': 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
    'Day 6': 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40',
    'Day 7': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
    'Day 8+': 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
    'Undelivered': 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  };

  // Helper to open modal for specific milestone
  const openMilestoneModal = (category: CountryModalTarget['category'], milestoneName: string, countryCode?: string) => {
    const countryLabel = countryCode ? `${countryCode} — ` : 'All Destinations — ';
    setModalTarget({
      countryCode,
      category,
      title: `${countryLabel}${milestoneName} Shipments`
    });
    setModalSearch('');
    setModalCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Table Toolbar with Title, Search, and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border-2 border-slate-300 dark:border-slate-700 backdrop-blur-sm shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Destination Details (Day-Wise Performance Breakdown)
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 font-bold border border-sky-300 dark:border-sky-500/30">
              {filteredAndSortedData.length} Countries
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Country-by-country delivery speed milestone counts and percentages.
            <span className="text-sky-700 dark:text-sky-400 font-semibold ml-1">
              Click on any number or row to view the underlying AWB list.
            </span>
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
            title="Export destination table with day-wise breakdown to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Table Container with Day-Wise Breakdown Columns */}
      <div className="rounded-2xl overflow-hidden shadow-sm border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/40">
        <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-center text-xs min-w-[1000px] border-collapse border-spacing-0">
            <thead className="sticky top-0 bg-slate-100 dark:bg-[#0f172a] border-b-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider z-10 shadow-sm">
              <tr className="border-b border-slate-300 dark:border-slate-600">
                {/* Country */}
                <th
                  onClick={() => handleSort('countryCode')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Country</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>

                {/* Volume (AWB) */}
                <th
                  onClick={() => handleSort('awbCount')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Volume (AWB)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>

                {/* Weight */}
                <th
                  onClick={() => handleSort('totalWeight')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Weight (Tons / Kg)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>

                {/* On-Time % (<= 5 Days SLA) */}
                <th
                  onClick={() => handleSort('onTimePercentage')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r-2 border-slate-400 dark:border-slate-600 bg-emerald-50/30 dark:bg-emerald-950/10"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-800 dark:text-emerald-300">
                    <span>On-Time % (≤5d)</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </th>

                {/* Day 1–4 */}
                <th
                  onClick={() => handleSort('day1to4Count')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 transition-colors font-black bg-emerald-50/50 dark:bg-emerald-950/20 border-r border-slate-300 dark:border-slate-700 text-emerald-800 dark:text-emerald-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Day 1–4</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </th>

                {/* Day 5 */}
                <th
                  onClick={() => handleSort('day5Count')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-cyan-100/60 dark:hover:bg-cyan-950/40 transition-colors font-black bg-cyan-50/50 dark:bg-cyan-950/20 border-r border-slate-300 dark:border-slate-700 text-cyan-800 dark:text-cyan-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Day 5</span>
                    <ArrowUpDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </th>

                {/* Day 6 */}
                <th
                  onClick={() => handleSort('day6Count')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 transition-colors font-black bg-indigo-50/50 dark:bg-indigo-950/20 border-r border-slate-300 dark:border-slate-700 text-indigo-800 dark:text-indigo-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Day 6</span>
                    <ArrowUpDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </th>

                {/* Day 7 */}
                <th
                  onClick={() => handleSort('day7Count')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors font-black bg-amber-50/50 dark:bg-amber-950/20 border-r border-slate-300 dark:border-slate-700 text-amber-800 dark:text-amber-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Day 7</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  </div>
                </th>

                {/* Day 8+ */}
                <th
                  onClick={() => handleSort('day8PlusCount')}
                  className="py-3 px-2.5 text-center cursor-pointer hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors font-black bg-rose-50/50 dark:bg-rose-950/20 border-r border-slate-300 dark:border-slate-700 text-rose-800 dark:text-rose-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Day 8+</span>
                    <ArrowUpDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  </div>
                </th>

                {/* Min TT */}
                <th
                  onClick={() => handleSort('minTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black border-r border-slate-300 dark:border-slate-700"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Min TT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                </th>

                {/* Max TT */}
                <th
                  onClick={() => handleSort('maxTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white transition-colors font-black"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Max TT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
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
                        <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 dark:bg-slate-800 dark:border-slate-600 dark:text-sky-400 flex items-center justify-center font-mono text-xs font-black shadow-xs shrink-0 group-hover:border-blue-500 group-hover:bg-blue-100 dark:group-hover:bg-sky-950/60 transition-colors">
                          {c.countryCode}
                        </span>
                        <span className="text-slate-900 dark:text-white font-extrabold group-hover:text-blue-600 dark:group-hover:text-sky-300 group-hover:underline transition-colors">
                          {c.countryCode}
                        </span>
                      </button>
                    </td>

                    {/* Volume (AWB) */}
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
                        <div className="text-slate-900 dark:text-white text-sm font-black group-hover:text-blue-600 dark:group-hover:text-sky-300 group-hover:underline transition-colors">
                          {c.awbCount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 font-bold font-sans">
                          {sharePct}% of total
                        </div>
                      </button>
                    </td>

                    {/* Weight (Tons / Kg) */}
                    <td className="py-2.5 px-3 text-center align-middle font-mono border-r border-slate-300 dark:border-slate-700">
                      {(() => {
                        const weightInKg = c.totalWeight ?? (countryWeightMap.get(c.countryCode.toUpperCase()) || 0);
                        const weightInTons = weightInKg / 1000;
                        return (
                          <div className="flex flex-col items-center justify-center">
                            <div className="text-slate-900 dark:text-white text-xs font-black">
                              {weightInTons.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tons
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold font-sans">
                              {weightInKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* On-Time Rate (<=5d) */}
                    <td className="py-2.5 px-3 text-center align-middle border-r-2 border-slate-400 dark:border-slate-600 bg-emerald-50/20 dark:bg-emerald-950/10">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          {c.onTimePercentage}%
                        </span>
                        <div className="w-10 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 hidden sm:block overflow-hidden border border-slate-300 dark:border-slate-700">
                          <div
                            className="bg-emerald-500 dark:bg-emerald-400 h-1.5 rounded-full"
                            style={{ width: `${Math.min(c.onTimePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Day 1–4 Milestone */}
                    <td className="py-2.5 px-2 text-center align-middle border-r border-slate-300 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-950/15">
                      {c.day1to4Count > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMilestoneModal('day1to4', 'Day 1–4', c.countryCode)}
                          className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer w-full max-w-[85px]"
                          title={`Click to view ${c.day1to4Count.toLocaleString()} shipments delivered in Day 1–4 to ${c.countryCode}`}
                        >
                          <span className="text-xs font-black">{c.day1to4Count.toLocaleString()}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">{c.day1to4Percentage}%</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Day 5 Milestone */}
                    <td className="py-2.5 px-2 text-center align-middle border-r border-slate-300 dark:border-slate-700 bg-cyan-50/30 dark:bg-cyan-950/15">
                      {c.day5Count > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMilestoneModal('day5', 'Day 5', c.countryCode)}
                          className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg font-mono bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer w-full max-w-[85px]"
                          title={`Click to view ${c.day5Count.toLocaleString()} shipments delivered on Day 5 to ${c.countryCode}`}
                        >
                          <span className="text-xs font-black">{c.day5Count.toLocaleString()}</span>
                          <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold">{c.day5Percentage}%</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Day 6 Milestone */}
                    <td className="py-2.5 px-2 text-center align-middle border-r border-slate-300 dark:border-slate-700 bg-indigo-50/30 dark:bg-indigo-950/15">
                      {c.day6Count > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMilestoneModal('day6', 'Day 6', c.countryCode)}
                          className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg font-mono bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer w-full max-w-[85px]"
                          title={`Click to view ${c.day6Count.toLocaleString()} shipments delivered on Day 6 to ${c.countryCode}`}
                        >
                          <span className="text-xs font-black">{c.day6Count.toLocaleString()}</span>
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold">{c.day6Percentage}%</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Day 7 Milestone */}
                    <td className="py-2.5 px-2 text-center align-middle border-r border-slate-300 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-950/15">
                      {c.day7Count > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMilestoneModal('day7', 'Day 7', c.countryCode)}
                          className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg font-mono bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer w-full max-w-[85px]"
                          title={`Click to view ${c.day7Count.toLocaleString()} shipments delivered on Day 7 to ${c.countryCode}`}
                        >
                          <span className="text-xs font-black">{c.day7Count.toLocaleString()}</span>
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">{c.day7Percentage}%</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Day 8+ Milestone */}
                    <td className="py-2.5 px-2 text-center align-middle border-r border-slate-300 dark:border-slate-700 bg-rose-50/30 dark:bg-rose-950/15">
                      {c.day8PlusCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMilestoneModal('day8Plus', 'Day 8+', c.countryCode)}
                          className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded-lg font-mono bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer w-full max-w-[85px]"
                          title={`Click to view ${c.day8PlusCount.toLocaleString()} shipments delivered in Day 8+ to ${c.countryCode}`}
                        >
                          <span className="text-xs font-black">{c.day8PlusCount.toLocaleString()}</span>
                          <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold">{c.day8PlusPercentage}%</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Min TT */}
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-700 dark:text-slate-300 font-bold border-r border-slate-300 dark:border-slate-700">
                      {c.minTT} d
                    </td>

                    {/* Max TT */}
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-700 dark:text-slate-300 font-bold">
                      {c.maxTT} d
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
          <div className="glass-panel w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl relative bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 p-4 sm:p-6 overflow-hidden">
            
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
                    {modalTarget.countryCode && modalTarget.countryCode !== 'ALL' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40">
                        {modalTarget.countryCode}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                      {modalAllShipments.length.toLocaleString()} Total AWBs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Viewing individual shipment records. Click any row to inspect complete tracking details &amp; notes.
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
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Transit Time Range</span>
                  <span className="text-sm sm:text-base font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
                    {modalStats.minTT}d – {modalStats.maxTT}d
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Min to Max speed
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">On-Time Delivery Rate</span>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {modalStats.onTimeRate}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Delivered within 5 days SLA
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Total Volume</span>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {modalStats.total.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">AWBs</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    {modalStats.totalPkgs} packages
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border-2 border-slate-300 dark:border-slate-700">
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
                  placeholder="Search within this list (AWB, Customer, Shipper, Destination, Remarks...)"
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
            <div className="flex-1 overflow-y-auto border-2 border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/60 my-1 min-h-[260px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">AWB Number</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Shipper</th>
                    <th className="py-2.5 px-3 text-center">Dest</th>
                    <th className="py-2.5 px-3 text-right">TT (Days)</th>
                    <th className="py-2.5 px-3 text-center">Milestone</th>
                    <th className="py-2.5 px-3 text-center">Resolution</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {modalPaginatedData.length > 0 ? (
                    modalPaginatedData.map((s, idx) => {
                      const globalIndex = (modalValidCurrentPage - 1) * modalPageSize + idx + 1;
                      const isDelivered = s.finalResolution?.toLowerCase() === 'delivered';
                      const isNegativeRes = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(s.finalResolution?.toLowerCase().trim() || '');

                      const milestoneKey = s.ttRange || (s.tt > 0 && s.tt <= 4 ? 'Day 1–4' : s.tt === 5 ? 'Day 5' : s.tt === 6 ? 'Day 6' : s.tt === 7 ? 'Day 7' : s.tt > 7 ? 'Day 8+' : 'Undelivered');
                      const badgeClass = milestoneBadgeMap[milestoneKey] || milestoneBadgeMap['Undelivered'];

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
                              {s.tt} d
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeClass}`}>
                              {s.ttRange || milestoneKey}
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
                            {s.remarks ? (
                              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[200px] block" title={s.remarks}>
                                {s.remarks}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">-</span>
                            )}
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
                      <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
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
                <span className="text-slate-500 block text-[10px]">Delivery Milestone</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  {inspectedShipment.ttRange}
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
