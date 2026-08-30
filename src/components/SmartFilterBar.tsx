import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  RotateCcw,
  Globe,
  Users,
  ChevronDown,
  Building2,
  Sparkles,
  Layers,
  Check
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
  const [searchTarget, setSearchTarget] = useState<'all' | 'customer' | 'shipper'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Destination Searchable Combobox State
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute matching autocomplete items based on query
  const matchingCustomers = useMemo(() => {
    if (searchTarget === 'shipper') return [];
    return searchCustomers(rawShipments, searchInput, 15);
  }, [rawShipments, searchInput, searchTarget]);

  const matchingShippers = useMemo(() => {
    if (searchTarget === 'customer') return [];
    return searchShippers(rawShipments, searchInput, 15);
  }, [rawShipments, searchInput, searchTarget]);

  const totalResultsCount = matchingCustomers.length + matchingShippers.length;

  const handleSelectCustomer = (name: string) => {
    onAddCustomer(name);
    setSearchInput('');
    setIsDropdownOpen(false);
  };

  const handleSelectShipper = (name: string) => {
    onAddShipper(name);
    setSearchInput('');
    setIsDropdownOpen(false);
  };

  // Keyboard navigation & Enter key submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingCustomers.length > 0 && (searchTarget === 'customer' || searchTarget === 'all')) {
        handleSelectCustomer(matchingCustomers[0].name);
      } else if (matchingShippers.length > 0 && (searchTarget === 'shipper' || searchTarget === 'all')) {
        handleSelectShipper(matchingShippers[0].name);
      }
    }
  };

  // Destination Counts & Filtering
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

  const filteredDestinations = useMemo(() => {
    if (!destSearch.trim()) return allDestinations;
    const q = destSearch.trim().toUpperCase();
    return allDestinations.filter((code) => code.includes(q));
  }, [allDestinations, destSearch]);

  const selectedDestination = filters.selectedDestinations[0] || null;

  // Helper to highlight matching text in suggestions
  const highlightMatch = (text: string, query: string) => {
    if (!query || !query.trim()) return text;
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;
    
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
        <span key={i} className="text-blue-600 dark:text-blue-400 font-extrabold underline decoration-blue-500/50">
          {part}
        </span>
      ) : (
        part
      )
    );
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
      <div className="max-w-[1700px] mx-auto space-y-3">
        
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Universal Search with Autocomplete Dropdown */}
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                </div>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    searchTarget === 'customer'
                      ? 'Search Customer accounts (e.g. "Epic", "Motijheel", "Classic", "Liz")...'
                      : searchTarget === 'shipper'
                      ? 'Search Shipper names (e.g. "Four", "Elite", "Fashion", "Triple A")...'
                      : 'Search any Customer account or Shipper name...'
                  }
                  className="w-full pl-10 pr-52 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
                />

                {/* Match count badge inside input when typing */}
                {searchInput.trim() && (
                  <div className="absolute right-40 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold border border-blue-500/30 pointer-events-none">
                    <span>{totalResultsCount} found</span>
                  </div>
                )}

                {/* Clear search 'X' button if text exists */}
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-36 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Clear search input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                
                {/* Search Target Switcher Tabs Pill */}
                <div className="absolute inset-y-1 right-1 flex items-center bg-slate-200/80 dark:bg-slate-800/90 p-0.5 rounded-lg border border-slate-300/60 dark:border-slate-700/80 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSearchTarget('all')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      searchTarget === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title="Search across all Customers and Shippers"
                  >
                    <Layers className="w-3 h-3" />
                    <span>All</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchTarget('customer')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      searchTarget === 'customer'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title="Filter search to Customers only"
                  >
                    <Users className="w-3 h-3" />
                    <span>Customer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchTarget('shipper')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                      searchTarget === 'shipper'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title="Filter search to Shippers only"
                  >
                    <Building2 className="w-3 h-3" />
                    <span>Shipper</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Universal Autocomplete Dropdown List */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-blue-900/20 divide-y divide-slate-100 dark:divide-slate-800">
                
                {/* Header summary in dropdown */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    {searchInput.trim() ? (
                      <span>Search Results for &quot;{searchInput}&quot;</span>
                    ) : (
                      <span>Top Volume Accounts &amp; Shippers (Quick Pick)</span>
                    )}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                    {totalResultsCount} results available
                  </span>
                </div>

                {/* 1. CUSTOMER RESULTS SECTION */}
                {matchingCustomers.length > 0 && (searchTarget === 'all' || searchTarget === 'customer') && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Customer Accounts ({matchingCustomers.length})</span>
                      </div>
                      <span className="text-[9px] font-normal text-slate-400">Click to filter dashboard</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {matchingCustomers.map((item) => {
                        const isSelected = filters.selectedCustomers.includes(item.name);
                        return (
                          <button
                            key={`cust-${item.name}`}
                            type="button"
                            onClick={() => handleSelectCustomer(item.name)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                                : 'text-slate-800 hover:bg-emerald-50/70 dark:text-slate-200 dark:hover:bg-slate-800/90'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 font-bold" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                              )}
                              <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                                {highlightMatch(item.name, searchInput)}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/80">
                              {item.count.toLocaleString()} AWBs
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. SHIPPER RESULTS SECTION */}
                {matchingShippers.length > 0 && (searchTarget === 'all' || searchTarget === 'shipper') && (
                  <div className="p-2">
                    <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-black text-blue-600 dark:text-blue-400 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Shipper Names ({matchingShippers.length})</span>
                      </div>
                      <span className="text-[9px] font-normal text-slate-400">Click to filter dashboard</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      {matchingShippers.map((item) => {
                        const isSelected = filters.selectedShippers.includes(item.name);
                        return (
                          <button
                            key={`shpr-${item.name}`}
                            type="button"
                            onClick={() => handleSelectShipper(item.name)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                              isSelected
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold border border-blue-500/40 shadow-sm'
                                : 'text-slate-800 hover:bg-blue-50/70 dark:text-slate-200 dark:hover:bg-slate-800/90'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 font-bold" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                              )}
                              <span className="truncate group-hover:text-blue-600 dark:group-hover:text-blue-300">
                                {highlightMatch(item.name, searchInput)}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/80">
                              {item.count.toLocaleString()} AWBs
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No results message */}
                {totalResultsCount === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <p className="font-semibold">No accounts found matching &quot;{searchInput}&quot;</p>
                    <p className="text-[11px] text-slate-400">Try searching for partial keywords or check your spelling.</p>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Destination Searchable Combobox (Writing search box + dropdown box together) & Reset Filter */}
          <div className="flex items-center gap-2">
            
            {/* Searchable Destination Combobox */}
            <div className="relative" ref={destDropdownRef}>
              <div className="relative min-w-[210px] sm:min-w-[250px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
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
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsDestDropdownOpen(false);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredDestinations.length > 0) {
                        onDestinationChange(filteredDestinations[0]);
                        setDestSearch('');
                        setIsDestDropdownOpen(false);
                      }
                    }
                  }}
                  placeholder={
                    selectedDestination
                      ? `Destination: ${selectedDestination}`
                      : 'Search Dest (e.g. US, DE)...'
                  }
                  className="w-full pl-8 pr-16 py-2.5 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-800 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-all"
                />

                {/* Right controls: Clear X and Chevron Dropdown Toggle */}
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                  {selectedDestination && !destSearch && (
                    <button
                      type="button"
                      onClick={() => onDestinationChange('ALL')}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Clear destination filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {destSearch && (
                    <button
                      type="button"
                      onClick={() => setDestSearch('')}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Clear search text"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Toggle destinations list"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDestDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Destination Dropdown Box / List */}
              {isDestDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-72 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-blue-900/20 divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Dropdown Header */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span>{destSearch.trim() ? `Matching: "${destSearch.toUpperCase()}"` : 'Select Destination'}</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                      {filteredDestinations.length} countries
                    </span>
                  </div>

                  {/* All Destinations Option */}
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onDestinationChange('ALL');
                        setDestSearch('');
                        setIsDestDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                        !selectedDestination
                          ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold border border-blue-500/40 shadow-sm'
                          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!selectedDestination ? (
                          <Check className="w-3.5 h-3.5 text-blue-500 font-bold" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                        <span>All Destinations ({allDestinations.length} Countries)</span>
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
                          onClick={() => {
                            onDestinationChange(code);
                            setDestSearch('');
                            setIsDestDropdownOpen(false);
                          }}
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
                      <div className="p-4 text-center text-xs text-slate-400">
                        No destination found matching &quot;{destSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reset Filters Button */}
            {totalActiveFilters > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({totalActiveFilters})</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Active Filters Chips Row */}
        {totalActiveFilters > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1.5">
              Active Filters:
            </span>

            {/* Customer tags (Emerald) */}
            {filters.selectedCustomers.map((cust) => (
              <span
                key={cust}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60 shadow-sm"
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[220px] truncate">Customer: {cust}</span>
                <button
                  type="button"
                  onClick={() => onRemoveCustomer(cust)}
                  className="hover:text-slate-900 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  title="Remove customer filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Shipper tags (Blue) */}
            {filters.selectedShippers.map((shipper) => (
              <span
                key={shipper}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/60 shadow-sm"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[220px] truncate">Shipper: {shipper}</span>
                <button
                  type="button"
                  onClick={() => onRemoveShipper(shipper)}
                  className="hover:text-slate-900 dark:hover:text-white p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  title="Remove shipper filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Destination tags */}
            {filters.selectedDestinations.map((dest) => (
              <span
                key={dest}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-700/60 shadow-sm"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Dest: {dest}</span>
                <button
                  type="button"
                  onClick={() => onDestinationChange('ALL')}
                  className="p-0.5 rounded-full hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* TT Range tags */}
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
