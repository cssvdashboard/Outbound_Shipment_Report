import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  RotateCcw,
  Globe,
  Check,
  ChevronDown
} from 'lucide-react';
import { FilterState, Shipment } from '../types/logistics';

interface SmartFilterBarProps {
  rawShipments: Shipment[];
  filters: FilterState;
  onDestinationChange: (dest: string) => void;
  onResetFilters: () => void;
  allDestinations: string[];
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  rawShipments,
  filters,
  onDestinationChange,
  onResetFilters,
  allDestinations
}) => {
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute destination counts from dataset
  const destinationCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of rawShipments) {
      if (s.destination) {
        const dest = s.destination.toUpperCase();
        map.set(dest, (map.get(dest) || 0) + 1);
      }
    }
    return map;
  }, [rawShipments]);

  // Filter destination list based on typed query
  const filteredDestinations = useMemo(() => {
    if (!destSearch.trim()) return allDestinations;
    const q = destSearch.trim().toUpperCase();
    return allDestinations.filter((code) => code.includes(q));
  }, [allDestinations, destSearch]);

  const selectedDestination = filters.selectedDestinations[0] || null;

  const handleSelectDestination = (code: string) => {
    onDestinationChange(code);
    setDestSearch('');
    setIsDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDestinations.length > 0) {
        handleSelectDestination(filteredDestinations[0]);
      }
    }
  };

  const totalActiveFilters =
    filters.selectedShippers.length +
    filters.selectedCustomers.length +
    filters.selectedDestinations.length +
    filters.selectedTransitDelays.length +
    filters.selectedClearanceDelays.length +
    filters.selectedDestinationDelays.length +
    filters.selectedFinalResolutions.length +
    filters.selectedTTRanges.length;

  return (
    <div className="sticky top-16 z-30 w-full bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl border-y border-slate-200 dark:border-slate-800/90 py-3 px-3 sm:px-6 lg:px-8 shadow-md transition-colors duration-200">
      <div className="max-w-[1700px] mx-auto space-y-2">
        
        {/* Main Controls Row: Destination Search Bar Only */}
        <div className="flex items-center gap-3">
          
          {/* Destination Text Search Bar with Dropdown */}
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="relative flex items-center">
              
              {/* Globe Icon */}
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </div>

              {/* Text Search Input */}
              <input
                ref={inputRef}
                type="text"
                value={destSearch}
                onChange={(e) => {
                  setDestSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedDestination
                    ? `Destination: ${selectedDestination} (${(destinationCounts.get(selectedDestination) || 0).toLocaleString()} AWBs)`
                    : `Destination : All ${allDestinations.length} countries`
                }
                className={`w-full pl-10 pr-24 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  selectedDestination
                    ? 'bg-blue-50/70 border-blue-400 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500/60 dark:text-blue-200 placeholder:text-blue-800 dark:placeholder:text-blue-300'
                    : 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400'
                }`}
              />

              {/* Right side controls: Clear X and Chevron */}
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                {destSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDestSearch('');
                      inputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear search input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : selectedDestination ? (
                  <button
                    type="button"
                    onClick={() => onDestinationChange('ALL')}
                    className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Reset destination to All countries"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                  title="Toggle destination list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Destination Autocomplete Dropdown List */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-blue-900/25 divide-y divide-slate-100 dark:divide-slate-800">
                
                {/* Header summary in dropdown */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      {destSearch.trim()
                        ? `Matching Destinations for "${destSearch.toUpperCase()}"`
                        : `Destination Countries (${allDestinations.length} Total)`}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                    {filteredDestinations.length} available
                  </span>
                </div>

                {/* All Destinations Option */}
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectDestination('ALL')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-all cursor-pointer ${
                      !selectedDestination
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold border border-blue-500/40 shadow-sm'
                        : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!selectedDestination ? (
                        <Check className="w-4 h-4 text-blue-500 font-bold" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                      )}
                      <span className="font-bold">Destination : All {allDestinations.length} countries</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {rawShipments.length.toLocaleString()} AWBs
                    </span>
                  </button>
                </div>

                {/* Country List Options */}
                <div className="p-1.5 space-y-0.5">
                  {filteredDestinations.map((code) => {
                    const isSelected = selectedDestination === code;
                    const count = destinationCounts.get(code) || 0;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleSelectDestination(code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25'
                            : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white font-bold" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <span className="font-mono font-extrabold">{code}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {count.toLocaleString()} AWBs
                        </span>
                      </button>
                    );
                  })}

                  {filteredDestinations.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-semibold">No destination country found matching &quot;{destSearch}&quot;</p>
                      <p className="text-[11px] text-slate-500">Try searching for a 2-letter country code (e.g. US, DE, GB).</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Reset Filters Button (Visible when any filter is applied) */}
          {totalActiveFilters > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Active Filter Tags Row (Only shown when filters are selected) */}
        {totalActiveFilters > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1.5">
              Active:
            </span>

            {/* Destination tag */}
            {filters.selectedDestinations.map((dest) => (
              <span
                key={dest}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/60 shadow-sm"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Destination: {dest}</span>
                <button
                  type="button"
                  onClick={() => onDestinationChange('ALL')}
                  className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Timeline Range tags */}
            {filters.selectedTTRanges.map((tt) => (
              <span
                key={tt}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50 shadow-sm"
              >
                ⏱️ Timeline: {tt}
              </span>
            ))}

            {/* Final Resolution tags */}
            {filters.selectedFinalResolutions.map((res) => {
              const isNegative = ['rts', 'lost', 'destroyed', 'seized', 'undelivered'].includes(res.toLowerCase().trim());
              const isSuccess = res.toLowerCase().trim() === 'delivered';
              return (
                <span
                  key={res}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${
                    isNegative
                      ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700/60'
                      : isSuccess
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50'
                  }`}
                >
                  {isNegative ? '⚠️ Exception' : isSuccess ? '✅ Status' : '🛡️ Resolution'}: {res}
                </span>
              );
            })}

            {/* Delay drilldown tags */}
            {filters.selectedTransitDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700/50 shadow-sm"
              >
                ✈️ Transit Delay: {d}
              </span>
            ))}
            {filters.selectedClearanceDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50 shadow-sm"
              >
                📋 Clearance: {d}
              </span>
            ))}
            {filters.selectedDestinationDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/50 shadow-sm"
              >
                🚚 Dest Delay: {d}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
