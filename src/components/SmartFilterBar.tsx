import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Globe,
  Check,
  ChevronDown,
  Search
} from 'lucide-react';
import { FilterState, Shipment } from '../types/logistics';
import { searchCustomers } from '../utils/analytics';

interface SmartFilterBarProps {
  rawShipments: Shipment[];
  filters: FilterState;
  onCustomerChange: (customer: string) => void;
  onDestinationChange: (dest: string) => void;
  onResetFilters?: () => void;
  allCustomers?: string[];
  allDestinations?: string[];
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  rawShipments,
  filters,
  onCustomerChange,
  onDestinationChange,
  allCustomers = [],
  allDestinations = []
}) => {
  // 1. Customer Search Bar State
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // 2. Destination Search Bar State
  const [destSearch, setDestSearch] = useState<string>('');
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState<boolean>(false);
  const destDropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
        setIsDestDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute matching autocomplete customer items based on query
  const matchingCustomers = useMemo(() => {
    return searchCustomers(rawShipments, customerSearch, 30);
  }, [rawShipments, customerSearch]);

  const selectedCustomer = filters.selectedCustomers[0] || null;

  // Compute selected customer count
  const selectedCustomerCount = useMemo(() => {
    if (!selectedCustomer) return 0;
    return rawShipments.filter(
      (s) => (s.customer || '').trim().toLowerCase() === selectedCustomer.trim().toLowerCase()
    ).length;
  }, [rawShipments, selectedCustomer]);

  const handleSelectCustomer = (name: string) => {
    onCustomerChange(name);
    setCustomerSearch('');
    setIsCustomerDropdownOpen(false);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsCustomerDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingCustomers.length > 0) {
        handleSelectCustomer(matchingCustomers[0].name);
      }
    }
  };

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

  // Filter destination list based on query
  const filteredDestinations = useMemo(() => {
    if (!destSearch.trim()) return allDestinations;
    const q = destSearch.trim().toUpperCase();
    return allDestinations.filter((code) => code.includes(q));
  }, [allDestinations, destSearch]);

  const selectedDestination = filters.selectedDestinations[0] || null;

  const handleSelectDestination = (code: string) => {
    onDestinationChange(code);
    setDestSearch('');
    setIsDestDropdownOpen(false);
  };

  const handleDestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDestDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDestinations.length > 0) {
        handleSelectDestination(filteredDestinations[0]);
      }
    }
  };

  // Helper to highlight matching text
  const highlightMatch = (text: string, query: string, colorClass: string) => {
    if (!query || !query.trim()) return text;
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return text;

    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
        <span key={i} className={`${colorClass} font-extrabold underline`}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const totalDistinctCustomersCount = allCustomers.length > 0 ? allCustomers.length : 1082;
  const totalDestinationsCount = allDestinations.length > 0 ? allDestinations.length : 127;

  return (
    <div className="sticky top-16 z-30 w-full bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl border-y border-slate-200 dark:border-slate-800/90 py-3 px-3 sm:px-6 lg:px-8 shadow-md transition-colors duration-200">
      <div className="max-w-[1700px] mx-auto">
        
        {/* Main Controls: Customer & Destination Search Bars side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* 1. CUSTOMER SEARCH BAR */}
          <div className="relative w-full" ref={customerDropdownRef}>
            <div className="relative flex items-center">
              
              {/* Customer Users Icon */}
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Customer Text Search Input */}
              <input
                ref={customerInputRef}
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setIsCustomerDropdownOpen(true);
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                onKeyDown={handleCustomerKeyDown}
                placeholder={
                  selectedCustomer
                    ? `Customer: ${selectedCustomer} (${selectedCustomerCount.toLocaleString()} AWBs)`
                    : 'Type here Customer Name'
                }
                className={`w-full pl-10 pr-24 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                  selectedCustomer
                    ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-500/60 dark:text-emerald-200 placeholder:text-emerald-800 dark:placeholder:text-emerald-300'
                    : 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:italic placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />

              {/* Right side controls: Clear X and Chevron */}
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                {customerSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearch('');
                      customerInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear customer search input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : selectedCustomer ? (
                  <button
                    type="button"
                    onClick={() => onCustomerChange('ALL')}
                    className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Reset customer to All"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                  title="Toggle customer list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Customer Autocomplete Dropdown List */}
            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-emerald-900/20 divide-y divide-slate-100 dark:divide-slate-800">
                
                {/* Header summary in dropdown */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Search className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      {customerSearch.trim()
                        ? `Matching Customers for "${customerSearch}"`
                        : `All Customers (${totalDistinctCustomersCount.toLocaleString()} Total)`}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                    {matchingCustomers.length} shown
                  </span>
                </div>

                {/* All Customers Option */}
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectCustomer('ALL')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-all cursor-pointer ${
                      !selectedCustomer
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                        : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!selectedCustomer ? (
                        <Check className="w-4 h-4 text-emerald-500 font-bold" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                      )}
                      <span className="font-bold">All Customers ({totalDistinctCustomersCount.toLocaleString()} Total)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {rawShipments.length.toLocaleString()} AWBs
                    </span>
                  </button>
                </div>

                {/* Customer List Options */}
                <div className="p-1.5 space-y-0.5">
                  {matchingCustomers.map((item) => {
                    const isSelected = selectedCustomer === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelectCustomer(item.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/25'
                            : 'text-slate-800 hover:bg-emerald-50/70 dark:text-slate-200 dark:hover:bg-slate-800/90'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white font-bold shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                          )}
                          <span className={`truncate ${isSelected ? 'text-white' : 'group-hover:text-emerald-600 dark:group-hover:text-emerald-300'}`}>
                            {highlightMatch(item.name, customerSearch, 'text-emerald-600 dark:text-emerald-400')}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 group-hover:bg-emerald-200'
                        }`}>
                          {item.count.toLocaleString()} AWBs
                        </span>
                      </button>
                    );
                  })}

                  {matchingCustomers.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-semibold">No customer found matching &quot;{customerSearch}&quot;</p>
                      <p className="text-[11px] text-slate-500">Try searching for partial names or check spelling.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* 2. DESTINATION SEARCH BAR */}
          <div className="relative w-full" ref={destDropdownRef}>
            <div className="relative flex items-center">
              
              {/* Destination Globe Icon */}
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </div>

              {/* Destination Text Search Input */}
              <input
                ref={destInputRef}
                type="text"
                value={destSearch}
                onChange={(e) => {
                  setDestSearch(e.target.value);
                  setIsDestDropdownOpen(true);
                }}
                onFocus={() => setIsDestDropdownOpen(true)}
                onKeyDown={handleDestKeyDown}
                placeholder={
                  selectedDestination
                    ? `Destination: ${selectedDestination} (${(destinationCounts.get(selectedDestination) || 0).toLocaleString()} AWBs)`
                    : 'Type Here Destination'
                }
                className={`w-full pl-10 pr-24 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                  selectedDestination
                    ? 'bg-blue-50/70 border-blue-400 text-blue-900 dark:bg-blue-950/40 dark:border-blue-500/60 dark:text-blue-200 placeholder:text-blue-800 dark:placeholder:text-blue-300'
                    : 'bg-slate-50 border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 placeholder:italic placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500'
                }`}
              />

              {/* Right side controls: Clear X and Chevron */}
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                {destSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDestSearch('');
                      destInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear destination search input"
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
                  onClick={() => setIsDestDropdownOpen(!isDestDropdownOpen)}
                  className="p-1 text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                  title="Toggle destination list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDestDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Destination Autocomplete Dropdown List */}
            {isDestDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-blue-900/25 divide-y divide-slate-100 dark:divide-slate-800">
                
                {/* Header summary in dropdown */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center justify-between sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Search className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      {destSearch.trim()
                        ? `Matching Destinations for "${destSearch.toUpperCase()}"`
                        : `All Destinations (${totalDestinationsCount} Total)`}
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
                      <span className="font-bold">All Destinations ({totalDestinationsCount} Countries)</span>
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25'
                            : 'text-slate-800 hover:bg-blue-50/70 dark:text-slate-200 dark:hover:bg-slate-800/90'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white font-bold shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
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
    </div>
  );
};
