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
  ChevronDown
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
  allDestinations
}) => {
  const [selectedDestination, setSelectedDestination] = useState<string>('US');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([
    'MOTIJHEEL WSC',
    'EPIC GARMENTS MANUFACTURING COMPANY LTD.',
    'M N Enterprise **Agent**'
  ]);

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

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute destination counts from dataset
  const destinationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of rawShipments) {
      if (s.destination) {
        const dest = s.destination.toUpperCase();
        map.set(dest, (map.get(dest) || 0) + 1);
      }
    }
    return map;
  }, [rawShipments]);

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
        labels: {
          color: '#94a3b8',
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
          color: '#94a3b8',
          font: { size: 10, weight: 'bold' as const }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Avg Days', color: '#60a5fa', font: { size: 10 } },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
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
            type="button"
            onClick={handleAutoFillTopCustomers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Top Customers for {selectedDestination}</span>
          </button>
        </div>

        {/* Destination & Customer Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* 1. Target Destination Search Bar */}
          <div className="md:col-span-5 relative z-50" ref={destDropdownRef}>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
              <span>1. Target Destination Country</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedDestination === 'ALL' ? 'Global' : `${(destinationCounts.get(selectedDestination) || 0).toLocaleString()} AWBs`}
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
                className={`w-full pl-9 pr-16 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  selectedDestination && selectedDestination !== 'ALL'
                    ? 'bg-blue-50/70 border-blue-400 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500/60 dark:text-blue-200 placeholder:text-blue-800 dark:placeholder:text-blue-300'
                    : 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:italic placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />
              <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

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
                  className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDestDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>
              </div>

              {/* Destination Dropdown Popup */}
              {isDestDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[9999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/80 p-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectDestination('ALL')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                        selectedDestination === 'ALL'
                          ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold border border-blue-500/40'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedDestination === 'ALL' ? (
                          <Check className="w-4 h-4 text-blue-500 font-bold" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                        )}
                        <span className="font-bold">All Destinations Globally</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {rawShipments.length.toLocaleString()} AWBs
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
                              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25'
                              : 'text-slate-800 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-white font-bold" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            )}
                            <span className="font-mono font-extrabold">{code}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {count.toLocaleString()} AWBs
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Add Customer Search Autocomplete */}
          <div className="md:col-span-7 relative z-50" ref={dropdownRef}>
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
                placeholder="Search Customer"
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
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto z-[9999] rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/80 p-1.5">
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
                  className="p-0.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                    type="button"
                    onClick={() => handleRemoveCustomer(c.customer)}
                    className="text-rose-400 hover:underline cursor-pointer"
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
