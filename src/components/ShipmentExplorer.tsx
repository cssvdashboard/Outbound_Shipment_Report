import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { formatTT, formatWeight, formatExcelDate } from '../utils/formatters';
import * as XLSX from 'xlsx';

interface ShipmentExplorerProps {
  shipments: Shipment[];
  totalRawCount: number;
}

type SortField = 'awb' | 'destination' | 'customer' | 'shprName' | 'tt' | 'ttRange' | 'finalResolution' | 'weight';
type SortOrder = 'asc' | 'desc';

export const ShipmentExplorer: React.FC<ShipmentExplorerProps> = ({
  shipments,
  totalRawCount
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [copiedAWB, setCopiedAWB] = useState<string | null>(null);
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('tt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Quick Filter Pill State
  const [quickFilter, setQuickFilter] = useState<'all' | 'ontime' | 'delayed' | 'customs' | 'transit' | 'dest' | 'rts'>('all');

  // Copy tracking number handler
  const handleCopyAWB = (awb: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(awb);
    setCopiedAWB(awb);
    setTimeout(() => setCopiedAWB(null), 2000);
  };

  // Sort Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter based on search term & quick filter pills
  const filteredData = useMemo(() => {
    let list = shipments;

    // 1. Quick Filter Pills
    if (quickFilter === 'ontime') {
      list = list.filter((s) => s.ttRange === 'Within 4-5 Days' || (s.tt > 0 && s.tt <= 5));
    } else if (quickFilter === 'delayed') {
      list = list.filter((s) => s.ttRange === 'More Than 5 Days' || s.tt > 5);
    } else if (quickFilter === 'customs') {
      list = list.filter((s) => s.clearanceDelay && s.clearanceDelay !== '-');
    } else if (quickFilter === 'transit') {
      list = list.filter((s) => s.transitDelay && s.transitDelay !== '-');
    } else if (quickFilter === 'dest') {
      list = list.filter((s) => s.destinationDelay && s.destinationDelay !== '-');
    } else if (quickFilter === 'rts') {
      list = list.filter((s) => s.finalResolution !== 'Delivered');
    }

    // 2. Search Term Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((s) => {
        return (
          s.awb.toLowerCase().includes(q) ||
          s.shprName.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q) ||
          s.destination.toLowerCase().includes(q) ||
          (s.recipient && s.recipient.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.remarks && s.remarks.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q))
        );
      });
    }

    // 3. Sorting
    return [...list].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [shipments, searchTerm, quickFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validCurrentPage, pageSize]);

  // Summary Metrics of the Filtered Set
  const tableSummary = useMemo(() => {
    const count = filteredData.length;
    if (count === 0) return { avgTT: '0.00', totalWt: '0', onTimePct: '0', delaysCount: 0 };
    let sumTT = 0;
    let totalWt = 0;
    let onTime = 0;
    let delays = 0;

    for (const s of filteredData) {
      sumTT += s.tt;
      totalWt += s.weight || 0;
      if (s.tt <= 5 && s.tt > 0) onTime++;
      if (s.clearanceDelay || s.transitDelay || s.destinationDelay) delays++;
    }

    return {
      avgTT: (sumTT / count).toFixed(2),
      totalWt: Math.round(totalWt).toLocaleString(),
      onTimePct: ((onTime / count) * 100).toFixed(1),
      delaysCount: delays
    };
  }, [filteredData]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipments_Export');
    XLSX.writeFile(workbook, `Shipments_Export_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: 'csv' });
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((s) => ({
        'AWB Tracking Number': s.awb,
        'Destination': s.destination,
        'Customer Account': s.customer,
        'Shipper Name': s.shprName,
        'Recipient': s.recipient || '',
        'Destination City': s.city || '',
        'Pickup Date': formatExcelDate(s.pickup),
        'POD Date': formatExcelDate(s.pod),
        'Weight (kg)': formatWeight(s.weight),
        'Pieces': s.pkgCount,
        'Transit Time (Days)': formatTT(s.tt),
        'Timeline': s.ttRange,
        'Final Resolution': s.finalResolution,
        'Transit Delay': s.transitDelay || '',
        'Clearance Delay': s.clearanceDelay || '',
        'Destination Delay': s.destinationDelay || '',
        'Remarks': s.remarks || '',
        'Description of Goods': s.description || ''
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shipments_Export');
    XLSX.writeFile(workbook, `Shipments_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-sky-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-sky-400 font-bold" />
    );
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      
      {/* 1. TOP HEADER & METRICS STRIP */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl space-y-4 shadow-sm border border-slate-800/80">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-extrabold text-white light:text-slate-900 tracking-tight">
                  <strong>Shipment Record Explorer</strong>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                  <strong>{filteredData.length.toLocaleString()} Active AWBs</strong>
                </span>
              </div>
              <p className="text-xs text-slate-400 light:text-slate-500 mt-0.5 font-medium">
                Full-width transaction explorer • <strong>{totalRawCount.toLocaleString()}</strong> total shipments loaded in file
              </p>
            </div>
          </div>

          {/* Quick Action Export Buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
              title="Download Excel spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span><strong>Export Excel</strong></span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold border border-blue-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
              title="Download CSV spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span><strong>Export CSV</strong></span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Badges Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold"><strong>Average TT:</strong></span>
            <span className="text-sm font-black text-indigo-400 font-mono"><strong>{tableSummary.avgTT} days</strong></span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold"><strong>On-Time Rate:</strong></span>
            <span className="text-sm font-black text-emerald-400 font-mono"><strong>{tableSummary.onTimePct}%</strong></span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold"><strong>Gross Weight:</strong></span>
            <span className="text-sm font-black text-white font-mono"><strong>{tableSummary.totalWt} kg</strong></span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold"><strong>Active Delays:</strong></span>
            <span className="text-sm font-black text-amber-400 font-mono"><strong>{tableSummary.delaysCount} AWBs</strong></span>
          </div>
        </div>

        {/* Search Bar & Quick Filter Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search across all fields: AWB Tracking #, Shipper Name, Customer, Destination, Recipient, Remarks..."
              className="w-full pl-10 pr-9 py-2 text-xs font-semibold rounded-xl bg-slate-950/90 border border-slate-700/90 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'ontime', label: '🟢 On-Time (≤5d)' },
              { id: 'delayed', label: '🟠 Delayed (>5d)' },
              { id: 'customs', label: '📋 Customs Holds' },
              { id: 'transit', label: '✈️ Transit Delays' },
              { id: 'dest', label: '🚚 Dest Delays' },
              { id: 'rts', label: '🔴 RTS / Exceptions' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setQuickFilter(pill.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  quickFilter === pill.id
                    ? pill.id === 'rts'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-500/40 font-black'
                      : 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-black'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span><strong>{pill.label}</strong></span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 2. MAIN WIDESCREEN TABLE CONTAINER */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-slate-800/90">
        <div className="max-h-[640px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#0b0f19]/98 backdrop-blur-xl border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10 shadow-sm">
              <tr>
                <th
                  onClick={() => handleSort('awb')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors min-w-[150px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>AWB Tracking #</strong></span>
                    {renderSortIcon('awb')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('destination')}
                  className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors min-w-[90px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Dest</strong></span>
                    {renderSortIcon('destination')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('customer')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors min-w-[220px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Customer Account</strong></span>
                    {renderSortIcon('customer')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('shprName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors min-w-[220px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Shipper Name</strong></span>
                    {renderSortIcon('shprName')}
                  </div>
                </th>

                <th className="py-3.5 px-4 min-w-[200px] font-bold">
                  <strong>Recipient &amp; Destination City</strong>
                </th>

                <th
                  onClick={() => handleSort('tt')}
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition-colors min-w-[110px] font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>TT (Days)</strong></span>
                    {renderSortIcon('tt')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('ttRange')}
                  className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors min-w-[120px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Timeline</strong></span>
                    {renderSortIcon('ttRange')}
                  </div>
                </th>

                <th
                  onClick={() => handleSort('finalResolution')}
                  className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors min-w-[120px] font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Resolution</strong></span>
                    {renderSortIcon('finalResolution')}
                  </div>
                </th>

                <th className="py-3.5 px-4 min-w-[220px] font-bold">
                  <strong>Logged Exceptions &amp; Remarks</strong>
                </th>

                <th className="py-3.5 px-3 text-center min-w-[80px] font-bold">
                  <strong>Inspect</strong>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedData.map((s, idx) => {
                const formattedDays = formatTT(s.tt);
                const isCopied = copiedAWB === s.awb;

                return (
                  <tr
                    key={`${s.awb}-${idx}`}
                    className="hover:bg-slate-800/40 text-slate-200 transition-colors group"
                  >
                    {/* AWB with Copy Button */}
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">
                      <div className="flex items-center gap-2">
                        <span><strong>{s.awb}</strong></span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyAWB(s.awb, e)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Copy AWB Tracking Number"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Destination Country Badge */}
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono font-bold text-xs text-white shadow-sm">
                        <strong>{s.destination}</strong>
                      </span>
                    </td>

                    {/* Customer Account Name */}
                    <td className="py-3 px-4 font-bold text-slate-200" title={s.customer}>
                      <div className="line-clamp-2 leading-relaxed">
                        <strong>{s.customer}</strong>
                      </div>
                    </td>

                    {/* Shipper Name */}
                    <td className="py-3 px-4 text-slate-300 font-medium" title={s.shprName}>
                      <div className="line-clamp-2 leading-relaxed font-normal">
                        {s.shprName}
                      </div>
                    </td>

                    {/* Recipient & City */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-300 line-clamp-1" title={s.recipient || 'N/A'}>
                        {s.recipient || '-'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {s.city ? `${s.city}, ${s.destination}` : s.destination}
                      </div>
                    </td>

                    {/* Transit Time */}
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-sm">
                      <span
                        className={
                          s.tt <= 4.5
                            ? 'text-emerald-400 font-black'
                            : s.tt <= 5.5
                            ? 'text-amber-400 font-black'
                            : 'text-rose-400 font-black'
                        }
                      >
                        <strong>{formattedDays}</strong> <span className="text-xs font-normal text-slate-400">d</span>
                      </span>
                    </td>

                    {/* Delivery Timeline Pill */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          s.ttRange === 'Within 4-5 Days' || s.tt <= 5
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        <strong>{s.tt <= 5 ? 'Within 4-5d' : '> 5 Days'}</strong>
                      </span>
                    </td>

                    {/* Final Resolution Pill */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          s.finalResolution === 'Delivered'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : s.finalResolution === 'RTS'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black shadow-sm'
                            : s.finalResolution === 'Lost'
                            ? 'bg-red-600/30 text-red-200 border border-red-500/60 font-black shadow-sm'
                            : s.finalResolution === 'Destroyed'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/80 font-black shadow-sm'
                            : s.finalResolution === 'Seized'
                            ? 'bg-red-950 text-red-300 border border-red-700/80 font-black shadow-sm'
                            : s.finalResolution === 'Undelivered'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {['RTS', 'Lost', 'Destroyed', 'Seized'].includes(s.finalResolution) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />
                        )}
                        <strong>{s.finalResolution || 'Delivered'}</strong>
                      </span>
                    </td>

                    {/* Logged Delays & Remarks */}
                    <td className="py-3 px-4 text-xs font-medium">
                      {s.clearanceDelay && s.clearanceDelay !== '-' ? (
                        <div className="text-amber-300 font-bold line-clamp-1" title={`Clearance Delay: ${s.clearanceDelay}`}>
                          📋 <strong>{s.clearanceDelay}</strong>
                        </div>
                      ) : s.transitDelay && s.transitDelay !== '-' ? (
                        <div className="text-indigo-300 font-bold line-clamp-1" title={`Transit Delay: ${s.transitDelay}`}>
                          ✈️ <strong>{s.transitDelay}</strong>
                        </div>
                      ) : s.destinationDelay && s.destinationDelay !== '-' ? (
                        <div className="text-rose-300 font-bold line-clamp-1" title={`Destination Delay: ${s.destinationDelay}`}>
                          🚚 <strong>{s.destinationDelay}</strong>
                        </div>
                      ) : s.remarks && s.remarks !== '-' ? (
                        <div className="text-slate-400 line-clamp-1 font-normal" title={s.remarks}>
                          💬 {s.remarks}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">-</span>
                      )}
                    </td>

                    {/* Inspect Button */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedShipment(s)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="View Full Shipment Dossier"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Package className="w-8 h-8 text-slate-600" />
                      <p className="text-sm font-bold text-white"><strong>No shipment records found</strong></p>
                      <p className="text-xs text-slate-400">
                        Try modifying your search keywords or resetting active quick filters.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. PAGINATION CONTROLS BAR */}
        <div className="p-4 bg-[#0b0f19]/95 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold">
              <span><strong>Rows per page:</strong></span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <span className="font-semibold">
              Showing{' '}
              <strong className="text-white font-mono font-bold">
                {filteredData.length > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0}
              </strong>{' '}
              -{' '}
              <strong className="text-white font-mono font-bold">
                {Math.min(validCurrentPage * pageSize, filteredData.length)}
              </strong>{' '}
              of <strong className="text-white font-mono font-bold">{filteredData.length.toLocaleString()}</strong> records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={validCurrentPage <= 1}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-colors flex items-center gap-1 font-bold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span><strong>Previous</strong></span>
            </button>
            
            <span className="font-mono text-xs px-2.5 text-slate-300 font-bold">
              <strong>Page {validCurrentPage} of {totalPages}</strong>
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={validCurrentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-colors flex items-center gap-1 font-bold cursor-pointer"
            >
              <span><strong>Next</strong></span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. SHIPMENT DETAIL MODAL DOSSIER */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-7 rounded-3xl space-y-5 shadow-2xl relative bg-slate-950 border border-sky-500/40">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white font-mono">
                      <strong>AWB #{selectedShipment.awb}</strong>
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/20 text-sky-400 font-mono">
                      <strong>{selectedShipment.destination}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    MAWB: <strong>{selectedShipment.mawb || 'N/A'}</strong> • Ramp: <strong>{selectedShipment.rampId || 'N/A'}</strong> • Dest Loc: <strong>{selectedShipment.destLocCd || 'N/A'}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Customer Account</strong></span>
                <span className="font-black text-white mt-1 block text-sm"><strong>{selectedShipment.customer}</strong></span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Shipper Name</strong></span>
                <span className="font-black text-white mt-1 block text-sm"><strong>{selectedShipment.shprName}</strong></span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Recipient &amp; Delivery City</strong></span>
                <span className="font-bold text-white mt-1 block text-sm">
                  <strong>{selectedShipment.recipient || 'N/A'}</strong>
                </span>
                <span className="text-slate-400 text-xs block mt-0.5 font-medium">
                  City: {selectedShipment.city || 'N/A'} ({selectedShipment.destination})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Transit Time &amp; Resolution</strong></span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-black text-indigo-400 font-mono text-base">
                    <strong>{formatTT(selectedShipment.tt)} days</strong>
                  </span>
                  <span className="text-xs text-slate-400 font-bold"><strong>({selectedShipment.ttRange})</strong></span>
                </div>
                <span className={`font-black text-xs block mt-0.5 ${
                  selectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(selectedShipment.finalResolution)
                    ? 'text-rose-400 font-black'
                    : 'text-amber-400'
                }`}>
                  <strong>Status: {selectedShipment.finalResolution}</strong>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Pickup Date</strong></span>
                <span className="font-bold text-white mt-1 block font-mono">
                  <strong>{formatExcelDate(selectedShipment.pickup)}</strong>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>POD / Delivery Date</strong></span>
                <span className="font-bold text-white mt-1 block font-mono">
                  <strong>{formatExcelDate(selectedShipment.pod)}</strong>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Package Pieces</strong></span>
                <span className="font-black text-white mt-1 block font-mono text-sm">
                  <strong>{selectedShipment.pkgCount || 1} pcs</strong>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Gross Weight</strong></span>
                <span className="font-black text-white mt-1 block font-mono text-sm">
                  <strong>{formatWeight(selectedShipment.weight)} kg</strong>
                </span>
              </div>
            </div>

            {/* Delays section */}
            {(selectedShipment.clearanceDelay || selectedShipment.transitDelay || selectedShipment.destinationDelay || selectedShipment.remarks) && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2">
                <div className="font-black text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span><strong>Logged Delay Exceptions &amp; Remarks</strong></span>
                </div>
                {selectedShipment.clearanceDelay && selectedShipment.clearanceDelay !== '-' && (
                  <div className="text-slate-300">📋 Clearance Delay: <span className="text-white font-bold"><strong>{selectedShipment.clearanceDelay}</strong></span></div>
                )}
                {selectedShipment.transitDelay && selectedShipment.transitDelay !== '-' && (
                  <div className="text-slate-300">✈️ Transit Delay: <span className="text-white font-bold"><strong>{selectedShipment.transitDelay}</strong></span></div>
                )}
                {selectedShipment.destinationDelay && selectedShipment.destinationDelay !== '-' && (
                  <div className="text-slate-300">🚚 Destination Delay: <span className="text-white font-bold"><strong>{selectedShipment.destinationDelay}</strong></span></div>
                )}
                {selectedShipment.remarks && selectedShipment.remarks !== '-' && (
                  <div className="text-slate-300">💬 Remarks: <span className="text-white font-bold"><strong>{selectedShipment.remarks}</strong></span></div>
                )}
              </div>
            )}

            {/* Description */}
            {selectedShipment.description && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 text-[10px] uppercase font-bold block"><strong>Description of Goods</strong></span>
                <p className="text-slate-200 mt-1 leading-relaxed font-medium">{selectedShipment.description}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-500/20 cursor-pointer"
              >
                <strong>Close Dossier</strong>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
