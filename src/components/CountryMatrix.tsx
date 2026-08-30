import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  ArrowUpDown,
  Download,
  Filter
} from 'lucide-react';
import { CountryPerformance } from '../types/logistics';
import * as XLSX from 'xlsx';

interface CountryMatrixProps {
  countryData: CountryPerformance[];
  totalAWBs: number;
  onSelectCountry: (countryCode: string) => void;
  selectedDestination: string | null;
}

type SortField = 'countryCode' | 'awbCount' | 'avgTT' | 'minTT' | 'maxTT' | 'onTimePercentage';
type SortOrder = 'asc' | 'desc';

export const CountryMatrix: React.FC<CountryMatrixProps> = ({
  countryData,
  totalAWBs,
  onSelectCountry,
  selectedDestination
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('awbCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let list = [...countryData];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.countryCode.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [countryData, searchTerm, sortField, sortOrder]);

  const handleExport = () => {
    if (filteredAndSortedData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      filteredAndSortedData.map((c) => ({
        'Country Code': c.countryCode,
        'Count of AWB': c.awbCount,
        'Average TT (Days)': c.avgTT,
        'Max TT (Days)': c.maxTT,
        'Min TT (Days)': c.minTT,
        'On-Time Rate (%)': `${c.onTimePercentage}%`,
        'Transit Delays': c.transitDelays,
        'Clearance Delays': c.clearanceDelays,
        'Destination Delays': c.destinationDelays
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Country_Performance');
    XLSX.writeFile(workbook, `Country_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Header Controls */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white light:text-slate-900">
              <strong>Country Code Performance Matrix</strong>
            </h2>
            <p className="text-xs text-slate-400 light:text-slate-500 font-medium">
              Dynamically calculated across all active customer &amp; shipper filters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter country code (e.g. US, DE)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            title="Export country performance table to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline"><strong>Export</strong></span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800/80">
        <div className="max-h-[550px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
              <tr>
                <th
                  onClick={() => handleSort('countryCode')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center gap-1.5">
                    <span><strong>Country Code</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('awbCount')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>Count of AWB</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avgTT')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>Average TT (Days)</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('minTT')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>Min TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxTT')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>Max TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('onTimePercentage')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span><strong>On-Time Rate</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center font-bold"><strong>Delays</strong></th>
                <th className="py-3 px-4 text-center font-bold"><strong>Action</strong></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSortedData.map((c) => {
                const isSelected = selectedDestination === c.countryCode;
                const sharePct = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(1) : 0;
                const totalCountryDelays = c.transitDelays + c.clearanceDelays + c.destinationDelays;

                return (
                  <tr
                    key={c.countryCode}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-blue-600/15' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs text-sky-400 font-extrabold">
                        {c.countryCode}
                      </span>
                      <span><strong>{c.countryCode}</strong></span>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-white font-mono">
                      <div><strong>{c.awbCount.toLocaleString()}</strong></div>
                      <div className="text-[10px] text-slate-500 font-semibold font-sans">
                        {sharePct}% of volume
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          c.avgTT <= 4.5
                            ? 'text-emerald-400 font-extrabold'
                            : c.avgTT <= 5.5
                            ? 'text-amber-400 font-extrabold'
                            : 'text-rose-400 font-extrabold'
                        }
                      >
                        <strong>{c.avgTT} d</strong>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300 font-bold">
                      <strong>{c.minTT} d</strong>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300 font-bold">
                      <strong>{c.maxTT} d</strong>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono font-bold text-emerald-400">
                          <strong>{c.onTimePercentage}%</strong>
                        </span>
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 hidden sm:block overflow-hidden">
                          <div
                            className="bg-emerald-400 h-1.5 rounded-full"
                            style={{ width: `${Math.min(c.onTimePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {totalCountryDelays > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <strong>{totalCountryDelays}</strong>
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectCountry(isSelected ? 'ALL' : c.countryCode)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                            : 'bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600 hover:text-white'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        <span><strong>{isSelected ? 'Clear' : 'Filter'}</strong></span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
