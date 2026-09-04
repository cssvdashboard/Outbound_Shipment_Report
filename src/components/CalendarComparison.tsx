import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CalendarDays,
  Users,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Search,
  X,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  BarChart2,
  Calendar,
  Truck,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { computeCalendarMatrix, CalendarDayRow, WeekStats } from '../utils/calendarAnalytics';
import { formatExcelDate, formatTT } from '../utils/formatters';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

interface CalendarComparisonProps {
  shipments: Shipment[];
  rawShipments: Shipment[];
  allCustomers: string[];
  allDestinations: string[];
  selectedCustomerFromParent?: string;
  selectedDestinationFromParent?: string;
  onCustomerChange?: (cust: string) => void;
  onDestinationChange?: (dest: string) => void;
}

export const CalendarComparison: React.FC<CalendarComparisonProps> = ({
  rawShipments,
  allCustomers,
  allDestinations,
  selectedCustomerFromParent,
  selectedDestinationFromParent,
  onCustomerChange,
  onDestinationChange
}) => {
  // Local Filter States
  const [selectedCustomer, setSelectedCustomer] = useState<string>(selectedCustomerFromParent || '');
  const [selectedDestination, setSelectedDestination] = useState<string>(selectedDestinationFromParent || '');
  const [selectedShipper, setSelectedShipper] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');

  // Customer Dropdown & Search
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Destination Dropdown & Search
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);

  // Shipper Dropdown & Search
  const [shipperSearch, setShipperSearch] = useState<string>('');
  const [isShipperDropdownOpen, setIsShipperDropdownOpen] = useState<boolean>(false);
  const shipperDropdownRef = useRef<HTMLDivElement>(null);

  // Drilldown Modal State
  const [drilldownTitle, setDrilldownTitle] = useState<string | null>(null);
  const [drilldownShipments, setDrilldownShipments] = useState<Shipment[]>([]);
  const [drilldownPage, setDrilldownPage] = useState<number>(1);
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const pageSize = 15;

  // Sync with parent filter changes if provided
  useEffect(() => {
    if (selectedCustomerFromParent !== undefined) {
      setSelectedCustomer(selectedCustomerFromParent);
    }
  }, [selectedCustomerFromParent]);

  useEffect(() => {
    if (selectedDestinationFromParent !== undefined) {
      setSelectedDestination(selectedDestinationFromParent);
    }
  }, [selectedDestinationFromParent]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
      if (shipperDropdownRef.current && !shipperDropdownRef.current.contains(event.target as Node)) {
        setIsShipperDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Matrix & Metrics
  const matrixResult = useMemo(() => {
    return computeCalendarMatrix(rawShipments, {
      customer: selectedCustomer,
      destination: selectedDestination,
      shipper: selectedShipper,
      month: selectedMonth
    });
  }, [rawShipments, selectedCustomer, selectedDestination, selectedShipper, selectedMonth]);

  const { rows, sundayMetrics, fleetMetrics, availableMonths, availableShippers } = matrixResult;

  // Filtered dropdown customer options
  const filteredCustomerList = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return allCustomers.filter((c) => c.toLowerCase().includes(q)).slice(0, 50);
  }, [allCustomers, customerSearch]);

  // Filtered dropdown destination options
  const filteredDestList = useMemo(() => {
    if (!destSearch.trim()) return allDestinations.slice(0, 50);
    const q = destSearch.toLowerCase();
    return allDestinations.filter((d) => d.toLowerCase().includes(q)).slice(0, 50);
  }, [allDestinations, destSearch]);

  // Filtered dropdown shipper options
  const filteredShipperList = useMemo(() => {
    if (!shipperSearch.trim()) return availableShippers.slice(0, 50);
    const q = shipperSearch.toLowerCase();
    return availableShippers.filter((s) => s.toLowerCase().includes(q)).slice(0, 50);
  }, [availableShippers, shipperSearch]);

  const handleSelectCustomer = (cust: string) => {
    setSelectedCustomer(cust);
    setIsCustomerDropdownOpen(false);
    setCustomerSearch('');
    if (onCustomerChange) onCustomerChange(cust);
  };

  const handleSelectDestination = (dest: string) => {
    setSelectedDestination(dest);
    setIsDestDropdownOpen(false);
    setDestSearch('');
    if (onDestinationChange) onDestinationChange(dest);
  };

  const handleSelectShipper = (shpr: string) => {
    setSelectedShipper(shpr);
    setIsShipperDropdownOpen(false);
    setShipperSearch('');
  };

  const handleClearAllFilters = () => {
    setSelectedCustomer('');
    setSelectedDestination('');
    setSelectedShipper('');
    if (onCustomerChange) onCustomerChange('');
    if (onDestinationChange) onDestinationChange('');
  };

  // Open drilldown modal for a cell
  const handleOpenDrilldown = (title: string, list: Shipment[]) => {
    setDrilldownTitle(title);
    setDrilldownShipments(list);
    setDrilldownPage(1);
    setDrilldownSearch('');
  };

  // Filtered drilldown shipments
  const filteredDrilldownList = useMemo(() => {
    if (!drilldownSearch.trim()) return drilldownShipments;
    const q = drilldownSearch.toLowerCase();
    return drilldownShipments.filter(
      (s) =>
        s.awb.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q) ||
        s.shprName.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q)
    );
  }, [drilldownShipments, drilldownSearch]);

  const totalPages = Math.ceil(filteredDrilldownList.length / pageSize) || 1;
  const paginatedShipments = filteredDrilldownList.slice(
    (drilldownPage - 1) * pageSize,
    drilldownPage * pageSize
  );

  // Export Matrix Table to Excel
  const handleExportMatrixExcel = () => {
    const exportData = rows.map((r) => ({
      'Day of Week': r.dayName,
      'Week 1 Avg TT (Days)': r.weeks[1]?.count ? r.weeks[1].avgTT : 'N/A',
      'Week 1 AWBs': r.weeks[1]?.count || 0,
      'Week 2 Avg TT (Days)': r.weeks[2]?.count ? r.weeks[2].avgTT : 'N/A',
      'Week 2 AWBs': r.weeks[2]?.count || 0,
      'Week 3 Avg TT (Days)': r.weeks[3]?.count ? r.weeks[3].avgTT : 'N/A',
      'Week 3 AWBs': r.weeks[3]?.count || 0,
      'Week 4 Avg TT (Days)': r.weeks[4]?.count ? r.weeks[4].avgTT : 'N/A',
      'Week 4 AWBs': r.weeks[4]?.count || 0,
      'Week 5 Avg TT (Days)': r.weeks[5]?.count ? r.weeks[5].avgTT : 'N/A',
      'Week 5 AWBs': r.weeks[5]?.count || 0,
      'Overall Day Avg TT (Days)': r.totalCount ? r.overallAvgTT : 'N/A',
      'Total AWBs': r.totalCount,
      'On-Time %': `${r.onTimePercentage}%`
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Calendar_TT_Comparison');
    XLSX.writeFile(workbook, `Calendar_Days_TT_Comparison_${selectedMonth || 'All'}.xlsx`);
  };

  // Export drilldown records
  const handleExportDrilldown = () => {
    const worksheet = XLSX.utils.json_to_sheet(drilldownShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Drilldown_Records');
    XLSX.writeFile(workbook, `Drilldown_${(drilldownTitle || 'Records').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  // Chart Configuration: Grouped Bar Chart for Week 1..4 comparison
  const chartData = {
    labels: rows.map((r) => r.dayName),
    datasets: [
      {
        label: 'Week 1 Avg TT',
        data: rows.map((r) => r.weeks[1]?.avgTT || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.85)', // Blue
        borderRadius: 6
      },
      {
        label: 'Week 2 Avg TT',
        data: rows.map((r) => r.weeks[2]?.avgTT || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald
        borderRadius: 6
      },
      {
        label: 'Week 3 Avg TT',
        data: rows.map((r) => r.weeks[3]?.avgTT || 0),
        backgroundColor: 'rgba(245, 158, 11, 0.85)', // Amber
        borderRadius: 6
      },
      {
        label: 'Week 4 Avg TT',
        data: rows.map((r) => r.weeks[4]?.avgTT || 0),
        backgroundColor: 'rgba(168, 85, 247, 0.85)', // Purple
        borderRadius: 6
      },
      {
        label: 'Overall Day Avg',
        data: rows.map((r) => r.overallAvgTT || 0),
        backgroundColor: 'rgba(239, 68, 68, 0.85)', // Rose
        borderRadius: 6
      }
    ]
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#94a3b8',
          font: { weight: 'bold', size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw} days`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Average Transit Time (Days)',
          color: '#94a3b8',
          font: { weight: 'bold', size: 11 }
        },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { weight: 'bold' } }
      }
    }
  };

  // Helper function to get color styling for transit times
  const getTTColorClass = (tt: number, count: number) => {
    if (count === 0 || tt === 0) return 'text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-800/30';
    if (tt <= 4.0) return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    if (tt <= 5.0) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. COMPONENT TITLE & ACTION BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0c1222] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Calendar Days Transit Time Comparison
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                Weekday & Weekly Matrix
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Pickup weekday correlation vs weekly transit time (Sunday–Saturday across Week 1–4/5) with dynamic customer & destination filtering.
            </p>
          </div>
        </div>

        {/* Action: Export Matrix Table */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportMatrixExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Matrix (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. DEDICATED SUNDAY & FLEET KPI RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Sunday Transit Time Highlight (Requested specifically by user) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-5 text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-between border border-indigo-400/30">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Sunday Pickup Metric
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 backdrop-blur-md border border-white/20">
                {sundayMetrics.totalCount.toLocaleString()} Shipments
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tight">
                {sundayMetrics.totalCount > 0 ? sundayMetrics.avgTT.toFixed(2) : '0.00'}
              </span>
              <span className="text-sm font-bold text-indigo-200">Days Avg TT</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] font-bold text-indigo-100">
            <span>Weekly:</span>
            <div className="flex gap-2 font-mono">
              <span>W1: {sundayMetrics.weekBreakdown[0]?.avgTT ? `${sundayMetrics.weekBreakdown[0].avgTT}d` : '-'}</span>
              <span>•</span>
              <span>W2: {sundayMetrics.weekBreakdown[1]?.avgTT ? `${sundayMetrics.weekBreakdown[1].avgTT}d` : '-'}</span>
              <span>•</span>
              <span>W3: {sundayMetrics.weekBreakdown[2]?.avgTT ? `${sundayMetrics.weekBreakdown[2].avgTT}d` : '-'}</span>
              <span>•</span>
              <span>W4: {sundayMetrics.weekBreakdown[3]?.avgTT ? `${sundayMetrics.weekBreakdown[3].avgTT}d` : '-'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Overall Fleet Average Transit Time */}
        <div className="bg-white dark:bg-[#0c1222] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              Overall Fleet Avg TT
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {fleetMetrics.totalCount.toLocaleString()} AWBs
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
              {fleetMetrics.overallAvgTT.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Days Fleet Avg</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Across all 7 calendar weekdays
          </div>
        </div>

        {/* Card 3: Fastest Day of Week */}
        <div className="bg-white dark:bg-[#0c1222] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
              Fastest Weekday
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
              Optimal Day
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {fleetMetrics.fastestDay ? fleetMetrics.fastestDay.day : 'N/A'}
            </span>
            {fleetMetrics.fastestDay && (
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                ({fleetMetrics.fastestDay.avgTT.toFixed(2)}d)
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Lowest average transit turnaround
          </div>
        </div>

        {/* Card 4: Peak Volume Day */}
        <div className="bg-white dark:bg-[#0c1222] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-500" />
              Peak Pickup Volume
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              Heaviest Day
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {fleetMetrics.peakVolumeDay ? fleetMetrics.peakVolumeDay.day : 'N/A'}
            </span>
            {fleetMetrics.peakVolumeDay && (
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                ({fleetMetrics.peakVolumeDay.count.toLocaleString()} pkgs)
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Highest parcel distribution traffic
          </div>
        </div>

      </div>

      {/* 3. DYNAMIC CUSTOMER, DESTINATION & MONTH FILTER CONTROLS */}
      <div className="bg-white dark:bg-[#0c1222] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Filter By Customer, Destination or Shipper
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              (Leave empty to view all shippers and destinations)
            </span>
          </div>

          {/* Clear Filters Button */}
          {(selectedCustomer || selectedDestination || selectedShipper) && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer w-fit"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters to All</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* A. Customer Selector Dropdown */}
          <div className="relative" ref={customerDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Customer Name
              </span>
              {selectedCustomer && (
                <button
                  onClick={() => handleSelectCustomer('')}
                  className="text-[10px] text-rose-500 hover:underline font-bold"
                >
                  Clear
                </button>
              )}
            </label>
            <div
              onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedCustomer
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="truncate">
                {selectedCustomer || 'All Customers (Combined)'}
              </span>
              <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
            </div>

            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  <button
                    onClick={() => handleSelectCustomer('')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>All Customers</span>
                    {!selectedCustomer && <span className="text-blue-500">✓</span>}
                  </button>
                  {filteredCustomerList.map((cust) => (
                    <button
                      key={cust}
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between truncate"
                    >
                      <span className="truncate">{cust}</span>
                      {selectedCustomer === cust && <span className="text-blue-500 shrink-0 ml-2">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* B. Destination Selector Dropdown */}
          <div className="relative" ref={destDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                Destination Country
              </span>
              {selectedDestination && (
                <button
                  onClick={() => handleSelectDestination('')}
                  className="text-[10px] text-rose-500 hover:underline font-bold"
                >
                  Clear
                </button>
              )}
            </label>
            <div
              onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedDestination
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="truncate">
                {selectedDestination ? `Destination: ${selectedDestination}` : 'All Destinations (Combined)'}
              </span>
              <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
            </div>

            {isDestDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search destination code (e.g. US, CA, GB)..."
                      value={destSearch}
                      onChange={(e) => setDestSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  <button
                    onClick={() => handleSelectDestination('')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>All Destinations</span>
                    {!selectedDestination && <span className="text-emerald-500">✓</span>}
                  </button>
                  {filteredDestList.map((d) => (
                    <button
                      key={d}
                      onClick={() => handleSelectDestination(d)}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span>{d}</span>
                      {selectedDestination === d && <span className="text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* C. Shipper Name Dropdown */}
          <div className="relative" ref={shipperDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                Shipper (Optional)
              </span>
              {selectedShipper && (
                <button
                  onClick={() => handleSelectShipper('')}
                  className="text-[10px] text-rose-500 hover:underline font-bold"
                >
                  Clear
                </button>
              )}
            </label>
            <div
              onClick={() => setIsShipperDropdownOpen(!isShipperDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedShipper
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="truncate">
                {selectedShipper || 'All Shippers (Combined)'}
              </span>
              <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
            </div>

            {isShipperDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search shipper..."
                      value={shipperSearch}
                      onChange={(e) => setShipperSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  <button
                    onClick={() => handleSelectShipper('')}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>All Shippers</span>
                    {!selectedShipper && <span className="text-amber-500">✓</span>}
                  </button>
                  {filteredShipperList.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSelectShipper(s)}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between truncate"
                    >
                      <span className="truncate">{s}</span>
                      {selectedShipper === s && <span className="text-amber-500 shrink-0 ml-2">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* D. Month Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-violet-500" />
              Calendar Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.count.toLocaleString()} records)
                </option>
              ))}
              <option value="ALL">All Available Months</option>
            </select>
          </div>

        </div>

        {/* Filter State Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-slate-500 font-semibold">Active Scope:</span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-bold">
            Customer: {selectedCustomer || 'All'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold">
            Destination: {selectedDestination || 'All'}
          </span>
          {selectedShipper && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold">
              Shipper: {selectedShipper}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 font-bold">
            Month: {availableMonths.find((m) => m.id === selectedMonth)?.label || 'All Months'}
          </span>
        </div>
      </div>

      {/* 4. MAIN CALENDAR TRANSIT MATRIX TABLE (Sunday–Saturday Vertically at Left) */}
      <div className="bg-white dark:bg-[#0c1222] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              Calendar Days vs Weekly Transit Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Click any cell to view detailed shipments and delivery breakdown for that day & week.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Fast (&le; 4.0d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Moderate (4.1–5.0d)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Slow (&gt; 5.0d)</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-3.5 px-4 sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 w-44">
                  Calendar Weekday
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div>Week 1 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 1–7</div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div>Week 2 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 8–14</div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div>Week 3 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 15–21</div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div>Week 4 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 22–28</div>
                </th>
                <th className="py-3.5 px-4 text-center">
                  <div>Week 5 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 29–31</div>
                </th>
                <th className="py-3.5 px-4 text-center bg-violet-50/50 dark:bg-violet-950/20 font-black text-violet-700 dark:text-violet-300">
                  Overall Day Avg TT
                </th>
                <th className="py-3.5 px-4 text-center">
                  Total Shipments
                </th>
                <th className="py-3.5 px-4 text-center">
                  On-Time Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs font-semibold">
              {rows.map((row) => {
                const isSunday = row.dayName === 'Sunday';
                return (
                  <tr
                    key={row.dayName}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSunday ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''
                    }`}
                  >
                    {/* Vertically Left: Weekday Name */}
                    <td className={`py-4 px-4 font-black sticky left-0 z-10 ${
                      isSunday
                        ? 'bg-indigo-50/90 dark:bg-[#0e1628] text-indigo-700 dark:text-indigo-400 border-r border-indigo-100 dark:border-indigo-900/50'
                        : 'bg-white dark:bg-[#0c1222] text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isSunday
                            ? 'bg-violet-600 shadow-sm shadow-violet-500/50'
                            : 'bg-slate-400 dark:bg-slate-600'
                        }`}></span>
                        <span className="text-sm font-extrabold">{row.dayName}</span>
                        {isSunday && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-violet-600 text-white">
                            Target
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Week 1..5 Columns */}
                    {[1, 2, 3, 4, 5].map((w) => {
                      const wData: WeekStats = row.weeks[w] || { weekNum: w, avgTT: 0, count: 0, shipments: [] };
                      const hasData = wData.count > 0;
                      return (
                        <td key={w} className="py-3.5 px-3 text-center">
                          {hasData ? (
                            <button
                              onClick={() =>
                                handleOpenDrilldown(
                                  `${row.dayName} - Week ${w} (${wData.count} Shipments)`,
                                  wData.shipments
                                )
                              }
                              className={`group inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border transition-all cursor-pointer hover:scale-105 ${getTTColorClass(
                                wData.avgTT,
                                wData.count
                              )}`}
                              title={`Click to inspect ${wData.count} shipments`}
                            >
                              <span className="text-xs font-black tracking-tight group-hover:underline">
                                {wData.avgTT.toFixed(2)}d
                              </span>
                              <span className="text-[10px] opacity-75 font-mono">
                                {wData.count.toLocaleString()} pkgs
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-xs">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Overall Day Avg TT */}
                    <td className="py-3.5 px-4 text-center bg-violet-50/40 dark:bg-violet-950/20">
                      {row.totalCount > 0 ? (
                        <button
                          onClick={() =>
                            handleOpenDrilldown(
                              `${row.dayName} - All Weeks (${row.totalCount} Shipments)`,
                              row.shipments
                            )
                          }
                          className="group inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-500 transition-all cursor-pointer hover:scale-105"
                        >
                          <span className="text-xs font-black tracking-tight group-hover:underline">
                            {row.overallAvgTT.toFixed(2)}d
                          </span>
                          <span className="text-[10px] text-violet-200">Overall Avg</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-mono text-xs">0.00</span>
                      )}
                    </td>

                    {/* Total Shipments */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                      {row.totalCount.toLocaleString()}
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {row.totalCount > 0 ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>{row.onTimePercentage}%</span>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. VISUAL CHART: WEEKLY COMPARISON BAR CHART */}
      <div className="bg-white dark:bg-[#0c1222] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-500" />
              Weekday vs Weekly Transit Time Trend
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Comparing average transit days across Week 1, Week 2, Week 3, Week 4 and Overall Day Average
            </p>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* 6. INTERACTIVE CELL DRILLDOWN MODAL */}
      {drilldownTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {drilldownTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Showing {filteredDrilldownList.length} matching shipment records
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportDrilldown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => setDrilldownTitle(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search filter inside modal */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by AWB, customer, shipper, or destination..."
                  value={drilldownSearch}
                  onChange={(e) => {
                    setDrilldownSearch(e.target.value);
                    setDrilldownPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 z-10">
                    <th className="py-2.5 px-3">AWB</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Shipper</th>
                    <th className="py-2.5 px-3">Dest</th>
                    <th className="py-2.5 px-3">Pickup Date</th>
                    <th className="py-2.5 px-3 text-center">TT (Days)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                  {paginatedShipments.map((s) => (
                    <tr key={s.awb} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {s.awb}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate" title={s.customer}>
                        {s.customer || '-'}
                      </td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate text-slate-600 dark:text-slate-400" title={s.shprName}>
                        {s.shprName || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {s.destination}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {formatExcelDate(s.pickup)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          s.tt <= 4
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : s.tt <= 5
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {formatTT(s.tt)}d
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.finalResolution === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {s.finalResolution || 'Delivered'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Page {drilldownPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={drilldownPage === 1}
                  onClick={() => setDrilldownPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={drilldownPage === totalPages}
                  onClick={() => setDrilldownPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
