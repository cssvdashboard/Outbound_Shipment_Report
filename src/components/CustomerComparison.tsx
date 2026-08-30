import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Globe,
  Plus,
  X,
  Trophy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { Shipment, CustomerComparisonMetric } from '../types/logistics';
import { computeCustomerComparison, searchCustomers } from '../utils/analytics';
import { Bar } from 'react-chartjs-2';

interface CustomerComparisonProps {
  rawShipments: Shipment[];
  allDestinations: string[];
  allCustomers: string[];
}

export const CustomerComparison: React.FC<CustomerComparisonProps> = ({
  rawShipments,
  allDestinations,
  allCustomers
}) => {
  const [selectedDestination, setSelectedDestination] = useState<string>('US');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([
    'MOTIJHEEL WSC',
    'EPIC GARMENTS MANUFACTURING COMPANY LTD.',
    'M N Enterprise **Agent**'
  ]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and rank customers for autocomplete by AWB volume
  const availableCustomerSuggestions = useMemo(() => {
    const rawResults = searchCustomers(rawShipments, customerSearch, 25);
    return rawResults.filter((item) => !selectedCustomers.includes(item.name));
  }, [rawShipments, customerSearch, selectedCustomers]);

  // Compute comparison metrics
  const comparisonData: CustomerComparisonMetric[] = useMemo(() => {
    if (selectedCustomers.length === 0) return [];
    return computeCustomerComparison(rawShipments, selectedDestination, selectedCustomers);
  }, [rawShipments, selectedDestination, selectedCustomers]);

  // Find best performer (fastest average TT among customers with > 0 AWBs)
  const fastestCustomer = useMemo(() => {
    const valid = comparisonData.filter((c) => c.awbCount > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => a.avgTT - b.avgTT)[0]?.customer;
  }, [comparisonData]);

  // Find highest volume customer
  const highestVolumeCustomer = useMemo(() => {
    const valid = comparisonData.filter((c) => c.awbCount > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => b.awbCount - a.awbCount)[0]?.customer;
  }, [comparisonData]);

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

  const handleAutoFillTopCustomers = () => {
    // Find top 4 customers by AWB count for the selected destination
    const destShipments =
      selectedDestination === 'ALL'
        ? rawShipments
        : rawShipments.filter((s) => s.destination === selectedDestination);
    
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

  // Grouped Bar Chart Data comparing Avg TT and On-time Rate
  const comparisonChartData = {
    labels: comparisonData.map((c) => (c.customer.length > 18 ? c.customer.slice(0, 16) + '...' : c.customer)),
    datasets: [
      {
        label: 'Avg Transit Time (Days)',
        data: comparisonData.map((c) => c.avgTT),
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderColor: '#2563eb',
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'On-Time Rate (%)',
        data: comparisonData.map((c) => c.onTimePercentage),
        backgroundColor: 'rgba(16, 185, 129, 0.85)',
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
        labels: { color: '#94a3b8', font: { size: 11, weight: 'bold' as const } }
      },
      tooltip: {
        callbacks: {
          afterLabel: (ctx: any) => {
            const item = comparisonData[ctx.dataIndex];
            return `AWBs: ${item?.awbCount.toLocaleString() || 0}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' as const } }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Average TT (Days)', color: '#60a5fa', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: 'On-Time Rate (%)', color: '#34d399', font: { size: 10 } },
        grid: { display: false },
        min: 0,
        max: 100,
        ticks: { color: '#94a3b8' }
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. SELECTION & CONFIGURATION PANEL */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 relative z-40 overflow-visible">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-slate-800 light:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white light:text-slate-900">
                Multi-Customer Benchmark &amp; Transit Time Comparison Tool
              </h2>
              <p className="text-xs text-slate-400 light:text-slate-500">
                Compare delivery speeds, volumes, and delay rates for any destination
              </p>
            </div>
          </div>

          {/* Quick Auto-Fill Top Customers */}
          <button
            onClick={handleAutoFillTopCustomers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Top Customers for {selectedDestination}</span>
          </button>
        </div>

        {/* Destination & Customer Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Target Destination Dropdown */}
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              1. Target Destination Country
            </label>
            <div className="relative">
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-xs font-bold rounded-xl bg-slate-950/90 border border-slate-700/80 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value="ALL">All Destinations Globally</option>
                {allDestinations.map((dest) => (
                  <option key={dest} value={dest}>
                    Destination: {dest}
                  </option>
                ))}
              </select>
              <Globe className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Add Customer Search Autocomplete */}
          <div className="md:col-span-8 relative z-50" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>2. Add Customer Accounts to Compare ({selectedCustomers.length} selected)</span>
              <span className="text-[10px] text-slate-500">Ranked by shipment volume</span>
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
                placeholder="Search customer account by name or keyword (e.g. 'Epic', 'Motijheel', 'Classic')..."
                className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl bg-slate-950/90 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Users className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

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
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[9999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/80 p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-2 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
                    <span className="font-bold">
                      {customerSearch.trim() ? `Matching Customers for "${customerSearch}"` : 'Top Volume Customers (Click to Compare)'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                      {availableCustomerSuggestions.length} accounts
                    </span>
                  </div>

                  <div className="pt-1 space-y-0.5">
                    {availableCustomerSuggestions.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleAddCustomer(item.name)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800/90 rounded-xl flex items-center justify-between transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0 group-hover:scale-125 transition-transform" />
                          <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300 font-bold">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 font-bold">
                            {item.count.toLocaleString()} AWBs
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
            <span className="text-xs text-slate-500 font-semibold">Comparing:</span>
            {selectedCustomers.map((cust) => (
              <span
                key={cust}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700"
              >
                <span>{cust}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomer(cust)}
                  className="p-0.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
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
                className={`glass-card p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden ${
                  isFastest ? 'border-emerald-500/50 bg-emerald-950/20' : ''
                }`}
              >
                {/* Highlight badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white text-sm line-clamp-2" title={c.customer}>
                    {c.customer}
                  </div>
                  {isFastest && (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Trophy className="w-3 h-3" />
                      Fastest
                    </span>
                  )}
                  {isHighestVol && !isFastest && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      Top Vol
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {/* Transit Time Metric */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                      <span>Avg Transit Time</span>
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-indigo-400 mt-1 flex items-baseline gap-1 font-mono">
                      <span>{c.avgTT > 0 ? c.avgTT : '-'}</span>
                      <span className="text-xs font-normal text-slate-400">days</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                      <span>Min: {c.minTT}d</span>
                      <span>Max: {c.maxTT}d</span>
                    </div>
                  </div>

                  {/* Volume & On-time Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">AWB Volume</span>
                      <span className="text-base font-bold text-white font-mono">
                        {c.awbCount.toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">On-Time (≤5d)</span>
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        {c.onTimePercentage}%
                      </span>
                    </div>
                  </div>

                  {/* Delay Breakdown Summary */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Recorded Delays</span>
                      <span className="font-mono text-amber-400 font-semibold">{c.delayCount} AWBs</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Transit: {c.transitDelays}</span>
                      <span>Clear: {c.clearanceDelays}</span>
                      <span>Dest: {c.destinationDelays}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800">
                  <span>Destination: {selectedDestination}</span>
                  <button
                    onClick={() => handleRemoveCustomer(c.customer)}
                    className="text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center rounded-2xl text-slate-400">
          Please add at least 1 customer above to view comparative benchmarks.
        </div>
      )}

      {/* 3. VISUAL BENCHMARK CHART */}
      {comparisonData.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
              Comparative Transit Time &amp; On-Time Performance Benchmark
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
