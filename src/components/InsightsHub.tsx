import React, { useState, useMemo } from 'react';
import { Shipment } from '../types/logistics';
import { calculateInsights } from '../utils/insightsAnalytics';
import * as XLSX from 'xlsx';
import { 
  Sparkles, 
  MapPin, 
  Search, 
  Download, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  ArrowUpDown, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface InsightsHubProps {
  shipments: Shipment[];
}

export const InsightsHub: React.FC<InsightsHubProps> = ({ shipments }) => {
  // Calculate insights data through the 5-order pipeline
  const insightsData = useMemo(() => {
    return calculateInsights(shipments);
  }, [shipments]);

  // State
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedDestLoc, setSelectedDestLoc] = useState<string | null>(null);
  const [selectedDayBucket, setSelectedDayBucket] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'daysToPod' | 'awb' | 'country' | 'destLocCd' | 'podFormatted' | 'commitDateFormatted' | 'sipsFormatted'>('daysToPod');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Toggle accordion expansion for a country
  const toggleCountryExpand = (countryCode: string) => {
    setExpandedCountries(prev => ({
      ...prev,
      [countryCode]: !prev[countryCode]
    }));
  };

  // Expand top 3 countries by default
  React.useEffect(() => {
    if (insightsData.countries.length > 0 && Object.keys(expandedCountries).length === 0) {
      const initial: Record<string, boolean> = {};
      insightsData.countries.slice(0, 3).forEach(c => {
        initial[c.countryCode] = true;
      });
      setExpandedCountries(initial);
    }
  }, [insightsData.countries]);

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
        if (selectedDayBucket === '<0' && r.daysToPod >= 0) return false;
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
    if (days < 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          {days}d
        </span>
      );
    }
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
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Sleek Top Header Bar (No large cards or funnel boxes) */}
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

      {/* Main Two-Column Layout: Country & Dest Loc ID Hierarchy (Left) + AWB Records Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Geographic Hierarchy (Countries & Dest Loc IDs based on AWB counts) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                <MapPin className="w-3.5 h-3.5 text-cyan-500" />
                <span>Countries &amp; Dest Loc IDs</span>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                By AWB count
              </span>
            </div>

            {/* Clear Filter / Show All */}
            {(selectedCountry || selectedDestLoc) && (
              <button
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedDestLoc(null);
                }}
                className="w-full py-1 px-2.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>Clear Destination Filter (Show All)</span>
              </button>
            )}

            {/* Countries & Dest Loc IDs Accordion List */}
            <div className="space-y-1.5 max-h-[680px] overflow-y-auto pr-1 no-scrollbar">
              {insightsData.countries.map(c => {
                const isSelected = selectedCountry === c.countryCode;
                const isExpanded = !!expandedCountries[c.countryCode];

                return (
                  <div 
                    key={c.countryCode} 
                    className={`rounded-lg border transition-all ${
                      isSelected
                        ? 'border-rose-500/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Country Header Row */}
                    <div 
                      onClick={() => {
                        if (selectedCountry === c.countryCode && !selectedDestLoc) {
                          setSelectedCountry(null);
                        } else {
                          setSelectedCountry(c.countryCode);
                          setSelectedDestLoc(null);
                        }
                      }}
                      className="p-2 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCountryExpand(c.countryCode);
                          }}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="w-6 h-4.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-black flex items-center justify-center border border-slate-300 dark:border-slate-600">
                          {c.countryCode}
                        </span>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors">
                          {c.countryCode}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.2 rounded-full text-[11px] font-extrabold ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}>
                          {c.awbCount}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Dest Loc ID List under Country */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2 pt-0.5 space-y-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        {c.destLocs.map(loc => {
                          const isLocSelected = selectedCountry === c.countryCode && selectedDestLoc === loc.locId;
                          const pct = Math.round((loc.awbCount / c.awbCount) * 100);

                          return (
                            <div
                              key={loc.locId}
                              onClick={() => {
                                setSelectedCountry(c.countryCode);
                                setSelectedDestLoc(isLocSelected ? null : loc.locId);
                              }}
                              className={`p-1.5 rounded text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                                isLocSelected
                                  ? 'bg-rose-500 text-white shadow-xs'
                                  : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[11px] font-bold">
                                {loc.locId || 'UNKNOWN'}
                              </span>

                              <div className="flex items-center gap-2">
                                <div className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden hidden sm:block">
                                  <div 
                                    className={`h-full rounded-full ${isLocSelected ? 'bg-white' : 'bg-rose-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-[11px] font-bold ${isLocSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                  {loc.awbCount}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed AWB Records Table */}
        <div className="lg:col-span-8 space-y-2.5">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            
            {/* Filter Pills & Table Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {filteredRecords.length.toLocaleString()} AWBs
                </span>

                {selectedCountry && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    Country: {selectedCountry}
                    <button 
                      onClick={() => { setSelectedCountry(null); setSelectedDestLoc(null); }} 
                      className="hover:text-rose-500 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {selectedDestLoc && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    Loc: {selectedDestLoc}
                    <button 
                      onClick={() => setSelectedDestLoc(null)} 
                      className="hover:text-rose-500 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {selectedDayBucket && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {selectedDayBucket}d
                    <button 
                      onClick={() => setSelectedDayBucket(null)} 
                      className="hover:text-rose-500 ml-1"
                    >
                      &times;
                    </button>
                  </span>
                )}
              </div>

              {/* Table Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search AWB, Country, Loc..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Compact Days to POD Filter Row */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-400 text-[11px] flex items-center gap-1 mr-1">
                <Clock className="w-3 h-3" />
                Days to POD:
              </span>
              <button
                onClick={() => setSelectedDayBucket(null)}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === null
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedDayBucket(selectedDayBucket === '0' ? null : '0')}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === '0'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                }`}
              >
                0d ({insightsData.daysDistribution.sameDay})
              </button>
              <button
                onClick={() => setSelectedDayBucket(selectedDayBucket === '1' ? null : '1')}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === '1'
                    ? 'bg-sky-600 text-white'
                    : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                }`}
              >
                1d ({insightsData.daysDistribution.oneDay})
              </button>
              <button
                onClick={() => setSelectedDayBucket(selectedDayBucket === '2' ? null : '2')}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === '2'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                }`}
              >
                2d ({insightsData.daysDistribution.twoDays})
              </button>
              <button
                onClick={() => setSelectedDayBucket(selectedDayBucket === '3-4' ? null : '3-4')}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === '3-4'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                }`}
              >
                3–4d ({insightsData.daysDistribution.threeToFourDays})
              </button>
              <button
                onClick={() => setSelectedDayBucket(selectedDayBucket === '5+' ? null : '5+')}
                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-all cursor-pointer ${
                  selectedDayBucket === '5+'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                }`}
              >
                5+d ({insightsData.daysDistribution.fivePlusDays})
              </button>
            </div>

            {/* Focused Table Container */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
                    <th 
                      onClick={() => handleSort('awb')} 
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>AWB Number</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('country')} 
                      className="py-2.5 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Country</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('destLocCd')} 
                      className="py-2.5 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Dest Loc</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-2">DEX 01 Scan</th>
                    <th className="py-2.5 px-2">STAT 41 Scan</th>
                    <th 
                      onClick={() => handleSort('sipsFormatted')} 
                      className="py-2.5 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>SIPS</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('commitDateFormatted')} 
                      className="py-2.5 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Commit Time</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('podFormatted')} 
                      className="py-2.5 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>POD Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('daysToPod')} 
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold"
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
                        <td className="py-2 px-3">
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
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded font-black text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                            {r.country}
                          </span>
                        </td>

                        {/* Dest Loc */}
                        <td className="py-2 px-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                            {r.destLocCd}
                          </span>
                        </td>

                        {/* DEX 01 Scan Date */}
                        <td className="py-2 px-2 text-[11px] font-mono whitespace-nowrap">
                          {r.dex01Formatted !== '-' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {r.dex01Formatted}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* STAT 41 Scan Date */}
                        <td className="py-2 px-2 text-[11px] font-mono whitespace-nowrap">
                          {r.stat41Formatted !== '-' ? (
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">
                              {r.stat41Formatted}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* SIPS Date */}
                        <td className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                          {r.sipsFormatted}
                        </td>

                        {/* Commit Time */}
                        <td className="py-2 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                          {r.commitDateFormatted}
                        </td>

                        {/* POD Date */}
                        <td className="py-2 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap font-mono">
                          {r.podFormatted}
                        </td>

                        {/* Days to POD */}
                        <td className="py-2 px-3 whitespace-nowrap bg-rose-500/5">
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
                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
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
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-1.5 font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
