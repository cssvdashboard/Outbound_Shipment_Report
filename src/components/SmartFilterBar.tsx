import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  FilterX,
  X,
  RotateCcw,
  Globe,
  Users,
  ChevronDown,
  Building2
} from 'lucide-react';
import { FilterState, FilterMode, Shipment } from '../types/logistics';
import { searchShippers, searchCustomers } from '../utils/analytics';

interface SmartFilterBarProps {
  rawShipments: Shipment[];
  filters: FilterState;
  onFilterModeChange: (mode: FilterMode) => void;
  onAddShipper: (shipper: string) => void;
  onRemoveShipper: (shipper: string) => void;
  onAddCustomer: (customer: string) => void;
  onRemoveCustomer: (customer: string) => void;
  onDestinationChange: (dest: string) => void;
  onResetFilters: () => void;
  allDestinations: string[];
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  rawShipments,
  filters,
  onFilterModeChange,
  onAddShipper,
  onRemoveShipper,
  onAddCustomer,
  onRemoveCustomer,
  onDestinationChange,
  onResetFilters,
  allDestinations
}) => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchTarget, setSearchTarget] = useState<'shipper' | 'customer'>('shipper');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Compute matching autocomplete items based on query e.g. "Four" or "Elite"
  const suggestions = useMemo(() => {
    if (!searchInput.trim()) return [];
    if (searchTarget === 'shipper') {
      return searchShippers(rawShipments, searchInput, 20);
    } else {
      return searchCustomers(rawShipments, searchInput, 20);
    }
  }, [rawShipments, searchInput, searchTarget]);

  const handleSelectSuggestion = (name: string) => {
    if (searchTarget === 'shipper') {
      onAddShipper(name);
    } else {
      onAddCustomer(name);
    }
    setSearchInput('');
    setIsDropdownOpen(false);
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
    <div className="w-full bg-slate-900/70 dark:bg-slate-900/80 light:bg-white border-y border-slate-800 dark:border-slate-800 light:border-slate-200 py-3.5 px-3 sm:px-6 lg:px-8 shadow-sm">
      <div className="max-w-[1700px] mx-auto space-y-3">
        
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search with Autocomplete Dropdown */}
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (searchInput.trim()) setIsDropdownOpen(true);
                  }}
                  placeholder={
                    searchTarget === 'shipper'
                      ? 'Type shipper name keyword (e.g. "Four", "Elite", "Exp", "Fashion")...'
                      : 'Type customer account keyword...'
                  }
                  className="w-full pl-9 pr-24 py-2 text-xs rounded-xl bg-slate-950/80 border border-slate-700/80 dark:bg-slate-950 dark:border-slate-700 light:bg-slate-50 light:border-slate-300 text-slate-100 light:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
                
                {/* Search Target Switcher Pill */}
                <div className="absolute inset-y-1 right-1 flex items-center">
                  <button
                    type="button"
                    onClick={() => setSearchTarget(searchTarget === 'shipper' ? 'customer' : 'shipper')}
                    className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 dark:bg-slate-800 dark:text-slate-300 light:bg-slate-200 light:text-slate-700 flex items-center gap-1 transition-colors"
                  >
                    {searchTarget === 'shipper' ? (
                      <>
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span>Shipper</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3 text-emerald-400" />
                        <span>Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Include vs Exclude (Filter Out) Mode Buttons */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950/90 border border-slate-800 dark:bg-slate-950 dark:border-slate-800 light:bg-slate-100 light:border-slate-300">
                <button
                  type="button"
                  onClick={() => onFilterModeChange('include')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filters.filterMode === 'include'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 light:text-slate-600 light:hover:text-slate-900'
                  }`}
                  title="Show ONLY records matching selected shipper(s)"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                </button>

                <button
                  type="button"
                  onClick={() => onFilterModeChange('exclude')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filters.filterMode === 'exclude'
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30'
                      : 'text-slate-400 hover:text-rose-400 light:text-slate-600 light:hover:text-rose-600'
                  }`}
                  title="FILTER OUT: Hide / exclude selected shipper(s) from dashboard"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Filter Out</span>
                </button>
              </div>
            </div>

            {/* Autocomplete Dropdown List */}
            {isDropdownOpen && searchInput.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto z-50 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl dark:bg-slate-900 dark:border-slate-700 light:bg-white light:border-slate-200">
                <div className="p-2 border-b border-slate-800 light:border-slate-100 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span>
                    Matching {searchTarget === 'shipper' ? 'Shippers' : 'Customers'} for &quot;{searchInput}&quot;
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {suggestions.length} results found
                  </span>
                </div>
                
                {suggestions.length > 0 ? (
                  <div className="p-1 space-y-0.5">
                    {suggestions.map((item) => {
                      const isSelected =
                        searchTarget === 'shipper'
                          ? filters.selectedShippers.includes(item.name)
                          : filters.selectedCustomers.includes(item.name);
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => handleSelectSuggestion(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-600/20 text-blue-300 font-semibold'
                              : 'text-slate-200 hover:bg-slate-800 light:text-slate-800 light:hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate pr-2">{item.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 light:bg-slate-200 light:text-slate-600">
                            {item.count.toLocaleString()} AWBs
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No {searchTarget} found containing &quot;{searchInput}&quot;.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Destination Selector & Reset Filter */}
          <div className="flex items-center gap-2">
            {/* Destination Dropdown */}
            <div className="relative">
              <select
                value={filters.selectedDestinations[0] || 'ALL'}
                onChange={(e) => onDestinationChange(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-slate-950/80 border border-slate-700/80 dark:bg-slate-950 dark:border-slate-700 light:bg-slate-50 light:border-slate-300 text-slate-200 light:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value="ALL">Destination: All ({allDestinations.length} Countries)</option>
                {allDestinations.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <Globe className="w-3.5 h-3.5 text-blue-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters Button */}
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({totalActiveFilters})</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Tags Chips Row */}
        {(filters.selectedShippers.length > 0 ||
          filters.selectedCustomers.length > 0 ||
          filters.selectedTransitDelays.length > 0 ||
          filters.selectedClearanceDelays.length > 0 ||
          filters.selectedDestinationDelays.length > 0 ||
          filters.selectedFinalResolutions.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 light:text-slate-600 mr-1 flex items-center gap-1">
              Active Filters:
              <span
                className={`text-[10px] uppercase px-1.5 py-0.2 rounded font-mono font-bold ${
                  filters.filterMode === 'include'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                Mode: {filters.filterMode === 'include' ? 'Include Only' : 'Filter Out (Exclude)'}
              </span>
            </span>

            {/* Shipper tags */}
            {filters.selectedShippers.map((shipper) => (
              <span
                key={shipper}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  filters.filterMode === 'include'
                    ? 'bg-blue-900/30 text-blue-300 border-blue-700/50'
                    : 'bg-rose-900/30 text-rose-300 border-rose-700/50'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span className="max-w-[200px] truncate">{shipper}</span>
                <button
                  type="button"
                  onClick={() => onRemoveShipper(shipper)}
                  className="hover:text-white p-0.5 rounded-full hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Customer tags */}
            {filters.selectedCustomers.map((cust) => (
              <span
                key={cust}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-900/30 text-emerald-300 border border-emerald-700/50"
              >
                <Users className="w-3 h-3" />
                <span className="max-w-[200px] truncate">{cust}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCustomer(cust)}
                  className="hover:text-white p-0.5 rounded-full hover:bg-slate-700/50 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* TT Range tags */}
            {filters.selectedTTRanges.map((tt) => (
              <span
                key={tt}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-900/30 text-emerald-300 border border-emerald-700/50"
              >
                ⏱️ Timeline: {tt}
              </span>
            ))}

            {/* Final Resolution tags */}
            {filters.selectedFinalResolutions.map((res) => (
              <span
                key={res}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/50"
              >
                🛡️ Resolution: {res}
              </span>
            ))}

            {/* Delay drilldown tags */}
            {filters.selectedTransitDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-900/30 text-indigo-300 border border-indigo-700/50"
              >
                ✈️ Transit Delay: {d}
              </span>
            ))}
            {filters.selectedClearanceDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-900/30 text-amber-300 border border-amber-700/50"
              >
                📋 Clearance: {d}
              </span>
            ))}
            {filters.selectedDestinationDelays.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-900/30 text-orange-300 border border-orange-700/50"
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
