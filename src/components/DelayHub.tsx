import React, { useState, useMemo } from 'react';
import {
  Plane,
  FileText,
  Truck,
  Calendar,
  Search,
  Filter,
  ArrowRight
} from 'lucide-react';
import { RatioBreakdown, MetricSummary } from '../types/logistics';
import { Bar } from 'react-chartjs-2';

interface DelayHubProps {
  summary: MetricSummary;
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

  const currentList = useMemo(() => {
    let list: RatioBreakdown[] = [];
    if (activeCategory === 'transit') list = transitDelays;
    else if (activeCategory === 'clearance') list = clearanceDelays;
    else list = destinationDelays;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeCategory, transitDelays, clearanceDelays, destinationDelays, searchTerm]);

  // Chart data for top 8 reasons
  const topReasons = currentList.slice(0, 8);
  const barChartData = {
    labels: topReasons.map((r) => r.name.length > 22 ? r.name.slice(0, 20) + '...' : r.name),
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
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.raw.toLocaleString()} AWBs (${topReasons[ctx.dataIndex]?.percentage || 0}%)`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' as const } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' as const } }
      }
    }
  };

  const getActiveFilterList = () => {
    if (activeCategory === 'transit') return activeTransitFilter;
    if (activeCategory === 'clearance') return activeClearanceFilter;
    return activeDestinationFilter;
  };

  const activeFiltersForCategory = getActiveFilterList();

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP DELAY CATEGORY OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Transit Delays */}
        <div
          onClick={() => setActiveCategory('transit')}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all ${
            activeCategory === 'transit'
              ? 'ring-2 ring-indigo-500 bg-indigo-950/40 shadow-glow-indigo'
              : 'hover:border-indigo-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Transit Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.transitDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-indigo-400 font-bold mt-1">
              <strong>{transitDelays.length} Distinct Causes</strong>
            </div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div
          onClick={() => setActiveCategory('clearance')}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all ${
            activeCategory === 'clearance'
              ? 'ring-2 ring-amber-500 bg-amber-950/40 shadow-glow-amber'
              : 'hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Customs Clearance Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.clearanceDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-amber-400 font-bold mt-1">
              <strong>{clearanceDelays.length} Paperwork &amp; Customs Causes</strong>
            </div>
          </div>
        </div>

        {/* Destination Delays */}
        <div
          onClick={() => setActiveCategory('destination')}
          className={`glass-card p-4 rounded-2xl cursor-pointer transition-all ${
            activeCategory === 'destination'
              ? 'ring-2 ring-rose-500 bg-rose-950/40 shadow-glow-rose'
              : 'hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Destination Final-Mile Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.destinationDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-rose-400 font-bold mt-1">
              <strong>{destinationDelays.length} Last-Mile Exception Causes</strong>
            </div>
          </div>
        </div>

        {/* Weekend Impact Delays */}
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              <strong>Weekend Delays</strong>
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white light:text-slate-900">
              <strong>{summary.weekendDelayCount.toLocaleString()}</strong>
              <span className="text-xs font-bold text-slate-400 ml-1.5">AWBs</span>
            </div>
            <div className="text-xs text-cyan-400 font-bold mt-1">
              <strong>Non-working day holds</strong>
            </div>
          </div>
        </div>

      </div>

      {/* 2. CATEGORY BREAKDOWN & CHART INTERFACE */}
      <div className="glass-panel p-5 rounded-2xl space-y-5 border border-slate-800/80">
        
        {/* Header with Category Tabs and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 light:border-slate-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveCategory('transit'); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'transit'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-black'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
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
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
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
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span><strong>Destination Delay Breakdown ({destinationDelays.length})</strong></span>
            </button>
          </div>

          {/* Search inside reasons */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeCategory} reasons...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
        </div>

        {/* Breakdown Grid: Chart on Left, Ranked Reason Table on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Chart View */}
          <div className="lg:col-span-5 glass-card p-4 rounded-xl flex flex-col justify-between border border-slate-800/80">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-slate-300 tracking-wider mb-2">
                <strong>Top Root-Cause Distribution</strong>
              </h3>
              <p className="text-xs text-slate-400 mb-3 font-medium">
                Ranking top delay reasons by total impacted shipments
              </p>
              <div className="h-64 relative">
                {topReasons.length > 0 ? (
                  <Bar data={barChartData} options={barChartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                    No delay data available.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 font-semibold">
              <span><strong>Showing top {topReasons.length} reasons</strong></span>
              <span className="font-mono font-bold text-slate-200">
                <strong>{topReasons.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} AWBs</strong>
              </span>
            </div>
          </div>

          {/* Ranked Table View */}
          <div className="lg:col-span-7 glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-slate-800/80">
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0b0f19] border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center"><strong>#</strong></th>
                    <th className="py-2.5 px-3"><strong>Delay Reason Description</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>AWB Count</strong></th>
                    <th className="py-2.5 px-3 text-right"><strong>Share (%)</strong></th>
                    <th className="py-2.5 px-3 text-center"><strong>Drilldown</strong></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentList.map((item, idx) => {
                    const isFiltered = activeFiltersForCategory.includes(item.name);
                    return (
                      <tr
                        key={item.name}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isFiltered ? 'bg-blue-600/15' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-bold">
                          <strong>{idx + 1}</strong>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          <div className="flex items-center gap-2">
                            <span><strong>{item.name}</strong></span>
                            {isFiltered && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                                <strong>Filter Active</strong>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                          <strong>{item.count.toLocaleString()}</strong>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px] font-bold">
                            <strong>{item.percentage}%</strong>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectDelayFilter(activeCategory, item.name)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isFiltered
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white border border-slate-700'
                            }`}
                          >
                            <Filter className="w-3 h-3" />
                            <span><strong>{isFiltered ? 'Clear' : 'Filter'}</strong></span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between font-medium">
              <span>Click <strong>Filter</strong> next to any delay reason to isolate impacted shipments.</span>
              <span className="font-bold text-slate-300">
                Total for category: <strong>{currentList.reduce((acc, curr) => acc + curr.count, 0).toLocaleString()} AWBs</strong>
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
