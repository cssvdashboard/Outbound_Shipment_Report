import React, { useState, useMemo } from 'react';
import { Shipment } from '../types/logistics';
import { calculateInsights } from '../utils/insightsAnalytics';
import * as XLSX from 'xlsx';
import { 
  Sparkles, 
  MapPin, 
  Search, 
  Download, 
  Copy, 
  Check, 
  ArrowUpDown, 
  AlertCircle,
  Clock,
  Globe,
  RotateCcw
} from 'lucide-react';

interface InsightsHubProps {
  shipments: Shipment[];
}

export const InsightsHub: React.FC<InsightsHubProps> = ({ shipments }) => {
  // Calculate insights data through the strict 5-order pipeline
  const insightsData = useMemo(() => {
    return calculateInsights(shipments);
  }, [shipments]);

  // State
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedDestLoc, setSelectedDestLoc] = useState<string | null>(null);
  const [selectedDayBucket, setSelectedDayBucket] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'daysToPod' | 'awb' | 'country' | 'destLocCd' | 'podFormatted' | 'commitDateFormatted' | 'sipsFormatted'>('daysToPod');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Available Dest Locs based on selectedCountry
  const availableDestLocs = useMemo(() => {
    if (selectedCountry) {
      const countryObj = insightsData.countries.find(c => c.countryCode === selectedCountry);
      return countryObj ? countryObj.destLocs : [];
    }
    const locMap = new Map<string, number>();
    for (const r of insightsData.allRecords) {
      locMap.set(r.destLocCd, (locMap.get(r.destLocCd) || 0) + 1);
    }
    return Array.from(locMap.entries())
      .map(([locId, awbCount]) => ({ locId, awbCount, avgDaysToPod: 0 }))
      .sort((a, b) => b.awbCount - a.awbCount);
  }, [insightsData, selectedCountry]);

  // Handle copying AWB to clipboard
  const handleCopyAwb = (awb: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(awb);
    setCopiedAwb(awb);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  // Filter records based on country, destLoc, day bucket, and text search
  const filteredRecords = useMemo(() => {
    return insightsData.allRecords.filter(r => {
      if (selectedCountry && r.country !== selectedCountry) return false;
      if (selectedDestLoc && r.destLocCd !== selectedDestLoc) return false;

      if (selectedDayBucket) {
        if (selectedDayBucket === '0' && r.daysToPod !== 0) return false;
        if (selectedDayBucket === '1' && r.daysToPod !== 1) return false;
        if (selectedDayBucket === '2' && r.daysToPod !== 2) return false;
        if (selectedDayBucket === '3-4' && (r.daysToPod < 3 || r.daysToPod > 4)) return false;
        if (selectedDayBucket === '5+' && r.daysToPod < 5) return false;
      }

      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesAwb = r.awb.toLowerCase().includes(query);
        const matchesCountry = r.country.toLowerCase().includes(query);
        const matchesLoc = r.destLocCd.toLowerCase().includes(query);
        if (!matchesAwb && !matchesCountry && !matchesLoc) {
          return false;
        }
      }

      return true;
    });
  }, [insightsData.allRecords, selectedCountry, selectedDestLoc, selectedDayBucket, searchTerm]);

  // Sort filtered records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortAsc ? (valA - valB) : (valB - valA);
    });
  }, [filteredRecords, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCountry, selectedDestLoc, selectedDayBucket, searchTerm, pageSize]);

  // Export filtered records to Excel (.xlsx)
  const handleExportExcel = () => {
    const exportRows = filteredRecords.map(r => ({
      'AWB Number': r.awb,
      'Country': r.country,
      'Dest Loc': r.destLocCd,
      'DEX 01 Scan': r.dex01Formatted !== '-' ? r.dex01Formatted : '',
      'STAT 41 Scan': r.stat41Formatted !== '-' ? r.stat41Formatted : '',
      'SIPS Date': r.sipsFormatted,
      'Commit Time': r.commitDateFormatted,
      'POD Date': r.podFormatted,
      'Days to POD': r.daysToPod
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Insights_AWB');
    XLSX.writeFile(wb, `Insights_AWB_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Helper for Days to POD badge color
  const getDaysBadge = (days: number) => {
    if (days === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          0d (Same Day)
        </span>
      );
    }
    if (days === 1) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
          +1 Day
        </span>
      );
    }
    if (days === 2) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
          +2 Days
        </span>
      );
    }
    if (days <= 4) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
          +{days} Days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        +{days} Days
      </span>
    );
  };

  return (
    <div className="space-y-3.5 pb-12 animate-fade-in">
      {/* Sleek Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Insights
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {insightsData.totalInsightsAWBs.toLocaleString()} AWBs
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AWBs with DEX 01 or STAT 41 scan on/after SIPS, delivered on/before commit time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Download table to Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Table Container */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        
        {/* Top Controls Row: Country Filter, Dest Loc Filter, Search, and Active Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          
          {/* Dropdown Filters (Country & Dest Loc) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Country Dropdown */}
            <div className="relative min-w-[200px]">
              <Globe className="w-3.5 h-3.5 text-cyan-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCountry || ''}
                onChange={(e) => {
                  setSelectedCountry(e.target.value || null);
                  setSelectedDestLoc(null);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 hover:border-cyan-500 dark:hover:border-cyan-500 rounded-xl pl-8 pr-8 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer appearance-none shadow-xs"
                title="Filter by destination country"
              >
                <option value="">All Countries ({insightsData.countries.length})</option>
                {insightsData.countries.map(c => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.countryCode} — {c.awbCount.toLocaleString()} AWBs
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Dest Loc Dropdown */}
            <div className="relative min-w-[190px]">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedDestLoc || ''}
                onChange={(e) => setSelectedDestLoc(e.target.value || null)}
                disabled={availableDestLocs.length === 0}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl pl-8 pr-8 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none shadow-xs disabled:opacity-50"
                title="Filter by Destination Location ID"
              >
                <option value="">
                  {selectedCountry ? `All ${selectedCountry} Locs (${availableDestLocs.length})` : `All Dest Locs (${availableDestLocs.length})`}
                </option>
                {availableDestLocs.map(loc => (
                  <option key={loc.locId} value={loc.locId}>
                    {loc.locId} — {loc.awbCount.toLocaleString()} AWBs
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters Button */}
            {(selectedCountry || selectedDestLoc || selectedDayBucket || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedDestLoc(null);
                  setSelectedDayBucket(null);
                  setSearchTerm('');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Search Box & Total Count */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Showing <span className="text-slate-900 dark:text-white font-extrabold">{filteredRecords.length.toLocaleString()}</span> of {insightsData.totalInsightsAWBs.toLocaleString()} AWBs
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search AWB, Country, Loc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Days to POD Filter Pills Row */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="font-semibold text-slate-400 text-[11px] flex items-center gap-1 mr-1">
            <Clock className="w-3 h-3" />
            Days to POD:
          </span>
          <button
            onClick={() => setSelectedDayBucket(null)}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === null
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            All ({insightsData.totalInsightsAWBs})
          </button>
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '0' ? null : '0')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === '0'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            0d ({insightsData.daysDistribution.sameDay})
          </button>
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '1' ? null : '1')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === '1'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
            }`}
          >
            1d ({insightsData.daysDistribution.oneDay})
          </button>
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '2' ? null : '2')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === '2'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
            }`}
          >
            2d ({insightsData.daysDistribution.twoDays})
          </button>
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '3-4' ? null : '3-4')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === '3-4'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
            }`}
          >
            3–4d ({insightsData.daysDistribution.threeToFourDays})
          </button>
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '5+' ? null : '5+')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
              selectedDayBucket === '5+'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
            }`}
          >
            5+d ({insightsData.daysDistribution.fivePlusDays})
          </button>
        </div>

        {/* Full-Width Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
                <th 
                  onClick={() => handleSort('awb')} 
                  className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>AWB Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('country')} 
                  className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Country</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('destLocCd')} 
                  className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Dest Loc</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-2">DEX 01 Scan</th>
                <th className="py-3 px-2">STAT 41 Scan</th>
                <th 
                  onClick={() => handleSort('sipsFormatted')} 
                  className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>SIPS</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('commitDateFormatted')} 
                  className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>Commit Time</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('podFormatted')} 
                  className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>POD Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('daysToPod')} 
                  className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold"
                >
                  <div className="flex items-center gap-1">
                    <span>Days to POD</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-7 h-7 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold">No qualifying AWBs found</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting filters or adjusting search term</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(r => (
                  <tr 
                    key={r.awb}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* AWB with copy button */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 group">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {r.awb}
                        </span>
                        <button
                          onClick={(e) => handleCopyAwb(r.awb, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
                          title="Copy AWB"
                        >
                          {copiedAwb === r.awb ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Country */}
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 rounded font-black text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                        {r.country}
                      </span>
                    </td>

                    {/* Dest Loc */}
                    <td className="py-2.5 px-2">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                        {r.destLocCd}
                      </span>
                    </td>

                    {/* DEX 01 Scan Date */}
                    <td className="py-2.5 px-2 text-[11px] font-mono whitespace-nowrap">
                      {r.dex01Formatted !== '-' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          {r.dex01Formatted}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* STAT 41 Scan Date */}
                    <td className="py-2.5 px-2 text-[11px] font-mono whitespace-nowrap">
                      {r.stat41Formatted !== '-' ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          {r.stat41Formatted}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* SIPS Date */}
                    <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                      {r.sipsFormatted}
                    </td>

                    {/* Commit Time */}
                    <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                      {r.commitDateFormatted}
                    </td>

                    {/* POD Date (Strictly on or before commit time) */}
                    <td className="py-2.5 px-2 whitespace-nowrap font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {r.podFormatted}
                        </span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20" title="POD date/time strictly did not cross commit time">
                          ✓ On-Time
                        </span>
                      </div>
                    </td>

                    {/* Days to POD */}
                    <td className="py-2.5 px-3 whitespace-nowrap bg-rose-500/5">
                      {getDaysBadge(r.daysToPod)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-1">
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
