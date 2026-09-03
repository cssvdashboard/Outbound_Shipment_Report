import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  ArrowUpDown,
  Download,
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
  totalAWBs
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
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-slate-300 dark:border-slate-700 shadow-sm">
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
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/80 border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition-colors cursor-pointer shadow-sm"
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
        <div className="glass-card p-3 rounded-xl border-2 border-yellow-500/40 bg-yellow-500/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Total Delays</div>
            <div className="text-base font-black text-yellow-400 font-mono">{summaryTotals.totalAllDelays.toLocaleString()}</div>
          </div>
        </div>

        {/* Clearance Delays */}
        <div className="glass-card p-3 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Clearance Delays</div>
            <div className="text-base font-black text-purple-400 font-mono">{summaryTotals.totalClearance.toLocaleString()}</div>
          </div>
        </div>

        {/* Transit Delays */}
        <div className="glass-card p-3 rounded-xl border-2 border-sky-500/40 bg-sky-500/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
            <Plane className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Transit Delays</div>
            <div className="text-base font-black text-sky-400 font-mono">{summaryTotals.totalTransit.toLocaleString()}</div>
          </div>
        </div>

        {/* Destination Delays */}
        <div className="glass-card p-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Dest. Delays</div>
            <div className="text-base font-black text-amber-400 font-mono">{summaryTotals.totalDestination.toLocaleString()}</div>
          </div>
        </div>

        {/* Weekend Delays */}
        <div className="glass-card p-3 rounded-xl border-2 border-rose-500/40 bg-rose-500/10 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-300 uppercase tracking-wider">Weekend Delays</div>
            <div className="text-base font-black text-rose-400 font-mono">{summaryTotals.totalWeekend.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Table Container with high-contrast, prominent grid borders and centered content */}
      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-600 dark:border-slate-600 bg-slate-950/40">
        <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-center text-xs min-w-[1000px] border-collapse border-spacing-0">
            <thead className="sticky top-0 bg-[#0f172a] border-b-2 border-slate-500 text-slate-200 font-bold uppercase text-[10px] tracking-wider z-10 shadow-md">
              <tr className="border-b-2 border-slate-500">
                <th
                  onClick={() => handleSort('countryCode')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r border-slate-600 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Country</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('awbCount')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r border-slate-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Volume (AWB)</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avgTT')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r border-slate-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Avg TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('minTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r border-slate-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Min TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('maxTT')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r border-slate-600"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>Max TT</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('onTimePercentage')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-800 hover:text-white transition-colors font-black border-r-2 border-slate-500"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span><strong>On-Time %</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* Delay Breakdowns */}
                <th
                  onClick={() => handleSort('clearanceDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-purple-950/40 hover:text-purple-200 transition-colors font-black bg-purple-950/20 border-r border-slate-600 text-purple-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                    <span><strong>Clearance</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-purple-400/80" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('transitDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-sky-950/40 hover:text-sky-200 transition-colors font-black bg-sky-950/20 border-r border-slate-600 text-sky-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Plane className="w-3.5 h-3.5 text-sky-400" />
                    <span><strong>Transit</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-sky-400/80" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('destinationDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-amber-950/40 hover:text-amber-200 transition-colors font-black bg-amber-950/20 border-r border-slate-600 text-amber-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span><strong>Dest. Delay</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-amber-400/80" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('weekendDelays')}
                  className="py-3 px-2 text-center cursor-pointer hover:bg-rose-950/40 hover:text-rose-200 transition-colors font-black bg-rose-950/20 border-r border-slate-600 text-rose-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span><strong>Weekend</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-rose-400/80" />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('totalDelays')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-yellow-950/40 hover:text-yellow-200 transition-colors font-black bg-yellow-950/20 text-yellow-300"
                >
                  <div className="flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                    <span><strong>Total Delays</strong></span>
                    <ArrowUpDown className="w-3 h-3 text-yellow-400/80" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-600">
              {filteredAndSortedData.map((c) => {
                const sharePct = totalAWBs > 0 ? ((c.awbCount / totalAWBs) * 100).toFixed(1) : 0;

                return (
                  <tr
                    key={c.countryCode}
                    className="hover:bg-slate-800/60 transition-colors border-b border-slate-600 bg-slate-900/40 even:bg-slate-900/80"
                  >
                    {/* Country Code */}
                    <td className="py-2.5 px-3 font-bold text-white text-center align-middle border-r border-slate-600">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 border-2 border-slate-600 flex items-center justify-center font-mono text-xs text-sky-400 font-black shadow-inner shrink-0">
                          {c.countryCode}
                        </span>
                        <span><strong>{c.countryCode}</strong></span>
                      </div>
                    </td>

                    {/* Volume */}
                    <td className="py-2.5 px-3 text-center align-middle font-extrabold text-white font-mono border-r border-slate-600">
                      <div className="flex flex-col items-center justify-center">
                        <div><strong>{c.awbCount.toLocaleString()}</strong></div>
                        <div className="text-[10px] text-slate-400 font-semibold font-sans">
                          {sharePct}% of total
                        </div>
                      </div>
                    </td>

                    {/* Avg TT */}
                    <td className="py-2.5 px-3 text-center align-middle font-mono font-bold border-r border-slate-600">
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
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-300 font-bold border-r border-slate-600">
                      {c.minTT} d
                    </td>

                    {/* Max TT */}
                    <td className="py-2.5 px-2 text-center align-middle font-mono text-slate-300 font-bold border-r border-slate-600">
                      {c.maxTT} d
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-2.5 px-3 text-center align-middle border-r-2 border-slate-500">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-400">
                          <strong>{c.onTimePercentage}%</strong>
                        </span>
                        <div className="w-10 bg-slate-800 rounded-full h-1.5 hidden sm:block overflow-hidden border border-slate-700">
                          <div
                            className="bg-emerald-400 h-1.5 rounded-full"
                            style={{ width: `${Math.min(c.onTimePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Clearance Delays */}
                    <td className="py-2.5 px-2 text-center align-middle bg-purple-950/20 border-r border-slate-600">
                      {c.clearanceDelays > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-purple-500/25 text-purple-200 border border-purple-400/40 shadow-sm">
                          {c.clearanceDelays}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Transit Delays */}
                    <td className="py-2.5 px-2 text-center align-middle bg-sky-950/20 border-r border-slate-600">
                      {c.transitDelays > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm">
                          {c.transitDelays}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Destination Delays */}
                    <td className="py-2.5 px-2 text-center align-middle bg-amber-950/20 border-r border-slate-600">
                      {c.destinationDelays > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-sm">
                          {c.destinationDelays}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Weekend Delays */}
                    <td className="py-2.5 px-2 text-center align-middle bg-rose-950/20 border-r border-slate-600">
                      {c.weekendDelays > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-rose-500/25 text-rose-200 border border-rose-400/40 shadow-sm">
                          {c.weekendDelays}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
                    </td>

                    {/* Total Delays */}
                    <td className="py-2.5 px-3 text-center align-middle bg-yellow-950/20">
                      {c.totalDelays > 0 ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-yellow-500/30 text-yellow-200 border border-yellow-400/60 shadow-sm">
                            {c.totalDelays}
                          </span>
                          <span className="text-[10px] text-yellow-400 font-mono font-black mt-0.5">
                            {c.awbCount > 0 ? ((c.totalDelays / c.awbCount) * 100).toFixed(2) : 0}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono text-xs font-bold">-</span>
                      )}
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
