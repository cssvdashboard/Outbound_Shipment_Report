import React, { useRef } from 'react';
import {
  Upload,
  RotateCcw,
  Sun,
  Moon,
  Package,
  Layers,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DatasetMeta } from '../services/storage';
import { parseExcelBuffer } from '../utils/excelParser';
import { Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

interface HeaderProps {
  datasetMeta: DatasetMeta;
  totalFilteredCount: number;
  totalRawCount: number;
  filteredShipments: Shipment[];
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onDatasetUpdate: (shipments: Shipment[], filename: string) => void;
  onResetToDefault: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  datasetMeta,
  totalFilteredCount,
  totalRawCount,
  filteredShipments,
  theme,
  onThemeToggle,
  onDatasetUpdate,
  onResetToDefault,
  activeTab,
  onTabChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        const result = parseExcelBuffer(buffer);
        if (result.shipments.length > 0) {
          onDatasetUpdate(result.shipments, file.name);
        } else {
          alert(result.error || 'Could not parse Excel file.');
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportCSV = () => {
    if (filteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered_Shipments');
    XLSX.writeFile(workbook, `Logistics_Export_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: 'csv' });
  };

  const handleExportExcel = () => {
    if (filteredShipments.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredShipments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered_Shipments');
    XLSX.writeFile(workbook, `Logistics_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl dark:bg-slate-950/85 dark:border-slate-800/80 light:bg-white/90 light:border-slate-200 shadow-sm">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent light:from-slate-900 light:to-slate-700">
                  TransitPulse
                </h1>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Analytics Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 light:text-slate-500 hidden sm:block">
                Weekly Logistics & Shipment Intelligence
              </p>
            </div>
          </div>

          {/* Dataset Status Banner */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs light:bg-slate-100 light:border-slate-200">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-200 light:text-slate-800 max-w-[170px] truncate">
                  {datasetMeta.filename}
                </span>
                {datasetMeta.isCustom ? (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Upload
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Default July
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 light:text-slate-500">
                {totalFilteredCount.toLocaleString()} / {totalRawCount.toLocaleString()} AWBs active
              </span>
            </div>
          </div>

          {/* Actions: Weekly Upload, Reset, Theme, Export */}
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Upload new weekly Excel or CSV dataset"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Weekly Excel</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {datasetMeta.isCustom && (
              <button
                onClick={onResetToDefault}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 light:bg-slate-200 light:hover:bg-slate-300 light:text-slate-700 light:border-slate-300 transition-colors"
                title="Reset to default July dataset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset Default</span>
              </button>
            )}

            {/* Export Menu */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 light:bg-slate-100 light:hover:bg-slate-200 light:text-slate-700 light:border-slate-300 transition-colors"
                title="Export filtered records"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">Export</span>
              </button>
              <div className="absolute right-0 mt-1 w-36 py-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl hidden group-hover:block light:bg-white light:border-slate-200 z-50">
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white light:text-slate-700 light:hover:bg-slate-100 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white light:text-slate-700 light:hover:bg-slate-100 flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  CSV File
                </button>
              </div>
            </div>

            {/* Theme Switcher */}
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 light:bg-slate-100 light:hover:bg-slate-200 light:text-slate-700 light:border-slate-300 transition-colors"
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar border-t border-slate-800/60 light:border-slate-200/80">
          {[
            { id: 'overview', label: 'Executive Overview', icon: Package },
            { id: 'delays', label: 'Delay Analysis Hub', icon: AlertCircle },
            { id: 'country', label: 'Country Matrix', icon: Layers },
            { id: 'comparison', label: 'Customer Benchmark', icon: CheckCircle2 },
            { id: 'explorer', label: 'Shipment Explorer', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 light:text-slate-600 light:hover:text-slate-900 light:hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
