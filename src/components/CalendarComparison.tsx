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
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Layers,
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
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  // Customer Dropdown & Search
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Destination Dropdown & Search
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Matrix & Metrics
  const matrixResult = useMemo(() => {
    return computeCalendarMatrix(rawShipments, {
      customer: selectedCustomer,
      destination: selectedDestination,
      month: selectedMonth
    });
  }, [rawShipments, selectedCustomer, selectedDestination, selectedMonth]);

  const { rows, sundayMetrics, fleetMetrics, availableMonths } = matrixResult;

  // Filtered dropdown customer options (Full List)
  const filteredCustomerList = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers;
    const q = customerSearch.toLowerCase();
    return allCustomers.filter((c) => c.toLowerCase().includes(q));
  }, [allCustomers, customerSearch]);

  // Filtered dropdown destination options (Full List)
  const filteredDestList = useMemo(() => {
    if (!destSearch.trim()) return allDestinations;
    const q = destSearch.toLowerCase();
    return allDestinations.filter((d) => d.toLowerCase().includes(q));
  }, [allDestinations, destSearch]);

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

  const handleClearAllFilters = () => {
    setSelectedCustomer('');
    setSelectedDestination('');
    setSelectedMonth('ALL');
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
      
      {/* Action: Export Matrix Table */}
      <div className="flex justify-end">
        <button
          onClick={handleExportMatrixExcel}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Matrix (.xlsx)</span>
        </button>
      </div>

      {/* 2. FLEET KPI RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Card 1: Overall Fleet Average Transit Time */}
        <div className="glass-card p-5 rounded-2xl border-2 border-slate-600 dark:border-slate-600 shadow-2xl bg-slate-950/40 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              Overall Fleet Avg TT
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">
              {fleetMetrics.totalCount.toLocaleString()} AWBs
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white font-mono">
              {fleetMetrics.overallAvgTT.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-slate-400">Days Fleet Avg</span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] font-medium text-slate-400">
            Across all 7 calendar weekdays
          </div>
        </div>

        {/* Card 2: Fastest Day of Week */}
        <div className="glass-card p-5 rounded-2xl border-2 border-slate-600 dark:border-slate-600 shadow-2xl bg-slate-950/40 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              Fastest Weekday
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950/50 text-emerald-400 border border-emerald-600">
              Optimal Day
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {fleetMetrics.fastestDay ? fleetMetrics.fastestDay.day : 'N/A'}
            </span>
            {fleetMetrics.fastestDay && (
              <span className="text-sm font-bold text-emerald-300 font-mono">
                ({fleetMetrics.fastestDay.avgTT.toFixed(2)}d)
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] font-medium text-slate-400">
            Lowest average transit turnaround
          </div>
        </div>

        {/* Card 3: Peak Volume Day */}
        <div className="glass-card p-5 rounded-2xl border-2 border-slate-600 dark:border-slate-600 shadow-2xl bg-slate-950/40 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              Peak Pickup Volume
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-950/50 text-amber-400 border border-amber-600">
              Heaviest Day
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">
              {fleetMetrics.peakVolumeDay ? fleetMetrics.peakVolumeDay.day : 'N/A'}
            </span>
            {fleetMetrics.peakVolumeDay && (
              <span className="text-sm font-bold text-slate-300 font-mono">
                ({fleetMetrics.peakVolumeDay.count.toLocaleString()} pkgs)
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] font-medium text-slate-400">
            Highest parcel distribution traffic
          </div>
        </div>

      </div>

      {/* 3. DYNAMIC CUSTOMER, DESTINATION & MONTH FILTER CONTROLS */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border-2 border-slate-600 dark:border-slate-600 shadow-2xl bg-slate-950/40 space-y-4 relative z-30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b-2 border-slate-600">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Filter By Customer or Destination
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              (Leave empty to view all customers and destinations)
            </span>
          </div>

          {/* Clear Filters Button */}
          {(selectedCustomer || selectedDestination) && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer w-fit"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters to All</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          
          {/* A. Customer Selector Search Bar with Dropdown */}
          <div className={`relative ${isCustomerDropdownOpen ? 'z-50' : 'z-20'}`} ref={customerDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Customer Name
              </span>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => handleSelectCustomer('')}
                  className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </label>
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <input
                ref={customerInputRef}
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsCustomerDropdownOpen(true);
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                placeholder={selectedCustomer ? `Customer: ${selectedCustomer}` : 'Search customer name...'}
                className={`w-full pl-9 pr-16 py-2 rounded-xl text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  selectedCustomer
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 placeholder:text-blue-700 dark:placeholder:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {(customerSearch || selectedCustomer) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (customerSearch) {
                        setCustomerSearch('');
                      } else {
                        handleSelectCustomer('');
                      }
                      customerInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                  title="Toggle customer list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>
              </div>
            </div>

            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{customerSearch ? `Matches for "${customerSearch}"` : 'All Customers'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                    {filteredCustomerList.length.toLocaleString()} items
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer('')}
                    className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                      !selectedCustomer
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>All Customers (Combined)</span>
                    {!selectedCustomer && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                  {filteredCustomerList.map((cust) => {
                    const isSelected = selectedCustomer === cust;
                    return (
                      <button
                        key={cust}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between truncate cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{cust}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                  {filteredCustomerList.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No matching customers found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* B. Destination Selector Search Bar with Dropdown */}
          <div className={`relative ${isDestDropdownOpen ? 'z-50' : 'z-20'}`} ref={destDropdownRef}>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                Destination Country
              </span>
              {selectedDestination && (
                <button
                  type="button"
                  onClick={() => handleSelectDestination('')}
                  className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </label>
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <input
                ref={destInputRef}
                type="text"
                value={destSearch}
                onChange={(e) => {
                  setDestSearch(e.target.value);
                  setIsDestDropdownOpen(true);
                }}
                onFocus={() => setIsDestDropdownOpen(true)}
                placeholder={selectedDestination ? `Destination: ${selectedDestination}` : 'Search destination code (e.g. US, CA, GB)...'}
                className={`w-full pl-9 pr-16 py-2 rounded-xl text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                  selectedDestination
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 placeholder:text-emerald-700 dark:placeholder:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                {(destSearch || selectedDestination) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (destSearch) {
                        setDestSearch('');
                      } else {
                        handleSelectDestination('');
                      }
                      destInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Toggle destination list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDestDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {isDestDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>{destSearch ? `Matches for "${destSearch}"` : 'All Destinations'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                    {filteredDestList.length.toLocaleString()} items
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  <button
                    type="button"
                    onClick={() => handleSelectDestination('')}
                    className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer ${
                      !selectedDestination
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>All Destinations (Combined)</span>
                    {!selectedDestination && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                  {filteredDestList.map((d) => {
                    const isSelected = selectedDestination === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleSelectDestination(d)}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between truncate cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{d}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                  {filteredDestList.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No matching destinations found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* C. Month Selector */}
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
              <option value="ALL">All Available Months</option>
              {availableMonths.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.count.toLocaleString()} records)
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* 4. MAIN CALENDAR TRANSIT MATRIX TABLE (Sunday–Saturday Vertically at Left) */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-600 dark:border-slate-600 bg-slate-950/40 relative z-10">
        <div className="p-4 sm:p-5 border-b-2 border-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0f172a]">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-violet-400" />
              Calendar Days vs Weekly Transit Matrix
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Click any cell to view detailed shipments and delivery breakdown for that day & week.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
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
          <table className="w-full text-center text-xs min-w-[1000px] border-collapse border-spacing-0">
            <thead className="sticky top-0 bg-[#0f172a] border-b-2 border-slate-500 text-slate-200 font-bold uppercase text-[10px] tracking-wider z-10 shadow-md">
              <tr className="border-b-2 border-slate-500">
                <th className="py-3.5 px-4 sticky left-0 bg-[#0f172a] z-20 w-44 font-black border-r border-slate-600 text-center">
                  Calendar Weekday
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  <div>Week 1 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 1–7</div>
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  <div>Week 2 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 8–14</div>
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  <div>Week 3 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 15–21</div>
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  <div>Week 4 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 22–28</div>
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  <div>Week 5 Avg TT</div>
                  <div className="text-[10px] text-slate-400 font-normal">Days 29–31</div>
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r-2 border-slate-500 bg-violet-950/40 text-violet-300">
                  Overall Day Avg TT
                </th>
                <th className="py-3.5 px-4 text-center font-black border-r border-slate-600">
                  Total Shipments
                </th>
                <th className="py-3.5 px-4 text-center font-black">
                  On-Time Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600">
              {rows.map((row) => (
                <tr
                  key={row.dayName}
                  className="hover:bg-slate-800/60 transition-colors border-b border-slate-600 bg-slate-900/40 even:bg-slate-900/80"
                >
                  {/* Vertically Left: Weekday Name */}
                  <td className="py-3.5 px-4 font-black sticky left-0 z-10 border-r border-slate-600 text-center bg-[#0f172a] text-slate-200">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      <span className="text-sm font-extrabold">{row.dayName}</span>
                    </div>
                  </td>

                    {/* Week 1..5 Columns */}
                    {[1, 2, 3, 4, 5].map((w) => {
                      const wData: WeekStats = row.weeks[w] || { weekNum: w, avgTT: 0, count: 0, shipments: [] };
                      const hasData = wData.count > 0;
                      return (
                        <td key={w} className="py-3 px-3 text-center border-r border-slate-600">
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
                              <span className="text-xs font-black tracking-tight group-hover:underline font-mono">
                                {wData.avgTT.toFixed(2)}d
                              </span>
                              <span className="text-[10px] opacity-80 font-mono">
                                {wData.count.toLocaleString()} pkgs
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Overall Day Avg TT */}
                    <td className="py-3 px-4 text-center border-r-2 border-slate-500 bg-violet-950/20">
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
                          <span className="text-xs font-black tracking-tight group-hover:underline font-mono">
                            {row.overallAvgTT.toFixed(2)}d
                          </span>
                          <span className="text-[10px] text-violet-200">Overall Avg</span>
                        </button>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs">0.00</span>
                      )}
                    </td>

                    {/* Total Shipments */}
                    <td className="py-3 px-4 text-center font-extrabold text-white font-mono border-r border-slate-600">
                      {row.totalCount.toLocaleString()}
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-800 border border-slate-600 text-slate-200 font-mono">
                        {row.totalCount > 0 ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>{row.onTimePercentage}%</span>
                          </>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. VISUAL CHART: WEEKLY COMPARISON BAR CHART */}
      <div className="glass-card p-5 rounded-2xl border-2 border-slate-600 dark:border-slate-600 shadow-2xl bg-slate-950/40 space-y-4">
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
