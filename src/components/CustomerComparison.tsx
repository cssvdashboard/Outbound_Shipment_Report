import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Globe,
  Plus,
  X,
  Trophy,
  Clock,
  Sparkles,
  BarChart2,
  Check,
  ChevronDown,
  ShieldCheck,
  PackageCheck,
  CreditCard,
  Plane,
  Weight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';
import { Shipment, CustomerComparisonMetric, CategoryTypeFilter } from '../types/logistics';
import { computeCustomerComparison, searchCustomers } from '../utils/analytics';
import { Bar } from 'react-chartjs-2';

interface CustomerComparisonProps {
  shipments: Shipment[];
  rawShipments?: Shipment[];
  allDestinations: string[];
  allCustomers: string[];
  selectedCategoryType?: CategoryTypeFilter;
}

const DEFAULT_COMPARISON_CUSTOMERS = [
  'DEPARTMENT OF IMMIGRATION & PASSPORT',
  'ELITE GARMENTS IND. LTD.',
  'AMBITION EXPRESS INTL **AGENT**',
  'MGX.COM LTD. **AGENT**'
];

export const CustomerComparison: React.FC<CustomerComparisonProps> = ({
  shipments,
  rawShipments,
  allDestinations,
  selectedCategoryType = 'ALL'
}) => {
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>(DEFAULT_COMPARISON_CUSTOMERS);

  // Ranking table sort state
  const [rankSort, setRankSort] = useState<{ field: 'awb' | 'weight'; dir: 'desc' | 'asc' }>({
    field: 'awb',
    dir: 'desc'
  });

  const toggleRankSort = (field: 'awb' | 'weight') => {
    setRankSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };


  // Customer Autocomplete Search State
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Destination Autocomplete Search State
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Auto-Load Top Customers for Country Search & Dropdown State
  const [autoLoadSearch, setAutoLoadSearch] = useState<string>('');
  const [isAutoLoadDropdownOpen, setIsAutoLoadDropdownOpen] = useState<boolean>(false);
  const autoLoadDropdownRef = useRef<HTMLDivElement>(null);
  const autoLoadInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
      if (autoLoadDropdownRef.current && !autoLoadDropdownRef.current.contains(event.target as Node)) {
        setIsAutoLoadDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute destination counts strictly from active filtered dataset (PP / CC / Agent / All)
  const destinationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shipments) {
      if (s.destination) {
        const dest = s.destination.toUpperCase();
        map.set(dest, (map.get(dest) || 0) + 1);
      }
    }
    return map;
  }, [shipments]);

  // Filter destination list based on query
  const filteredDestinations = useMemo(() => {
    if (!destSearch.trim()) return allDestinations;
    const q = destSearch.trim().toUpperCase();
    return allDestinations.filter((code) => code.includes(q));
  }, [allDestinations, destSearch]);

  const handleSelectDestination = (dest: string) => {
    setSelectedDestination(dest);
    setDestSearch('');
    setIsDestDropdownOpen(false);
  };

  // Filter destination list for auto-load search
  const filteredAutoLoadDestinations = useMemo(() => {
    if (!autoLoadSearch.trim()) return allDestinations;
    const q = autoLoadSearch.trim().toUpperCase();
    return allDestinations.filter((code) => code.includes(q));
  }, [allDestinations, autoLoadSearch]);

  // Auto-Load Top Customers handler when a country is selected in Multi-Shipper panel
  const handleAutoLoadForCountry = (countryCode: string) => {
    setSelectedDestination(countryCode);
    setAutoLoadSearch('');
    setIsAutoLoadDropdownOpen(false);

    const destShipments =
      countryCode === 'ALL'
        ? shipments
        : shipments.filter((s) => s.destination === countryCode);
    
    const countMap: Record<string, number> = {};
    for (const s of destShipments) {
      if (s.customer) countMap[s.customer] = (countMap[s.customer] || 0) + 1;
    }

    const top = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name]) => name);

    if (top.length > 0) {
      setSelectedCustomers(top);
    }
  };

  // Auto-initialize or refresh top customers for Multi-Shipper panel
  useEffect(() => {
    const destShipments =
      selectedDestination === 'ALL'
        ? shipments
        : shipments.filter((s) => s.destination === selectedDestination);
    
    const countMap: Record<string, number> = {};
    for (const s of destShipments) {
      if (s.customer) countMap[s.customer] = (countMap[s.customer] || 0) + 1;
    }

    // Check how many of current selected customers have > 0 AWBs in this category
    const activeCount = selectedCustomers.filter((c) => (countMap[c] || 0) > 0).length;

    // If no customers selected or none of the current customers have shipments in this category, load default 4
    if (selectedCustomers.length === 0 || activeCount === 0) {
      const defaultValid = DEFAULT_COMPARISON_CUSTOMERS.filter((c) => (countMap[c] || 0) > 0);
      if (defaultValid.length > 0) {
        setSelectedCustomers(defaultValid);
      } else {
        const top = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name]) => name);

        if (top.length > 0) {
          setSelectedCustomers(top);
        }
      }
    }
  }, [selectedCategoryType, selectedDestination, shipments]);

  // Fast single-pass candidate extraction for top customers by AWB count and Total Weight
  const candidateTopCustomers = useMemo(() => {
    const awbMap = new Map<string, number>();
    const wtMap = new Map<string, number>();

    for (let i = 0; i < shipments.length; i++) {
      const s = shipments[i];
      if (!s.customer) continue;
      awbMap.set(s.customer, (awbMap.get(s.customer) || 0) + 1);
      wtMap.set(s.customer, (wtMap.get(s.customer) || 0) + (s.weight || 0));
    }

    const topByAwb = Array.from(awbMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name]) => name);

    const topByWt = Array.from(wtMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name]) => name);

    return Array.from(new Set([...topByAwb, ...topByWt]));
  }, [shipments]);

  // Compute ranking metrics strictly for candidate top customers (~20-25 customers instead of 1,316)
  const rankingMetrics = useMemo(() => {
    if (candidateTopCustomers.length === 0) return [];
    return computeCustomerComparison(shipments, 'ALL', candidateTopCustomers);
  }, [shipments, candidateTopCustomers]);

  // Filter and rank customers for autocomplete by AWB volume in active category
  const availableCustomerSuggestions = useMemo(() => {
    const rawResults = searchCustomers(shipments, customerSearch, 25);
    return rawResults.filter((item) => !selectedCustomers.includes(item.name));
  }, [shipments, customerSearch, selectedCustomers]);

  // Compute comparison metrics strictly based on active category (PP / CC / Agent / All)
  const comparisonData: CustomerComparisonMetric[] = useMemo(() => {
    if (selectedCustomers.length === 0) return [];
    return computeCustomerComparison(shipments, selectedDestination, selectedCustomers);
  }, [shipments, selectedDestination, selectedCustomers]);

  // Top 10 customer ranking that dynamically changes based on active AWB count / Total Weight sort
  const top10Rank = useMemo(() => {
    return [...rankingMetrics]
      .sort((a, b) => {
        if (rankSort.field === 'awb') {
          return rankSort.dir === 'desc' ? b.awbCount - a.awbCount : a.awbCount - b.awbCount;
        }
        return rankSort.dir === 'desc' ? b.totalWeight - a.totalWeight : a.totalWeight - b.totalWeight;
      })
      .slice(0, 10);
  }, [rankingMetrics, rankSort]);

  const maxAwb = useMemo(() => Math.max(...top10Rank.map((x) => x.awbCount), 1), [top10Rank]);
  const maxWt = useMemo(() => Math.max(...top10Rank.map((x) => x.totalWeight), 1), [top10Rank]);

  // Find best performer (fastest average TT among top 10 customers with > 0 AWBs)
  const fastestCustomer = useMemo(() => {
    const valid = top10Rank.filter((c) => c.awbCount > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => a.avgTT - b.avgTT)[0]?.customer;
  }, [top10Rank]);

  // Find highest volume customer
  const highestVolumeCustomer = useMemo(() => {
    const valid = top10Rank.filter((c) => c.awbCount > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => b.awbCount - a.awbCount)[0]?.customer;
  }, [top10Rank]);

  const handleAddCustomer = (customer: string) => {
    if (!selectedCustomers.includes(customer)) {
      setSelectedCustomers([...selectedCustomers, customer]);
    }
    setCustomerSearch('');
    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter' && availableCustomerSuggestions.length > 0) {
      e.preventDefault();
      handleAddCustomer(availableCustomerSuggestions[0].name);
    }
  };

  const handleRemoveCustomer = (customer: string) => {
    setSelectedCustomers(selectedCustomers.filter((c) => c !== customer));
  };

  // Grouped Bar Chart Data comparing Avg TT and On-time Rate
  const comparisonChartData = {
    labels: comparisonData.map((c) => (c.customer.length > 18 ? c.customer.slice(0, 16) + '...' : c.customer)),
    datasets: [
      {
        label: 'Avg Transit Time (Days)',
        data: comparisonData.map((c) => c.avgTT),
        backgroundColor: 'rgba(56, 189, 248, 0.85)',
        borderColor: '#0284c7',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'On-Time Rate (%)',
        data: comparisonData.map((c) => c.onTimePercentage),
        backgroundColor: 'rgba(52, 211, 153, 0.85)',
        borderColor: '#059669',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y1'
      }
    ]
  };

  const comparisonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#64748b',
          font: { size: 11, weight: 'bold' as const },
          padding: 12
        }
      },
      tooltip: {
        callbacks: {
          afterLabel: function (context: any) {
            const dataIndex = context.dataIndex;
            const item = comparisonData[dataIndex];
            if (!item) return '';
            return `AWBs: ${item.awbCount.toLocaleString()} | Delays: ${item.delayCount}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 10, weight: 'bold' as const }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Avg Days', color: '#0284c7', font: { size: 10, weight: 'bold' as const } },
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#64748b', font: { weight: 'bold' as const } }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: 'On-Time Rate (%)', color: '#059669', font: { size: 10, weight: 'bold' as const } },
        grid: { display: false },
        min: 0,
        max: 100,
        ticks: { color: '#64748b', font: { weight: 'bold' as const } }
      }
    }
  };

  // Helper for Search Input Placeholder based on Category
  const searchPlaceholder = useMemo(() => {
    if (selectedCategoryType === 'AGENT') return 'Search Agent Customer...';
    if (selectedCategoryType === 'PP') return 'Search PP Customer...';
    if (selectedCategoryType === 'CC') return 'Search CC Customer...';
    if (selectedCategoryType === 'IPD') return 'Search IPD Customer...';
    return 'Search Customer...';
  }, [selectedCategoryType]);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* 🏆 1. CUSTOMER RANKING BOX (TOP 10 DYNAMIC) */}
      {top10Rank.length > 0 && (
        <div className="glass-panel rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden relative z-10 shadow-sm">
          {/* Table Header Bar */}
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/25 shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Customer Ranking
            </h3>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-slate-300 dark:border-slate-700">
              <thead className="bg-slate-100/95 dark:bg-slate-900/95 shadow-sm">
                <tr>
                  <th className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 w-14 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">#</th>
                  <th className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">Customer</th>
                  <th
                    className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:text-sky-600 dark:hover:text-sky-400 transition-colors group border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                    onClick={() => toggleRankSort('awb')}
                    title="Click to sort by AWB Count"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      AWB Count
                      {rankSort.field === 'awb' ? (
                        rankSort.dir === 'desc'
                          ? <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
                          : <ArrowUp className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity" />
                      )}
                    </span>
                  </th>
                  <th
                    className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 cursor-pointer select-none hover:text-violet-600 dark:hover:text-violet-400 transition-colors group border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                    onClick={() => toggleRankSort('weight')}
                    title="Click to sort by Total Weight"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      Total Weight (Tons / Kg)
                      {rankSort.field === 'weight' ? (
                        rankSort.dir === 'desc'
                          ? <ArrowDown className="w-3.5 h-3.5 text-violet-500" />
                          : <ArrowUp className="w-3.5 h-3.5 text-violet-500" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity" />
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">Avg TT</th>
                  <th className="px-4 py-2.5 text-center align-middle font-black text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">On-Time</th>
                </tr>
              </thead>
              <tbody>
                {top10Rank.map((c, idx) => {
                  const isFastestRow = c.customer === fastestCustomer && c.awbCount > 0;
                  const isTopVolRow = c.customer === highestVolumeCustomer && c.awbCount > 0;
                  const awbPct = (c.awbCount / maxAwb) * 100;
                  const wtPct = (c.totalWeight / maxWt) * 100;
                  const weightInKg = c.totalWeight;
                  const weightInTons = weightInKg / 1000;

                  return (
                    <tr
                      key={c.customer}
                      className={`transition-colors ${
                        isFastestRow
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Rank badge */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40 shadow-sm'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                            : idx === 2
                            ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Customer Name */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 dark:text-white">{c.customer}</span>
                          {isFastestRow && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                              <Trophy className="w-2.5 h-2.5" /> Fastest
                            </span>
                          )}
                          {isTopVolRow && !isFastestRow && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30">
                              Top Vol
                            </span>
                          )}
                        </div>
                      </td>

                      {/* AWB Count with bar */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-black text-sky-700 dark:text-sky-400 font-mono tabular-nums">
                            {c.awbCount.toLocaleString()}
                          </span>
                          <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-400 dark:bg-sky-500 transition-all duration-500"
                              style={{ width: `${awbPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Total Weight with bar (both Tons & Kg) */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700 font-mono">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <div className="text-violet-700 dark:text-violet-300 text-xs font-black tabular-nums">
                            <strong>{weightInTons.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tons</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tabular-nums">
                            {weightInKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-0.5">
                            <div
                              className="h-full rounded-full bg-violet-400 dark:bg-violet-500 transition-all duration-500"
                              style={{ width: `${wtPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Avg TT */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                          {c.avgTT > 0 ? `${c.avgTT}d` : '-'}
                        </span>
                      </td>

                      {/* On-Time % */}
                      <td className="px-4 py-3 text-center align-middle border border-slate-300 dark:border-slate-700">
                        <span className={`font-bold font-mono ${
                          c.onTimePercentage >= 70
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : c.onTimePercentage >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {c.awbCount > 0 ? `${c.onTimePercentage}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 px-5 py-2.5 bg-slate-50/60 dark:bg-slate-900/60 text-[11px] text-slate-500 dark:text-slate-400 font-semibold border-t border-slate-300 dark:border-slate-700 text-center">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <span>Showing: <strong className="text-slate-800 dark:text-slate-200">Top 10 Customers</strong> (Ranked by {rankSort.field === 'awb' ? 'AWB Count' : 'Total Weight'})</span>
              <span>•</span>
              <span>Top 10 AWBs: <strong className="text-sky-600 dark:text-sky-400">{top10Rank.reduce((acc, curr) => acc + curr.awbCount, 0).toLocaleString()}</strong></span>
              <span>•</span>
              <span>Top 10 Weight: <strong className="text-violet-600 dark:text-violet-400">{(top10Rank.reduce((acc, curr) => acc + curr.totalWeight, 0) / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tons ({(top10Rank.reduce((acc, curr) => acc + curr.totalWeight, 0)).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg)</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* 2. SELECTION & CONFIGURATION PANEL */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 relative z-40 overflow-visible border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
        <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800/80 relative ${isAutoLoadDropdownOpen ? 'z-50' : 'z-20'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  <strong>Multi-Shipper Comparison &amp; Transit Time Benchmark</strong>
                </h2>
                
                {/* Active Category Scope Badge */}
                {selectedCategoryType === 'PP' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40">
                    <PackageCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>PP Shipments Only ({shipments.length.toLocaleString()} AWBs)</span>
                  </span>
                )}
                {selectedCategoryType === 'CC' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                    <CreditCard className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>CC Shipments Only ({shipments.length.toLocaleString()} AWBs)</span>
                  </span>
                )}
                {selectedCategoryType === 'IPD' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                    <Plane className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>IPD Shipments Only ({shipments.length.toLocaleString()} AWBs)</span>
                  </span>
                )}
                {selectedCategoryType === 'AGENT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40">
                    <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span>Agent Customers Only ({shipments.length.toLocaleString()} AWBs)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                Compare delivery speeds, volumes, and delay rates for any destination across {selectedCategoryType === 'ALL' ? 'all' : selectedCategoryType} shipments
              </p>
            </div>
          </div>

          {/* Quick Auto-Load Top Customers for Country Search Bar & Dropdown Combobox */}
          <div className="relative z-50 w-full lg:w-96" ref={autoLoadDropdownRef}>
            <div className="relative">
              <input
                ref={autoLoadInputRef}
                type="text"
                value={autoLoadSearch}
                onChange={(e) => {
                  setAutoLoadSearch(e.target.value);
                  setIsAutoLoadDropdownOpen(true);
                }}
                onFocus={() => setIsAutoLoadDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsAutoLoadDropdownOpen(false);
                  } else if (e.key === 'Enter' && filteredAutoLoadDestinations.length > 0) {
                    e.preventDefault();
                    handleAutoLoadForCountry(filteredAutoLoadDestinations[0]);
                  }
                }}
                placeholder="Select Top Customer for.."
                className="w-full pl-9 pr-14 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-indigo-950/40 border border-slate-300 dark:border-indigo-500/40 text-slate-900 dark:text-indigo-100 placeholder:text-slate-400 dark:placeholder:text-indigo-300/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
              />
              <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {autoLoadSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoLoadSearch('');
                      autoLoadInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:text-indigo-300 dark:hover:text-white transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAutoLoadDropdownOpen(!isAutoLoadDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:text-indigo-300 dark:hover:text-white transition-colors cursor-pointer"
                  title="Toggle country list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAutoLoadDropdownOpen ? 'rotate-180 text-indigo-500 dark:text-indigo-300' : ''}`} />
                </button>
              </div>

              {/* Dropdown Popup */}
              {isAutoLoadDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[99999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-indigo-500/40 shadow-2xl shadow-black/40 dark:shadow-black/90 p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => handleAutoLoadForCountry('ALL')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                        selectedDestination === 'ALL'
                          ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/30'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedDestination === 'ALL' ? (
                          <Check className="w-4 h-4 text-white font-bold" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        <span className="font-bold"><strong>Global (All Destinations)</strong></span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-300">
                        <strong>{shipments.length.toLocaleString()} AWBs</strong>
                      </span>
                    </button>
                  </div>

                  <div className="pt-1 space-y-0.5">
                    {filteredAutoLoadDestinations.map((code) => {
                      const isSelected = selectedDestination === code;
                      const count = destinationCounts.get(code) || 0;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleAutoLoadForCountry(code)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-white font-bold" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0 group-hover:scale-125 transition-transform" />
                            )}
                            <span className="font-mono font-extrabold">{code}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-white/20 text-white font-black'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 group-hover:text-indigo-800 dark:group-hover:text-indigo-200'
                          }`}>
                            <strong>{count.toLocaleString()} AWBs</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Destination & Customer Selectors */}
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 relative ${isAutoLoadDropdownOpen ? 'z-10' : 'z-30'}`}>
          
          {/* 1. Target Destination Search Bar */}
          <div className={`md:col-span-5 relative ${isDestDropdownOpen ? 'z-50' : 'z-20'}`} ref={destDropdownRef}>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center justify-between">
              <span><strong>1. Target Destination Country</strong></span>
              <span className="text-[10px] text-slate-400 font-mono font-bold">
                <strong>{selectedDestination === 'ALL' ? `${shipments.length.toLocaleString()} AWBs` : `${(destinationCounts.get(selectedDestination) || 0).toLocaleString()} AWBs`}</strong>
              </span>
            </label>
            <div className="relative">
              <input
                ref={destInputRef}
                type="text"
                value={destSearch}
                onChange={(e) => {
                  setDestSearch(e.target.value);
                  setIsDestDropdownOpen(true);
                }}
                onFocus={() => setIsDestDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsDestDropdownOpen(false);
                  } else if (e.key === 'Enter' && filteredDestinations.length > 0) {
                    e.preventDefault();
                    handleSelectDestination(filteredDestinations[0]);
                  }
                }}
                placeholder={
                  selectedDestination
                    ? selectedDestination === 'ALL'
                      ? 'Destination: All Countries'
                      : `Destination: ${selectedDestination} (${(destinationCounts.get(selectedDestination) || 0).toLocaleString()} AWBs)`
                    : 'Search Destination'
                }
                className={`w-full pl-9 pr-16 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
                  selectedDestination && selectedDestination !== 'ALL'
                    ? 'bg-sky-50/70 border-sky-400 text-sky-950 dark:bg-sky-950/40 dark:border-sky-500/60 dark:text-sky-200 placeholder:text-sky-800 dark:placeholder:text-sky-300'
                    : 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:italic placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />
              <Globe className="w-4 h-4 text-sky-500 dark:text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

              {/* Clear and Toggle Icons */}
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                {destSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDestSearch('');
                      destInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : selectedDestination !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => handleSelectDestination('ALL')}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Reset to All Destinations"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDestDropdownOpen ? 'rotate-180 text-sky-400' : ''}`} />
                </button>
              </div>

              {/* Destination Dropdown Popup */}
              {isDestDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[99999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/80 p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectDestination('ALL')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                        selectedDestination === 'ALL'
                          ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 font-bold border border-sky-500/40'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedDestination === 'ALL' ? (
                          <Check className="w-4 h-4 text-sky-500 font-bold" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                        )}
                        <span className="font-bold"><strong>All Destinations Globally</strong></span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        <strong>{shipments.length.toLocaleString()} AWBs</strong>
                      </span>
                    </button>
                  </div>

                  <div className="pt-1 space-y-0.5">
                    {filteredDestinations.map((code) => {
                      const isSelected = selectedDestination === code;
                      const count = destinationCounts.get(code) || 0;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleSelectDestination(code)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-sky-600 text-white font-bold shadow-md shadow-sky-500/25'
                              : 'text-slate-800 hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-white font-bold" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                            )}
                            <span className="font-mono font-extrabold">{code}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-white/20 text-white font-black'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold'
                          }`}>
                            <strong>{count.toLocaleString()} AWBs</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Add Customer Search Autocomplete (Strictly filtered to active category: Agent / PP / CC) */}
          <div className={`md:col-span-7 relative ${isDropdownOpen ? 'z-50' : 'z-10'}`} ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>
                <strong>2. Add Customer Accounts to Compare ({selectedCustomers.length} selected)</strong>
                {selectedCategoryType === 'AGENT' && (
                  <span className="ml-1 text-purple-400 text-[10px] font-mono font-extrabold">(Agent Only)</span>
                )}
                {selectedCategoryType === 'PP' && (
                  <span className="ml-1 text-blue-400 text-[10px] font-mono font-extrabold">(PP Only)</span>
                )}
                {selectedCategoryType === 'CC' && (
                  <span className="ml-1 text-amber-400 text-[10px] font-mono font-extrabold">(CC Only)</span>
                )}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Ranked by shipment volume</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-10 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:italic placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner"
              />
              <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

              {customerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearch('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Suggestions dropdown */}
              {isDropdownOpen && availableCustomerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[99999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/80 p-1.5">
                  <div className="space-y-0.5">
                    {availableCustomerSuggestions.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleAddCustomer(item.name)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800/90 rounded-xl flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0 group-hover:scale-125 transition-transform" />
                          <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300 font-extrabold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 font-bold">
                            <strong>{item.count.toLocaleString()} AWBs</strong>
                          </span>
                          <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Selected Customer Chips */}
        {selectedCustomers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold"><strong>Comparing:</strong></span>
            {selectedCustomers.map((cust) => (
              <span
                key={cust}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 shadow-sm"
              >
                <span><strong>{cust}</strong></span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomer(cust)}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>



      {/* 2. SIDE-BY-SIDE BENCHMARK CARDS */}
      {comparisonData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
          {comparisonData.map((c) => {
            const isFastest = c.customer === fastestCustomer && c.awbCount > 0;
            const isHighestVol = c.customer === highestVolumeCustomer && c.awbCount > 0;

            return (
              <div
                key={c.customer}
                className={`glass-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all ${
                  isFastest ? 'border-emerald-400/60 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                }`}
              >
                {/* Highlight badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm line-clamp-2" title={c.customer}>
                    <strong>{c.customer}</strong>
                  </div>
                  {isFastest && (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                      <Trophy className="w-3 h-3" />
                      <strong>Fastest</strong>
                    </span>
                  )}
                  {isHighestVol && !isFastest && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30">
                      <strong>Top Vol</strong>
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {/* Transit Time Metric */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold flex items-center justify-between">
                      <span><strong>Avg Transit Time</strong></span>
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1 flex items-baseline gap-1 font-mono">
                      <span><strong>{c.avgTT > 0 ? c.avgTT : '-'}</strong></span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">days</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-between font-mono font-bold">
                      <span><strong>Min: {c.minTT}d</strong></span>
                      <span><strong>Max: {c.maxTT}d</strong></span>
                    </div>
                  </div>

                  {/* Volume, Weight & On-time Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400 text-[11px] block font-bold"><strong>AWB Volume</strong></span>
                      <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                        <strong>{c.awbCount.toLocaleString()}</strong>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400 text-[11px] block font-bold"><strong>On-Time (≤5d)</strong></span>
                      <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
                        <strong>{c.onTimePercentage}%</strong>
                      </span>
                    </div>

                    <div className="col-span-2 p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 flex items-center justify-between">
                      <span className="text-violet-700 dark:text-violet-400 text-[11px] font-bold flex items-center gap-1">
                        <Weight className="w-3 h-3" />
                        <strong>Total Weight</strong>
                      </span>
                      <span className="text-base font-black text-violet-800 dark:text-violet-300 font-mono">
                        <strong>{c.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</strong>
                      </span>
                    </div>
                  </div>

                  {/* Delay Breakdown Summary */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-bold">
                      <span><strong>Recorded Delays</strong></span>
                      <span className="font-mono text-amber-700 dark:text-amber-400 font-black"><strong>{c.delayCount} AWBs</strong></span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 font-mono font-semibold">
                      <span><strong>Transit:</strong> {c.transitDelays}</span>
                      <span><strong>Clear:</strong> {c.clearanceDelays}</span>
                      <span><strong>Dest:</strong> {c.destinationDelays}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 font-semibold">
                  <span><strong>Destination: {selectedDestination}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomer(c.customer)}
                    className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer font-bold"
                  >
                    <strong>Remove</strong>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center rounded-2xl text-slate-500 dark:text-slate-400 font-semibold">
          Please add at least 1 customer above to view comparative benchmarks.
        </div>
      )}

      {/* 3. VISUAL BENCHMARK CHART */}
      {comparisonData.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl relative z-10 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
              <strong>Comparative Transit Time &amp; On-Time Performance Benchmark</strong>
            </h3>
          </div>
          <div className="h-72 relative">
            <Bar data={comparisonChartData} options={comparisonChartOptions} />
          </div>
        </div>
      )}

    </div>
  );
};
