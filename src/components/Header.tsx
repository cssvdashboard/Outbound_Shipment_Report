import React, { useRef, useState } from 'react';
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
  AlertCircle,
  Server,
  Database,
  Loader2
} from 'lucide-react';
import { DatasetMeta } from '../services/storage';
import { parseExcelBuffer } from '../utils/excelParser';
import { uploadExcelToServer } from '../services/api';
import { Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

interface HeaderProps {
  datasetMeta: DatasetMeta;
  totalFilteredCount: number;
  totalRawCount: number;
  filteredShipments: Shipment[];
  theme: 'dark' | 'light';
  isServerConnected?: boolean;
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
  isServerConnected = false,
  onThemeToggle,
  onDatasetUpdate,
  onResetToDefault,
  activeTab,
  onTabChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);

    try {
      if (isServerConnected) {
        // Upload directly to Express backend
        const res = await uploadExcelToServer(file);
        if (res.data && res.data.length > 0) {
          onDatasetUpdate(res.data, file.name);
          setIsUploading(false);
          e.target.value = '';
          return;
        }
      }

      // Fallback: Parse client-side in browser
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
        setIsUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error('File upload failed:', err);
      alert('File upload failed: ' + (err?.message || 'Unknown error'));
      setIsUploading(false);
    }
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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-sm transition-colors duration-200">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-800 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                  Export Summary
                </h1>
                <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Analytics Hub
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Weekly Logistics & Shipment Intelligence
              </p>
            </div>
          </div>

          {/* Dataset Status Banner & Server Status */}
          <div className="hidden md:flex items-center gap-3">
            {/* Server Connection Indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
              isServerConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-500/30'
            }`}>
              {isServerConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Server className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Node.js Server Online</span>
                </>
              ) : (
                <>
                  <Database className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Local IndexedDB Mode</span>
                </>
              )}
            </div>

            {/* Dataset Metadata Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 max-w-[150px] truncate">
                    {datasetMeta.filename}
                  </span>
                  {datasetMeta.isCustom ? (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                      Custom Dataset
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-semibold">
                      Default July
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {totalFilteredCount.toLocaleString()} / {totalRawCount.toLocaleString()} AWBs active
                </span>
              </div>
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
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
              title="Upload new weekly Excel or CSV dataset"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Weekly Excel'}</span>
              <span className="sm:hidden">{isUploading ? '...' : 'Upload'}</span>
            </button>

            {datasetMeta.isCustom && (
              <button
                onClick={onResetToDefault}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                title="Reset to default July dataset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset Default</span>
              </button>
            )}

            {/* Export Menu */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                title="Export filtered records"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden lg:inline">Export</span>
              </button>
              <div className="absolute right-0 mt-1 w-36 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl hidden group-hover:block z-50">
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white flex items-center gap-2 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  CSV File
                </button>
              </div>
            </div>

            {/* Theme Switcher */}
            <button
              onClick={onThemeToggle}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
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
        <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar border-t border-slate-200/80 dark:border-slate-800/60">
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
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
