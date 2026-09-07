import React from 'react';
import {
  RotateCcw,
  Sun,
  Moon,
  Package,
  Layers,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  CalendarRange,
  ChevronDown
} from 'lucide-react';
import { DatasetMeta } from '../services/storage';
import { Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

interface HeaderProps {
  datasetMeta: DatasetMeta;
  totalFilteredCount: number;
  totalRawCount: number;
  filteredShipments: Shipment[];
  theme: 'dark' | 'light';
  isServerConnected?: boolean;
  allMonths: string[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onThemeToggle: () => void;
  onDatasetUpdate?: (shipments: Shipment[], filename: string) => void;
  onResetToDefault: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  datasetMeta,
  filteredShipments,
  theme,
  allMonths,
  selectedMonth,
  onMonthChange,
  onThemeToggle,
  onResetToDefault,
  activeTab,
  onTabChange
}) => {

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered_Shipments');
    XLSX.writeFile(workbook, `Logistics_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredShipments);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Logistics_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 dark:border-slate-800/80 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-xl shadow-sm transition-colors duration-200">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                <strong>Dashboard - Export</strong>
              </h1>
            </div>
          </div>

          {/* Month Filter Pill - Centered in Header */}
          <div className="relative group hidden sm:flex items-center justify-center md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-20">
            <button
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 hover:from-violet-600/20 hover:to-indigo-600/20 border border-violet-400/30 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow-violet-500/10"
              title="Filter by month"
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
              <span className="max-w-[130px] truncate">
                {selectedMonth && selectedMonth !== 'ALL'
                  ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : 'All Months'}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0 opacity-60 group-hover:rotate-180 transition-transform duration-200" />
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-48 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl hidden group-hover:block z-50 divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto before:absolute before:-top-2 before:left-0 before:right-0 before:h-2">
              <button
                onClick={() => onMonthChange('ALL')}
                className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                  !selectedMonth || selectedMonth === 'ALL'
                    ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Months
              </button>
              {allMonths.map(ym => (
                <button
                  key={ym}
                  onClick={() => onMonthChange(ym)}
                  className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                    selectedMonth === ym
                      ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {new Date(ym + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </button>
              ))}
            </div>
          </div>

          {/* Actions: Reset, Export, Theme */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {datasetMeta.isCustom && (
              <button
                onClick={onResetToDefault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Reset to default dataset"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden md:inline"><strong>Reset Default</strong></span>
              </button>
            )}

            {/* Export Menu */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Export filtered records"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden lg:inline"><strong>Export</strong></span>
              </button>
              <div className="absolute right-0 mt-1 w-36 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl hidden group-hover:block z-50 divide-y divide-slate-100 dark:divide-slate-800">
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <strong>Excel (.xlsx)</strong>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <strong>CSV File</strong>
                </button>
              </div>
            </div>

            {/* Theme Switcher */}
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="py-2.5 overflow-x-auto no-scrollbar border-t border-slate-200/80 dark:border-slate-800/60">
          <div className="flex items-center gap-2 p-1.5 bg-slate-200/50 dark:bg-[#070c18]/90 rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-inner w-fit min-w-full sm:min-w-0">
            {[
              { id: 'overview', label: 'Overview', icon: Package, color: 'text-sky-500' },
              { id: 'delays', label: 'Delay Analysis', icon: AlertCircle, color: 'text-amber-500' },
              { id: 'country', label: 'Destination Details', icon: Layers, color: 'text-cyan-500' },
              { id: 'comparison', label: 'Performance Comparison', icon: CheckCircle2, color: 'text-emerald-500' },
              { id: 'explorer', label: 'Shipment Explorer', icon: FileSpreadsheet, color: 'text-indigo-500' },
              { id: 'calendar', label: 'Weekly TT Comparison', icon: CalendarDays, color: 'text-violet-500' },
              { id: 'monthly', label: 'Monthly Comparison', icon: CalendarRange, color: 'text-purple-500' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`group relative flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-blue-500/35 border border-blue-400/50 -translate-y-0.5 ring-2 ring-blue-500/25'
                      : 'bg-white dark:bg-[#0f172a] text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white border border-slate-200 dark:border-slate-700/80 shadow-sm hover:border-blue-400/80 dark:hover:border-blue-500/80 hover:bg-slate-50 dark:hover:bg-slate-800/90 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/10 active:translate-y-0'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isActive
                        ? 'bg-white/20 border border-white/30 text-white shadow-inner'
                        : 'bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 group-hover:scale-110 group-hover:border-blue-400/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
                  </span>
                  <span className="tracking-tight"><strong>{tab.label}</strong></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
