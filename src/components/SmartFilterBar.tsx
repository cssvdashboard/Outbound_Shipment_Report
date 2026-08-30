import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Globe,
  Check,
  ChevronDown
} from 'lucide-react';
import { FilterState, Shipment } from '../types/logistics';

interface SmartFilterBarProps {
  rawShipments: Shipment[];
  filters: FilterState;
  onDestinationChange: (dest: string) => void;
  onResetFilters?: () => void;
  allDestinations: string[];
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  rawShipments,
  filters,
  onDestinationChange,
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

  return (
    <div className="sticky top-16 z-30 w-full bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl border-y border-slate-200 dark:border-slate-800/90 py-3 px-3 sm:px-6 lg:px-8 shadow-md transition-colors duration-200">
      <div className="max-w-[1700px] mx-auto">
        
        {/* Main Controls: Clean Destination Text Search Bar Only */}
        <div className="relative w-full" ref={dropdownRef}>
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

      </div>
    </div>
  );
};
