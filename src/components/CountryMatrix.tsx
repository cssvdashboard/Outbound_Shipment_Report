import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  ArrowUpDown,
  Download,
  Filter,
  ShieldAlert,
  Plane,
  MapPin,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { CountryPerformance } from '../types/logistics';
import * as XLSX from 'xlsx';

interface CountryMatrixProps {
  countryData: CountryPerformance[];
  totalAWBs: number;
  onSelectCountry: (countryCode: string) => void;
  selectedDestination: string | null;
}

type SortField =
  | 'countryCode'
  | 'awbCount'
  | 'avgTT'
  | 'minTT'
  | 'maxTT'
  | 'onTimePercentage'
  | 'clearanceDelays'
  | 'transitDelays'
  | 'destinationDelays'
  | 'weekendDelays'
  | 'totalDelays';

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
      // For delay columns and volume/TT, default to descending
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
      const valA: any = a[sortField] ?? 0;
      const valB: any = b[sortField] ?? 0;

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [countryData, searchTerm, sortField, sortOrder]);

  // Aggregate totals across all countries
  const summaryTotals = useMemo(() => {
    let totalClearance = 0;
    let totalTransit = 0;
    let totalDestination = 0;
    let totalWeekend = 0;
    let totalAllDelays = 0;

    for (const c of countryData) {
      totalClearance += c.clearanceDelays || 0;
      totalTransit += c.transitDelays || 0;
      totalDestination += c.destinationDelays || 0;
      totalWeekend += c.weekendDelays || 0;
      totalAllDelays += c.totalDelays || 0;
    }

    return {
      totalClearance,
      totalTransit,
      totalDestination,
      totalWeekend,
      totalAllDelays,
      countriesCount: countryData.length
    };
  }, [countryData]);

  const handleExport = () => {
    if (filteredAndSortedData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(
      filteredAndSortedData.map((c) => ({
        'Country Code': c.countryCode,
        'Count of AWB': c.awbCount,
        'Average TT (Days)': c.avgTT,
        'Min TT (Days)': c.minTT,
        'Max TT (Days)': c.maxTT,
        'On-Time Rate (%)': `${c.onTimePercentage}%`,
        'Clearance Delays': c.clearanceDelays,
        'Transit Delays': c.transitDelays,
        'Destination Delays': c.destinationDelays,
        'Weekend Delays': c.weekendDelays,
        'Total Delays': c.totalDelays
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Country_Performance');
    XLSX.writeFile(workbook, `Country_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Header & Search/Export Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white light:text-slate-900">
              <strong>Destination Details &amp; Country Delays Matrix</strong>
            </h2>
            <p className="text-xs text-slate-400 light:text-slate-500 font-medium">
              Detailed delay breakdowns (Clearance, Transit, Destination, Weekend) across {summaryTotals.countriesCount} active destinations
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
            title="Export country performance table with full delay breakdown to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline"><strong>Export</strong></span>
          </button>
        </div>
      </div>

      {/* Delay Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Delays */}
        <div className="glass-card p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Delays</div>
            <div className="text-base font-black text-yellow-400 font-mono">{summaryTotals.totalAllDelays.toLocaleString()}</div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div className="glass-card p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clearance Delays</div>
            <div className="text-base font-black text-purple-400 font-mono">{summaryTotals.totalClearance.toLocaleString()}</div>
          </div>
        </div>

        {/* Transit Delays */}
        <div className="glass-card p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transit Delays</div>
            <div className="text-base font-black text-sky-400 font-mono">{summaryTotals.totalTransit.toLocaleString()}</div>
          </div>
        </div>

        {/* Destination Delays */}
        <div className="glass-card p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dest. Delays</div>
            <div className="text-base font-black text-amber-400 font-mono">{summaryTotals.totalDestination.toLocaleString()}</div>
          </div>
        </div>

        {/* Weekend Delays */}
        <div className="glass-card p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Weekend Delays</div>
            <div className="text-base font-black text-rose-400 font-mono">{summaryTotals.totalWeekend.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-xl border border-slate-800/80">
        <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="sticky top-0 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
              <tr>
                <th
                  onClick={() => handleSort('countryCode')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center gap-1">
                    <span><strong>Country</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('awbCount')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span><strong>Volume (AWB)</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avgTT')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span><strong>Avg TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('minTT')}
                  className="py-3 px-2 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span><strong>Min TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxTT')}
                  className="py-3 px-2 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span><strong>Max TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('onTimePercentage')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors font-bold"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span><strong>On-Time %</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Delay Breakdowns */}
                <th
                  onClick={() => handleSort('clearanceDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-purple-300 transition-colors font-bold bg-purple-500/5 border-l border-purple-500/10"
                >
                  <div className="flex items-center justify-center gap-1 text-purple-400">
                    <ShieldAlert className="w-3 h-3" />
                    <span><strong>Clearance</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-purple-500/70" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('transitDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-sky-300 transition-colors font-bold bg-sky-500/5"
                >
                  <div className="flex items-center justify-center gap-1 text-sky-400">
                    <Plane className="w-3 h-3" />
                    <span><strong>Transit</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-sky-500/70" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('destinationDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-amber-300 transition-colors font-bold bg-amber-500/5"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <MapPin className="w-3 h-3" />
                    <span><strong>Dest. Delay</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-amber-500/70" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('weekendDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:text-rose-300 transition-colors font-bold bg-rose-500/5"
                >
                  <div className="flex items-center justify-center gap-1 text-rose-400">
                    <Calendar className="w-3 h-3" />
                    <span><strong>Weekend</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-rose-500/70" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('totalDelays')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-yellow-300 transition-colors font-bold bg-yellow-500/5 border-r border-yellow-500/10"
                >
                  <div className="flex items-center justify-center gap-1 text-yellow-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span><strong>Total Delays</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-yellow-500/70" />
                  </div>
                </th>

                <th className="py-3 px-3 text-center font-bold"><strong>Action</strong></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSortedData.map((c) => {
                const isSelected = selectedDestination === c.countryCode;
                const sharePct = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(1) : 0;

                return (
                  <tr
                    key={c.countryCode}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-blue-600/15' : ''
                    }`}
                  >
                    {/* Country Code */}
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs text-sky-400 font-extrabold">
                        {c.countryCode}
                      </span>
                      <span><strong>{c.countryCode}</strong></span>
                    </td>

                    {/* Volume */}
                    <td className="py-2.5 px-3 text-right font-extrabold text-white font-mono">
                      <div><strong>{c.awbCount.toLocaleString()}</strong></div>
                      <div className="text-[10px] text-slate-500 font-semibold font-sans">
                        {sharePct}% of total
                      </div>
                    </td>

                    {/* Avg TT */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
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

                    {/* Min TT */}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400 font-bold">
                      {c.minTT} d
                    </td>

                    {/* Max TT */}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400 font-bold">
                      {c.maxTT} d
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono font-bold text-emerald-400">
                          <strong>{c.onTimePercentage}%</strong>
                        </span>
                        <div className="w-10 bg-slate-800 rounded-full h-1.5 hidden sm:block overflow-hidden">
                          <div
                            className="bg-emerald-400 h-1.5 rounded-full"
                            style={{ width: `${Math.min(c.onTimePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Clearance Delays */}
                    <td className="py-2.5 px-2 text-center bg-purple-500/5 border-l border-purple-500/10">
                      {c.clearanceDelays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          {c.clearanceDelays}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Transit Delays */}
                    <td className="py-2.5 px-2 text-center bg-sky-500/5">
                      {c.transitDelays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {c.transitDelays}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Destination Delays */}
                    <td className="py-2.5 px-2 text-center bg-amber-500/5">
                      {c.destinationDelays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {c.destinationDelays}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Weekend Delays */}
                    <td className="py-2.5 px-2 text-center bg-rose-500/5">
                      {c.weekendDelays > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          {c.weekendDelays}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Total Delays */}
                    <td className="py-2.5 px-3 text-center bg-yellow-500/5 border-r border-yellow-500/10">
                      {c.totalDelays > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm shadow-yellow-500/10">
                          {c.totalDelays}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center">
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
