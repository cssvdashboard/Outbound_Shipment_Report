import React, { useState, useMemo } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Plane,
  FileText,
  Truck,
  X,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Layers,
  Sparkles
} from 'lucide-react';
import { MetricSummary, RatioBreakdown, Shipment } from '../types/logistics';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface ExecutiveOverviewProps {
  summary: MetricSummary;
  deliveryTimeline: RatioBreakdown[];
  finalResolutions: RatioBreakdown[];
  filteredShipments: Shipment[];
  rawShipments: Shipment[];
  selectedFinalResolution: string | null;
  selectedTTRange: string | null;
  onSelectResolution: (resolution: string) => void;
  onSelectTTRange: (range: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  summary,
  deliveryTimeline,
  finalResolutions,
  filteredShipments,
  selectedTTRange,
  onSelectTTRange,
  onNavigateTab
}) => {
  // Modal state for Final Resolution Popup
  const [modalResolution, setModalResolution] = useState<string | null>(null);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalPageSize, setModalPageSize] = useState<number>(25);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [inspectedShipment, setInspectedShipment] = useState<Shipment | null>(null);

  // Donut chart config for Delivery Timeline
  const timelineChartData = {
    labels: deliveryTimeline.map((d) => `${d.name} (${d.percentage}%)`),
    datasets: [
      {
        data: deliveryTimeline.map((d) => d.count),
        backgroundColor: ['#10b981', '#f59e0b'],
        borderColor: ['#047857', '#d97706'],
        borderWidth: 2,
        hoverOffset: 8
      }
    ]
  };

  const timelineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const val = context.raw || 0;
            const total = summary.totalCount;
            const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
            return ` ${val.toLocaleString()} AWBs (${pct}%)`;
          }
        }
      }
    },
    cutout: '72%'
  };

  const totalDelays = summary.transitDelayCount + summary.clearanceDelayCount + summary.destinationDelayCount;
  const delayRate = summary.totalCount > 0 ? ((totalDelays / summary.totalCount) * 100).toFixed(2) : '0';

  // Filter shipments for the active popup modal resolution based on current active filters
  const modalAllShipments = useMemo(() => {
    if (!modalResolution) return [];
    return filteredShipments.filter((s) => s.finalResolution === modalResolution);
  }, [modalResolution, filteredShipments]);

  // Close modal on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectedShipment) {
          setInspectedShipment(null);
        } else if (modalResolution) {
          setModalResolution(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalResolution, inspectedShipment]);
  const modalFilteredShipments = useMemo(() => {
    if (!modalSearch.trim()) return modalAllShipments;
    const q = modalSearch.toLowerCase().trim();
    return modalAllShipments.filter((s) => {
      return (
        s.awb.toLowerCase().includes(q) ||
        s.shprName.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q) ||
        (s.recipient && s.recipient.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.remarks && s.remarks.toLowerCase().includes(q)) ||
        (s.clearanceDelay && s.clearanceDelay.toLowerCase().includes(q)) ||
        (s.transitDelay && s.transitDelay.toLowerCase().includes(q)) ||
        (s.destinationDelay && s.destinationDelay.toLowerCase().includes(q))
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
    let sumTT = 0;
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let totalWeight = 0;
    let totalPkgs = 0;
    const countryCounts: Record<string, number> = {};

    for (const s of modalAllShipments) {
      sumTT += s.tt;
      if (s.tt > 0 && s.tt < minTT) minTT = s.tt;
      if (s.tt > maxTT) maxTT = s.tt;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
      if (s.destination) countryCounts[s.destination] = (countryCounts[s.destination] || 0) + 1;
    }

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c, count]) => `${c} (${count})`)
      .join(', ');

    return {
      avgTT: (sumTT / modalAllShipments.length).toFixed(2),
      minTT: minTT === Number.MAX_VALUE ? 0 : minTT.toFixed(2),
      maxTT: maxTT.toFixed(2),
      totalWeight: Math.round(totalWeight),
      totalPkgs,
      topCountries: topCountries || 'N/A'
    };
  }, [modalAllShipments]);

  // Modal Export Handlers
  const handleExportModalExcel = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Resolution_${modalResolution}`);
    XLSX.writeFile(workbook, `Resolution_${modalResolution}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportModalCSV = () => {
    if (modalFilteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(modalFilteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Resolution_${modalResolution}`);
    XLSX.writeFile(workbook, `Resolution_${modalResolution}_${new Date().toISOString().slice(0, 10)}.csv`, {
      bookType: 'csv'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. TOP EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total AWB Volume */}
        <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-sky-500/10 blur-xl group-hover:bg-sky-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">
              <strong>Total Shipments</strong>
            </span>
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white light:text-slate-900 tracking-tight">
              <strong>{summary.totalCount.toLocaleString()}</strong>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 light:text-slate-500 font-semibold">
              <span><strong>{summary.totalWeight.toLocaleString()}</strong> kg</span>
              <span>•</span>
              <span><strong>{summary.totalPkgs.toLocaleString()}</strong> pkgs</span>
            </div>
          </div>
        </div>

        {/* Transit Time Performance */}
        <div className="glass-card p-4 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">
              <strong>Average Transit Time</strong>
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight flex items-baseline gap-1">
              <span><strong>{summary.avgTT}</strong></span>
              <span className="text-sm font-bold text-slate-400">days</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 light:text-slate-500 font-semibold">
              <span className="text-emerald-400 font-mono"><strong>Min: {summary.minTT}d</strong></span>
              <span>•</span>
              <span className="text-amber-400 font-mono"><strong>Max: {summary.maxTT}d</strong></span>
            </div>
          </div>
        </div>

        {/* Delivery Timeline (Within 4-5 Days) */}
        <div
          onClick={() => onSelectTTRange('Within 4-5 Days')}
          className={`glass-card p-4 rounded-2xl relative overflow-hidden group cursor-pointer transition-all ${
            selectedTTRange === 'Within 4-5 Days'
              ? 'ring-2 ring-emerald-500 bg-emerald-950/40 shadow-glow-emerald'
              : 'hover:border-emerald-500/50'
          }`}
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">
              <strong>On-Time Rate (≤ 5 Days)</strong>
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight flex items-baseline gap-1">
              <span><strong>{summary.onTimePercentage}%</strong></span>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400 light:text-slate-500 font-semibold">
              <span><strong>{summary.onTimeCount.toLocaleString()}</strong> AWBs</span>
              <span className="text-[10px] text-emerald-400 font-bold underline">
                <strong>{selectedTTRange === 'Within 4-5 Days' ? 'Active Filter' : 'Click to Filter'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Delay Bottlenecks */}
        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-amber-500/50 transition-all"
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 light:text-slate-500 uppercase tracking-wider">
              <strong>Recorded Delay Cases</strong>
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight flex items-baseline gap-1">
              <span><strong>{totalDelays.toLocaleString()}</strong></span>
              <span className="text-xs font-bold text-slate-400 font-mono">({delayRate}%)</span>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400 light:text-slate-500 font-semibold">
              <span><strong>Transit:</strong> {summary.transitDelayCount}</span>
              <span><strong>Clear:</strong> {summary.clearanceDelayCount}</span>
              <span><strong>Dest:</strong> {summary.destinationDelayCount}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 2. DELIVERY TIMELINE & FINAL RESOLUTION SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* REQUIREMENT 2: Delivery Timeline Breakdown */}
        <div className="lg:col-span-5 glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 light:border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-sm font-bold text-white light:text-slate-900">
                  Delivery Timeline Distribution
                </h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                Click cards below to filter
              </span>
            </div>

            {/* Donut Chart Container */}
            <div className="h-56 my-3 relative flex items-center justify-center">
              <Doughnut data={timelineChartData} options={timelineChartOptions} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none select-none text-center">
                <span className="text-xs text-slate-400 light:text-slate-500 font-bold uppercase tracking-wider">
                  <strong>On-Time</strong>
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight leading-tight">
                  <strong>{summary.onTimePercentage}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Metric Detail Cards */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 light:border-slate-200">
            <button
              type="button"
              onClick={() => onSelectTTRange('Within 4-5 Days')}
              className={`p-3 rounded-xl text-left transition-all ${
                selectedTTRange === 'Within 4-5 Days'
                  ? 'bg-emerald-500/25 border-2 border-emerald-400 shadow-glow-emerald'
                  : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
                <span>Within 4–5 Days</span>
                <span>{summary.onTimePercentage}%</span>
              </div>
              <div className="text-lg font-bold text-white light:text-slate-900">
                {summary.onTimeCount.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">AWBs</span>
              </div>
              <div className="w-full bg-emerald-950/60 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${summary.onTimePercentage}%` }}
                />
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-1.5 font-medium">
                {selectedTTRange === 'Within 4-5 Days' ? '✓ Filter Applied (Click to reset)' : 'Click to filter on-time'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTTRange('More Than 5 Days')}
              className={`p-3 rounded-xl text-left transition-all ${
                selectedTTRange === 'More Than 5 Days'
                  ? 'bg-amber-500/25 border-2 border-amber-400 shadow-glow-amber'
                  : 'bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
                <span>&gt; 5 Working Days</span>
                <span>{summary.delayedTimelinePercentage}%</span>
              </div>
              <div className="text-lg font-bold text-white light:text-slate-900">
                {summary.delayedTimelineCount.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">AWBs</span>
              </div>
              <div className="w-full bg-amber-950/60 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${summary.delayedTimelinePercentage}%` }}
                />
              </div>
              <div className="text-[10px] text-amber-400/80 mt-1.5 font-medium">
                {selectedTTRange === 'More Than 5 Days' ? '✓ Filter Applied (Click to reset)' : 'Click to filter delayed'}
              </div>
            </button>
          </div>
        </div>

        {/* REQUIREMENT 3: Final Resolution Breakdown (CLICK TO OPEN POPUP MODAL) */}
        <div className="lg:col-span-7 glass-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 light:border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white light:text-slate-900">
                  Final Resolution &amp; Outcome Status
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Click any card to open detailed popup
                </span>
              </div>
            </div>

            {/* Visual Status Progress Multi-Bar */}
            <div className="my-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold text-slate-300 light:text-slate-700">Delivery Success vs Exceptions</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {finalResolutions.find(r => r.name.toLowerCase() === 'delivered')?.percentage || 0}% Delivered
                </span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
                {finalResolutions.map((res) => (
                  <div
                    key={res.name}
                    className="h-full transition-all duration-500 cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setModalResolution(res.name);
                      setModalSearch('');
                      setModalCurrentPage(1);
                    }}
                    style={{
                      width: `${Math.max(res.percentage, res.count > 0 ? 0.8 : 0)}%`,
                      backgroundColor: res.color
                    }}
                    title={`Click to open popup: ${res.name} (${res.count} AWBs / ${res.percentage}%)`}
                  />
                ))}
              </div>
            </div>

            {/* Resolution Cards Grid - Interactive Clickable Cards (Opens Popup Modal) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {finalResolutions.map((res) => {
                const isNegative = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(res.name.toLowerCase().trim());
                const isSuccess = res.name.toLowerCase().trim() === 'delivered';

                return (
                  <button
                    key={res.name}
                    type="button"
                    onClick={() => {
                      setModalResolution(res.name);
                      setModalSearch('');
                      setModalCurrentPage(1);
                    }}
                    className={`p-3 rounded-2xl text-left transition-all relative overflow-hidden group border ${
                      isNegative
                        ? 'bg-gradient-to-br from-rose-950/40 via-red-950/20 to-slate-900/90 border-rose-900/60 hover:border-rose-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:scale-[1.02] active:scale-[0.98]'
                        : isSuccess
                        ? 'bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-900 border-emerald-900/50 hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-slate-900/80 border-slate-800 hover:border-blue-500/60 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isNegative ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse flex-shrink-0" />
                        ) : isSuccess ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] flex-shrink-0" />
                        ) : (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: res.color }}
                          />
                        )}
                        <span className={`text-xs font-bold truncate ${
                          isNegative 
                            ? 'text-rose-200 group-hover:text-rose-100 font-extrabold' 
                            : isSuccess 
                            ? 'text-emerald-200 group-hover:text-emerald-100' 
                            : 'text-slate-200 group-hover:text-blue-300'
                        }`}>
                          {res.name}
                        </span>
                      </div>
                      {isNegative && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Negative
                        </span>
                      )}
                      {isSuccess && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Success
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between">
                      <span className={`text-lg font-black font-mono tracking-tight ${
                        isNegative ? 'text-rose-400 group-hover:text-rose-300' : isSuccess ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-white'
                      }`}>
                        {res.count.toLocaleString()}
                      </span>
                      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isNegative 
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-900/50' 
                          : isSuccess 
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-900/50' 
                          : 'text-slate-400 bg-slate-800/80 border border-slate-700/50'
                      }`}>
                        {res.percentage}%
                      </span>
                    </div>

                    <div className={`mt-1.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${
                      isNegative ? 'text-rose-400' : isSuccess ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {isNegative ? (
                        <><AlertTriangle className="w-3 h-3 text-rose-400" /> Negative outlier • View popup →</>
                      ) : isSuccess ? (
                        <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Delivered • View popup →</>
                      ) : (
                        <><Eye className="w-3 h-3" /> Click to view details →</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Hub Navigation Link */}
          <div className="mt-4 pt-3 border-t border-slate-800 light:border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-400">Click any resolution card above to open full shipment details popup.</span>
            <button
              onClick={() => onNavigateTab('delays')}
              className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 hover:underline"
            >
              Open Delay Hub <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 3. FULL-FEATURED POPUP MODAL FOR FINAL RESOLUTION EXPLORER */}
      {modalResolution && (() => {
        const isModalNegative = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(modalResolution.toLowerCase().trim());
        const isModalSuccess = modalResolution.toLowerCase().trim() === 'delivered';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className={`glass-panel w-full max-w-5xl max-h-[90vh] p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden bg-slate-950/95 border ${
              isModalNegative 
                ? 'border-rose-500/50 shadow-[0_0_40px_rgba(239,68,68,0.25)]' 
                : isModalSuccess 
                ? 'border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]' 
                : 'border-blue-500/40'
            }`}>
              
              {/* Modal Header */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isModalNegative
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        : isModalSuccess
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}>
                      {isModalNegative ? (
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-bold text-white">
                          Final Resolution:{' '}
                          <span className={`font-black ${
                            isModalNegative ? 'text-rose-400' : isModalSuccess ? 'text-emerald-400' : 'text-blue-400'
                          }`}>
                            {modalResolution}
                          </span>
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                          isModalNegative
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : isModalSuccess
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {modalAllShipments.length.toLocaleString()} Total AWBs
                        </span>
                        {isModalNegative && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-950 text-rose-400 border border-rose-700">
                            Negative Exception
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isModalNegative 
                          ? `Detailed negative exception logs & outlier shipment records for status: "${modalResolution}"`
                          : `Filtered shipment records from Shipment Explorer for status: "${modalResolution}"`
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalResolution(null)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

              {/* Quick Metrics Strip */}
              {modalStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Transit Time</span>
                    <span className="text-sm sm:text-base font-extrabold text-indigo-400 font-mono">
                      {modalStats.avgTT} <span className="text-xs font-normal text-slate-400">days</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      Min: {modalStats.minTT}d • Max: {modalStats.maxTT}d
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Volume &amp; Wt</span>
                    <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                      {modalAllShipments.length.toLocaleString()} AWBs
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {modalStats.totalWeight.toLocaleString()} kg • {modalStats.totalPkgs.toLocaleString()} pkgs
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Top Impacted Countries</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-400 mt-0.5 block truncate">
                      {modalStats.topCountries}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Sorted by shipment concentration
                    </span>
                  </div>
                </div>
              )}

              {/* Search & Export Toolbar inside Modal */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setModalCurrentPage(1);
                    }}
                    placeholder={`Search within ${modalResolution} (AWB, Shipper, Customer, Destination, Remarks)...`}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportModalExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold border border-emerald-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel</span>
                  </button>

                  <button
                    onClick={handleExportModalCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold border border-blue-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Table Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 max-h-[48vh] my-1">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3">AWB Tracking #</th>
                    <th className="py-2.5 px-2.5">Dest</th>
                    <th className="py-2.5 px-3">Customer Account</th>
                    <th className="py-2.5 px-3">Shipper Name</th>
                    <th className="py-2.5 px-3">Recipient / City</th>
                    <th className="py-2.5 px-2.5 text-right">TT (Days)</th>
                    <th className="py-2.5 px-2.5">Timeline</th>
                    <th className="py-2.5 px-3">Logged Delays &amp; Remarks</th>
                    <th className="py-2.5 px-2 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {modalPaginatedData.map((s, idx) => (
                    <tr key={`${s.awb}-${idx}`} className="hover:bg-slate-800/40 text-slate-200 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-blue-400">{s.awb}</td>
                      <td className="py-2 px-2.5 font-bold text-white font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                          {s.destination}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-300 max-w-[150px] truncate" title={s.customer}>
                        {s.customer}
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-[150px] truncate" title={s.shprName}>
                        {s.shprName}
                      </td>
                      <td className="py-2 px-3 text-slate-400 max-w-[130px] truncate">
                        <div>{s.recipient || '-'}</div>
                        <div className="text-[10px] text-slate-500">{s.city}</div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-indigo-400">
                        {s.tt} d
                      </td>
                      <td className="py-2 px-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            s.tt <= 5
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {s.tt <= 5 ? '≤5d' : '>5d'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] max-w-[160px] truncate">
                        {s.remarks && s.remarks !== '-' ? (
                          <span className="text-amber-300 font-semibold" title={s.remarks}>
                            {s.remarks}
                          </span>
                        ) : s.clearanceDelay && s.clearanceDelay !== '-' ? (
                          <span className="text-amber-400" title={s.clearanceDelay}>
                            📋 {s.clearanceDelay}
                          </span>
                        ) : s.transitDelay && s.transitDelay !== '-' ? (
                          <span className="text-indigo-400" title={s.transitDelay}>
                            ✈️ {s.transitDelay}
                          </span>
                        ) : s.destinationDelay && s.destinationDelay !== '-' ? (
                          <span className="text-rose-400" title={s.destinationDelay}>
                            🚚 {s.destinationDelay}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => setInspectedShipment(s)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white"
                          title="Inspect full details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {modalPaginatedData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No shipment records match &quot;{modalSearch}&quot; for status {modalResolution}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Pagination Footer */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Rows:</span>
                <select
                  value={modalPageSize}
                  onChange={(e) => {
                    setModalPageSize(Number(e.target.value));
                    setModalCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  Showing{' '}
                  <strong className="text-white">
                    {modalFilteredShipments.length > 0 ? (modalValidCurrentPage - 1) * modalPageSize + 1 : 0}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-white">
                    {Math.min(modalValidCurrentPage * modalPageSize, modalFilteredShipments.length)}
                  </strong>{' '}
                  of <strong className="text-white">{modalFilteredShipments.length}</strong> records
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={modalValidCurrentPage <= 1}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs">
                  Page {modalValidCurrentPage} of {modalTotalPages}
                </span>
                <button
                  onClick={() => setModalCurrentPage((p) => Math.min(p + 1, modalTotalPages))}
                  disabled={modalValidCurrentPage >= modalTotalPages}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setModalResolution(null)}
                  className="ml-3 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )})()}

      {/* Single Shipment Detail Sub-Modal */}
      {inspectedShipment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl relative bg-slate-950 border border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">AWB #{inspectedShipment.awb}</h3>
                  <p className="text-xs text-slate-400">MAWB: {inspectedShipment.mawb || 'N/A'}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedShipment(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Customer</span>
                <span className="font-bold text-white block mt-0.5">{inspectedShipment.customer}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Shipper</span>
                <span className="font-bold text-white block mt-0.5">{inspectedShipment.shprName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Destination / Recipient</span>
                <span className="font-bold text-white block mt-0.5">
                  {inspectedShipment.destination} ({inspectedShipment.city || 'N/A'})
                </span>
                <span className="text-slate-400 text-[11px] block">{inspectedShipment.recipient}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Transit Time (TT)</span>
                <span className="font-bold text-indigo-400 text-base font-mono block mt-0.5">
                  {inspectedShipment.tt} days
                </span>
                <span className="text-slate-400 text-[11px]">{inspectedShipment.ttRange}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Final Resolution</span>
                <span className={`font-bold block mt-0.5 ${
                  inspectedShipment.finalResolution === 'Delivered'
                    ? 'text-emerald-400'
                    : ['RTS', 'Lost', 'Destroyed', 'Seized', 'Undelivered'].includes(inspectedShipment.finalResolution)
                    ? 'text-rose-400 font-extrabold'
                    : 'text-amber-400'
                }`}>
                  {inspectedShipment.finalResolution}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Pkg &amp; Weight</span>
                <span className="font-bold text-white block mt-0.5">
                  {inspectedShipment.weight} kg • {inspectedShipment.pkgCount} pcs
                </span>
              </div>
            </div>

            {inspectedShipment.description && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <span className="text-slate-500 block text-[10px]">Description</span>
                <p className="text-slate-300 mt-0.5">{inspectedShipment.description}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedShipment(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. QUICK OPERATIONAL SUMMARY HIGHLIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition-all flex items-center gap-3.5"
        >
          <div className="p-3 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Transit Delay Incidents</div>
            <div className="text-xl font-bold text-white light:text-slate-900 mt-0.5">
              {summary.transitDelayCount.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">AWBs</span>
            </div>
            <span className="text-[11px] text-indigo-400 font-medium">CDG, US, Gateway bottlenecks →</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('delays')}
          className="glass-card p-4 rounded-2xl cursor-pointer hover:border-amber-500/50 transition-all flex items-center gap-3.5"
        >
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Customs Clearance Delays</div>
            <div className="text-xl font-bold text-white light:text-slate-900 mt-0.5">
              {summary.clearanceDelayCount.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400">AWBs</span>
            </div>
            <span className="text-[11px] text-amber-400 font-medium">Invoices, KYC, Inspections →</span>
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('country')}
          className="glass-card p-4 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all flex items-center gap-3.5"
        >
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Destination Delivery Matrix</div>
            <div className="text-xl font-bold text-white light:text-slate-900 mt-0.5">
              Country Performance
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">View dynamic TT per Country →</span>
          </div>
        </div>
      </div>

    </div>
  );
};
