import React, { useState, useMemo } from 'react';
import { Shipment, InsightsAWBRecord } from '../types/logistics';
import { calculateInsights } from '../utils/insightsAnalytics';
import * as XLSX from 'xlsx';
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Download, 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  Check, 
  ArrowUpDown, 
  ExternalLink,
  Filter,
  BarChart3,
  Calendar,
  Truck
} from 'lucide-react';

interface InsightsHubProps {
  shipments: Shipment[];
}

export const InsightsHub: React.FC<InsightsHubProps> = ({ shipments }) => {
  // 1. Calculate insights data through 5-order pipeline
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
  const [sortField, setSortField] = useState<'daysToPod' | 'awb' | 'country' | 'destLocCd' | 'podFormatted'>('daysToPod');
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
        const matchesShipper = r.shprName.toLowerCase().includes(query);
        const matchesCustomer = r.customer.toLowerCase().includes(query);
        if (!matchesAwb && !matchesCountry && !matchesLoc && !matchesShipper && !matchesCustomer) {
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
      'Destination Country': r.country,
      'Dest Loc ID': r.destLocCd,
      'Shipper Name': r.shprName,
      'Customer': r.customer,
      'Final Resolution': r.finalResolution,
      'SIPS Date': r.sipsFormatted,
      'Primary Exception': r.primaryExceptionType,
      'Exception Date': r.primaryExceptionDateFormatted,
      'DEX 01 Date': r.dex01Formatted,
      'STAT 41 Date': r.stat41Formatted,
      'Commit Date': r.commitDateFormatted,
      'POD Date': r.podFormatted,
      'Days to POD (Order 5)': r.daysToPod,
      'Exact Days to POD': r.exactDaysToPod,
      'Remarks': r.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Insights_Analysis');
    XLSX.writeFile(wb, `Insights_Exception_to_POD_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Prior ({days}d)
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          Same Day (0d)
        </span>
      );
    }
    if (days === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
          +1 Day
        </span>
      );
    }
    if (days === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
          +2 Days
        </span>
      );
    }
    if (days <= 4) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
          +{days} Days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        +{days} Days
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/20 to-slate-900/40 border border-rose-500/20 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Insights — Exception-to-POD Analysis
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
              Orders 1–5 Filter Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
            Locates countries and destination location IDs (<code className="text-rose-500 font-mono">Dest Loc Cd</code>) based on AWB counts, tracking delivered shipments completed on or before commit date with exception scans (<code className="text-rose-400 font-mono">DEX 01 / STAT 41</code>) on or after SIPS date.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            title="Download full Insights table as Excel spreadsheet"
          >
            <Download className="w-4 h-4" />
            <span>Export Insights (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Insights AWBs */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Qualifying AWBs</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {insightsData.totalInsightsAWBs.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="font-semibold text-rose-500">
              {((insightsData.totalInsightsAWBs / (insightsData.funnel.step1_delivered || 1)) * 100).toFixed(1)}%
            </span>
            <span>of all delivered shipments</span>
          </div>
        </div>

        {/* Metric 2: Impacted Countries */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Impacted Countries</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <MapPin className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {insightsData.impactedCountriesCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across international destinations
          </div>
        </div>

        {/* Metric 3: Impacted Dest Loc IDs */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-violet-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Dest Loc IDs</span>
            <span className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {insightsData.impactedDestLocCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ranked by total AWB volume
          </div>
        </div>

        {/* Metric 4: Average Days to POD */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Days to POD</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-baseline gap-1.5">
            <span>{insightsData.overallAvgDaysToPod}</span>
            <span className="text-sm font-semibold text-slate-500">days</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            From DEX 01 / STAT 41 to delivery
          </div>
        </div>
      </div>

      {/* 3. 5-Stage Order Funnel Visualizer */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              5-Stage Criteria Order Execution Flow
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Executed in strict sequential order
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Order 1 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 uppercase">
                  Order 1
                </span>
                <Check className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Final Resolution
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Only &quot;Delivered&quot;
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-base font-black text-blue-600 dark:text-blue-400">
              {insightsData.funnel.step1_delivered.toLocaleString()}
            </div>
          </div>

          {/* Order 2 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 uppercase">
                  Order 2
                </span>
                <Check className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                POD &le; Commit Date
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Delivery not exceeding commit
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-base font-black text-indigo-600 dark:text-indigo-400">
              {insightsData.funnel.step2_podWithinCommit.toLocaleString()}
            </div>
          </div>

          {/* Order 3 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 uppercase">
                  Order 3
                </span>
                <Check className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                DEX 01 / STAT 41
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Has exception timestamp
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-base font-black text-purple-600 dark:text-purple-400">
              {insightsData.funnel.step3_hasDexOrStat.toLocaleString()}
            </div>
          </div>

          {/* Order 4 */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 uppercase">
                  Order 4
                </span>
                <Check className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Exception &ge; SIPS
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Same or later date (date only)
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-base font-black text-rose-600 dark:text-rose-400">
              {insightsData.funnel.step4_dexStatGteSips.toLocaleString()}
            </div>
          </div>

          {/* Order 5 */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-2 border-rose-500/40 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500 text-white uppercase shadow-sm">
                  Order 5
                </span>
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                Days to POD
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Days from DEX/STAT to POD
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-rose-500/20 text-base font-black text-rose-600 dark:text-rose-400">
              {insightsData.overallAvgDaysToPod}d avg
            </div>
          </div>
        </div>
      </div>

      {/* 4. Days to POD Quick Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
          <Clock className="w-3.5 h-3.5" />
          Filter by Days to POD:
        </span>

        <button
          onClick={() => setSelectedDayBucket(null)}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === null
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          All ({insightsData.totalInsightsAWBs})
        </button>

        <button
          onClick={() => setSelectedDayBucket(selectedDayBucket === '0' ? null : '0')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === '0'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
          }`}
        >
          Same Day / 0d ({insightsData.daysDistribution.sameDay})
        </button>

        <button
          onClick={() => setSelectedDayBucket(selectedDayBucket === '1' ? null : '1')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === '1'
              ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500/30'
              : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30'
          }`}
        >
          1 Day ({insightsData.daysDistribution.oneDay})
        </button>

        <button
          onClick={() => setSelectedDayBucket(selectedDayBucket === '2' ? null : '2')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === '2'
              ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
              : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
          }`}
        >
          2 Days ({insightsData.daysDistribution.twoDays})
        </button>

        <button
          onClick={() => setSelectedDayBucket(selectedDayBucket === '3-4' ? null : '3-4')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === '3-4'
              ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/30'
              : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
          }`}
        >
          3–4 Days ({insightsData.daysDistribution.threeToFourDays})
        </button>

        <button
          onClick={() => setSelectedDayBucket(selectedDayBucket === '5+' ? null : '5+')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
            selectedDayBucket === '5+'
              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
          }`}
        >
          5+ Days ({insightsData.daysDistribution.fivePlusDays})
        </button>

        {insightsData.daysDistribution.negativeDays > 0 && (
          <button
            onClick={() => setSelectedDayBucket(selectedDayBucket === '<0' ? null : '<0')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              selectedDayBucket === '<0'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            }`}
            title="POD timestamp recorded prior to DEX/STAT timestamp"
          >
            Prior Scans ({insightsData.daysDistribution.negativeDays})
          </button>
        )}
      </div>

      {/* 5. Master-Detail Interactive Explorer: Countries & Dest Locs (Left) + AWB Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Geographic Hierarchy (Countries & Dest Loc IDs) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Destinations &amp; Dest Loc IDs
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Sorted by AWB count
              </span>
            </div>

            {/* Clear selection / View All Button */}
            {(selectedCountry || selectedDestLoc) && (
              <button
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedDestLoc(null);
                }}
                className="w-full py-1.5 px-3 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Reset Destination Filter (Show All)</span>
              </button>
            )}

            {/* Countries & Dest Loc IDs Tree/Accordion List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1 no-scrollbar">
              {insightsData.countries.map(c => {
                const isSelected = selectedCountry === c.countryCode;
                const isExpanded = !!expandedCountries[c.countryCode];

                return (
                  <div 
                    key={c.countryCode} 
                    className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'border-rose-500/60 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
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
                      className="p-2.5 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCountryExpand(c.countryCode);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="w-7 h-5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-black flex items-center justify-center border border-slate-300 dark:border-slate-600">
                          {c.countryCode}
                        </span>
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-rose-500 transition-colors">
                          {c.countryCode}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {c.avgDaysToPod}d avg
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isSelected
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}>
                          {c.awbCount}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Dest Loc ID List under Country */}
                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                          Dest Loc IDs ({c.destLocs.length}):
                        </div>
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
                              className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                                isLocSelected
                                  ? 'bg-rose-500 text-white shadow-sm'
                                  : 'bg-white/80 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold">
                                  {loc.locId || 'UNKNOWN'}
                                </span>
                                <span className={`text-[10px] ${isLocSelected ? 'text-rose-100' : 'text-slate-400'}`}>
                                  ({loc.avgDaysToPod}d avg)
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Visual progress bar */}
                                <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden hidden sm:block">
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
        <div className="lg:col-span-8 space-y-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            {/* Table Search & Scope Summary Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  AWB Records
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  {filteredRecords.length.toLocaleString()} matching
                </span>

                {selectedCountry && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Bucket: {selectedDayBucket}d
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
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search AWB, Shipper, City..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
                    <th 
                      onClick={() => handleSort('awb')} 
                      className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>AWB Number</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('country')} 
                      className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Country</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('destLocCd')} 
                      className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Dest Loc ID</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-3">Shipper / Customer</th>
                    <th className="py-3 px-2">SIPS Date</th>
                    <th className="py-3 px-2">DEX 01 / STAT 41 Date</th>
                    <th className="py-3 px-2">Commit Date</th>
                    <th 
                      onClick={() => handleSort('podFormatted')} 
                      className="py-3 px-2 cursor-pointer hover:text-slate-950 dark:hover:text-white"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>POD Date</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('daysToPod')} 
                      className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    >
                      <div className="flex items-center gap-1.5 font-extrabold">
                        <span>Days to POD (Order 5)</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
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
                          <span className="px-2 py-0.5 rounded font-black text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                            {r.country}
                          </span>
                        </td>

                        {/* Dest Loc ID */}
                        <td className="py-2.5 px-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                            {r.destLocCd}
                          </span>
                        </td>

                        {/* Shipper / Customer */}
                        <td className="py-2.5 px-3 max-w-[170px] truncate" title={`${r.shprName} / ${r.customer}`}>
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {r.shprName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {r.customer}
                          </div>
                        </td>

                        {/* SIPS Date */}
                        <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                          {r.sipsFormatted}
                        </td>

                        {/* Exception Date (DEX 01 / STAT 41) */}
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              r.primaryExceptionType === 'DEX 01'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>
                              {r.primaryExceptionType}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {r.primaryExceptionDateFormatted}
                            </span>
                          </div>
                        </td>

                        {/* Commit Date */}
                        <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                          {r.commitDateFormatted}
                        </td>

                        {/* POD Date */}
                        <td className="py-2.5 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap font-mono">
                          {r.podFormatted}
                        </td>

                        {/* Order 5: Days to POD */}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
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
                <span className="ml-2">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
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

      </div>
    </div>
  );
};
