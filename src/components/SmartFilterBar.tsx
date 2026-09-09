import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Globe,
  Check,
  ChevronDown,
  Search,
  RotateCcw,
  Shield,
  Package,
  CreditCard,
  Plane
} from 'lucide-react';
import { FilterState, Shipment, CategoryTypeFilter } from '../types/logistics';
import { searchCustomers } from '../utils/analytics';

interface SmartFilterBarProps {
  rawShipments: Shipment[];
  filters: FilterState;
  onCustomerChange: (customer: string | string[]) => void;
  onDestinationChange: (dest: string | string[]) => void;
  onCustomerToggle?: (customer: string) => void;
  onDestinationToggle?: (dest: string) => void;
  onCategoryTypeChange?: (categoryType: CategoryTypeFilter) => void;
  onResetFilters?: () => void;
  allCustomers?: string[];
  allDestinations?: string[];
}

export const SmartFilterBar: React.FC<SmartFilterBarProps> = ({
  rawShipments,
  filters,
  onCustomerChange,
  onDestinationChange,
  onCustomerToggle,
  onDestinationToggle,
  onCategoryTypeChange,
  onResetFilters,
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

  // Current selections
  const selectedCustomers = filters.selectedCustomers || [];
  const selectedDestinations = filters.selectedDestinations || [];

  // Compute matching autocomplete customer items based on query
  const matchingCustomers = useMemo(() => {
    return searchCustomers(rawShipments, customerSearch, 30);
  }, [rawShipments, customerSearch]);

  const handleToggleCustomer = (name: string) => {
    if (name === 'ALL') {
      onCustomerChange('ALL');
      setCustomerSearch('');
      return;
    }
    if (onCustomerToggle) {
      onCustomerToggle(name);
    } else {
      const exists = selectedCustomers.includes(name);
      onCustomerChange(exists ? selectedCustomers.filter((c) => c !== name) : [...selectedCustomers, name]);
    }
  };

  const handleClearCustomers = () => {
    onCustomerChange('ALL');
    setCustomerSearch('');
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsCustomerDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingCustomers.length > 0) {
        handleToggleCustomer(matchingCustomers[0].name);
        setCustomerSearch('');
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

  const handleToggleDestination = (code: string) => {
    if (code === 'ALL') {
      onDestinationChange('ALL');
      setDestSearch('');
      return;
    }
    const upper = code.toUpperCase();
    if (onDestinationToggle) {
      onDestinationToggle(upper);
    } else {
      const exists = selectedDestinations.includes(upper);
      onDestinationChange(exists ? selectedDestinations.filter((d) => d !== upper) : [...selectedDestinations, upper]);
    }
  };

  const handleClearDestinations = () => {
    onDestinationChange('ALL');
    setDestSearch('');
  };

  const handleDestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsDestDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDestinations.length > 0) {
        handleToggleDestination(filteredDestinations[0]);
        setDestSearch('');
      }
    }
  };

  const currentCategory = filters.selectedCategoryType || 'ALL';

  const agentCount = useMemo(() => {
    return rawShipments.filter((s) => s.isAgent ?? /agent/i.test(s.customer || '')).length;
  }, [rawShipments]);

  const ppCount = useMemo(() => {
    return rawShipments.filter((s) => {
      const t = (s.shipmentType || '').toUpperCase();
      return t === 'PP' || !t;
    }).length;
  }, [rawShipments]);

  const ccCount = useMemo(() => {
    return rawShipments.filter((s) => (s.shipmentType || '').toUpperCase() === 'CC').length;
  }, [rawShipments]);

  const ipdCount = useMemo(() => {
    return rawShipments.filter((s) => (s.shipmentType || '').toUpperCase() === 'IPD').length;
  }, [rawShipments]);

  // Total active filters count
  const totalActiveFilters =
    filters.selectedShippers.length +
    filters.selectedCustomers.length +
    filters.selectedDestinations.length +
    filters.selectedTransitDelays.length +
    filters.selectedClearanceDelays.length +
    filters.selectedDestinationDelays.length +
    filters.selectedFinalResolutions.length +
    filters.selectedTTRanges.length +
    (currentCategory !== 'ALL' ? 1 : 0);

  const handleReset = () => {
    setCustomerSearch('');
    setDestSearch('');
    if (onResetFilters) {
      onResetFilters();
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

  return (
    <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-xl border-y border-slate-200/90 dark:border-slate-800/80 py-3 px-3 sm:px-6 lg:px-8 shadow-sm">
      <div className="max-w-[1700px] mx-auto">
        
        {/* Main Controls: Customer Search, Destination Search & Reset Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {/* 1. CUSTOMER SEARCH BAR (Multi-select enabled with chips & interactive dropdown) */}
          <div className="relative flex-1 min-w-[280px] lg:min-w-[420px]" ref={customerDropdownRef}>
            <div
              onClick={() => {
                customerInputRef.current?.focus();
                setIsCustomerDropdownOpen(true);
              }}
              className={`relative flex items-center flex-wrap gap-1.5 pl-10 pr-20 py-1.5 min-h-[42px] rounded-xl border transition-all shadow-inner cursor-text ${
                selectedCustomers.length > 0
                  ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 dark:bg-emerald-950/35 dark:border-emerald-500/60 dark:text-emerald-100 ring-1 ring-emerald-500/20'
                  : 'bg-white border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 focus-within:ring-2 focus-within:ring-emerald-500/50'
              }`}
            >
              {/* Customer Users Icon */}
              <div className="absolute top-2.5 left-3 pointer-events-none text-slate-400">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Selected Customer Chips (shows first 2 with remove button) */}
              {selectedCustomers.slice(0, 2).map((cust) => (
                <span
                  key={cust}
                  className="inline-flex items-center gap-1 max-w-[170px] sm:max-w-[230px] px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200 text-xs font-bold shadow-xs shrink-0"
                >
                  <span className="truncate" title={cust}>{cust}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCustomer(cust);
                    }}
                    className="p-0.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-300 cursor-pointer transition-colors"
                    title={`Remove ${cust}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* +N More Badge if > 2 customers selected */}
              {selectedCustomers.length > 2 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-200/90 dark:bg-emerald-800/80 text-emerald-950 dark:text-emerald-100 text-[11px] font-extrabold shrink-0 shadow-xs"
                  title={selectedCustomers.slice(2).join('\n')}
                >
                  +{selectedCustomers.length - 2} more
                </span>
              )}

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
                  selectedCustomers.length > 0
                    ? 'Add more...'
                    : 'Search Customer by name...'
                }
                className="flex-1 min-w-[90px] bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:italic placeholder:font-medium py-1"
              />

              {/* Right side controls: Count badge, Clear X, and Chevron */}
              <div className="absolute top-2 right-2.5 flex items-center gap-1.5 pointer-events-auto">
                {customerSearch ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerSearch('');
                      customerInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : selectedCustomers.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearCustomers();
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer"
                    title="Clear all selected customers"
                  >
                    <X className="w-3 h-3" />
                    <span className="text-[10px] font-extrabold">{selectedCustomers.length}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCustomerDropdownOpen(!isCustomerDropdownOpen);
                  }}
                  className="p-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                  title="Toggle customer list"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Customer Autocomplete Dropdown List (Expanded width to show complete customer names) */}
            {isCustomerDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-full min-w-[340px] sm:min-w-[540px] lg:min-w-[680px] max-w-[95vw] max-h-96 overflow-y-auto z-[100] rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-700 shadow-2xl shadow-emerald-900/20 divide-y divide-slate-100 dark:divide-slate-800">
                
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
                  <div className="flex items-center gap-2">
                    {selectedCustomers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCustomers}
                        className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Reset to All
                      </button>
                    )}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                      {matchingCustomers.length} shown
                    </span>
                  </div>
                </div>

                {/* All Customers Option */}
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={handleClearCustomers}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition-all cursor-pointer ${
                      selectedCustomers.length === 0
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                        : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        selectedCustomers.length === 0
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {selectedCustomers.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
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
                    const isSelected = selectedCustomers.includes(item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleToggleCustomer(item.name)}
                        title={item.name}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-left transition-all cursor-pointer group gap-3 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 font-bold border border-emerald-500/40 shadow-sm'
                            : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-emerald-500'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className={`break-words leading-relaxed ${isSelected ? 'font-bold text-emerald-950 dark:text-emerald-200' : 'font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-300'}`}>
                            {highlightMatch(item.name, customerSearch, 'text-emerald-600 dark:text-emerald-400 font-bold')}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md shrink-0 self-start mt-0.5 transition-colors ${
                          isSelected
                            ? 'bg-emerald-200/80 text-emerald-950 dark:bg-emerald-800/80 dark:text-emerald-100'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950'
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

                {/* Sticky Footer: Summary & Done button */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 z-10 backdrop-blur-md">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {selectedCustomers.length > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedCustomers.length} Customer{selectedCustomers.length > 1 ? 's' : ''} Selected</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">All Customers included</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedCustomers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCustomers}
                        className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(false)}
                      className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 2. DESTINATION SEARCH BAR (Multi-select enabled with chips & interactive dropdown) */}
          <div className="relative w-full sm:w-64 lg:w-72 shrink-0" ref={destDropdownRef}>
            <div
              onClick={() => {
                destInputRef.current?.focus();
                setIsDestDropdownOpen(true);
              }}
              className={`relative flex items-center flex-wrap gap-1.5 pl-10 pr-20 py-1.5 min-h-[42px] rounded-xl border transition-all shadow-inner cursor-text ${
                selectedDestinations.length > 0
                  ? 'bg-blue-50/70 border-blue-400 text-blue-950 dark:bg-blue-950/35 dark:border-blue-500/60 dark:text-blue-100 ring-1 ring-blue-500/20'
                  : 'bg-white border-slate-300 text-slate-900 dark:bg-slate-950 dark:border-slate-700/80 dark:text-slate-100 focus-within:ring-2 focus-within:ring-blue-500/50'
              }`}
            >
              {/* Destination Globe Icon */}
              <div className="absolute top-2.5 left-3 pointer-events-none text-slate-400">
                <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </div>

              {/* Selected Destination Chips (shows first 2 with remove button) */}
              {selectedDestinations.slice(0, 2).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700/80 text-blue-950 dark:text-blue-200 text-xs font-mono font-bold shadow-xs shrink-0"
                >
                  <span>{code}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDestination(code);
                    }}
                    className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-300 cursor-pointer transition-colors"
                    title={`Remove ${code}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* +N More Badge if > 2 destinations selected */}
              {selectedDestinations.length > 2 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-200/90 dark:bg-blue-800/80 text-blue-950 dark:text-blue-100 text-[11px] font-extrabold shrink-0 shadow-xs"
                  title={selectedDestinations.slice(2).join(', ')}
                >
                  +{selectedDestinations.length - 2} more
                </span>
              )}

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
                  selectedDestinations.length > 0
                    ? 'Add...'
                    : 'Search Destination'
                }
                className="flex-1 min-w-[70px] bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:italic placeholder:font-medium py-1"
              />

              {/* Right side controls: Count badge, Clear X, and Chevron */}
              <div className="absolute top-2 right-2.5 flex items-center gap-1.5 pointer-events-auto">
                {destSearch ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDestSearch('');
                      destInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear search text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : selectedDestinations.length > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearDestinations();
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer"
                    title="Clear all selected destinations"
                  >
                    <X className="w-3 h-3" />
                    <span className="text-[10px] font-extrabold">{selectedDestinations.length}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDestDropdownOpen(!isDestDropdownOpen);
                  }}
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
                        : 'All Destination'}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedDestinations.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDestinations}
                        className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                      >
                        Reset to All
                      </button>
                    )}
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                      {filteredDestinations.length} available
                    </span>
                  </div>
                </div>

                {/* All Destinations Option */}
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={handleClearDestinations}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                      selectedDestinations.length === 0
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold border border-blue-500/40 shadow-sm'
                        : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        selectedDestinations.length === 0
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {selectedDestinations.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="font-bold">All Destination</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {rawShipments.length.toLocaleString()} AWBs
                    </span>
                  </button>
                </div>

                {/* Country List Options */}
                <div className="p-1.5 space-y-0.5">
                  {filteredDestinations.map((code) => {
                    const isSelected = selectedDestinations.includes(code);
                    const count = destinationCounts.get(code) || 0;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => handleToggleDestination(code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 font-bold border border-blue-500/40 shadow-sm'
                            : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-blue-500'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="font-mono font-extrabold">{code}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-blue-200/80 text-blue-950 dark:bg-blue-800/80 dark:text-blue-100'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-950'
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

                {/* Sticky Footer: Summary & Done button */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between sticky bottom-0 z-10 backdrop-blur-md">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {selectedDestinations.length > 0 ? (
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedDestinations.length} Destination{selectedDestinations.length > 1 ? 's' : ''} Selected</span>
                    ) : (
                      <span className="text-slate-400 font-normal italic">All Destinations included</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedDestinations.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDestinations}
                        className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDestDropdownOpen(false)}
                      className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* 3. CATEGORY SWITCH BUTTONS: ALL, AGENT, PP, CC */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-inner shrink-0 overflow-x-auto">
            {/* All */}
            <button
              type="button"
              onClick={() => onCategoryTypeChange?.('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentCategory === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-300 dark:border-slate-700 font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Show All Shipments"
            >
              All
            </button>

            {/* Agent Button */}
            <button
              type="button"
              onClick={() => onCategoryTypeChange?.(currentCategory === 'AGENT' ? 'ALL' : 'AGENT')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentCategory === 'AGENT'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 ring-2 ring-purple-400 font-black'
                  : 'text-slate-700 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400 hover:bg-purple-500/10'
              }`}
              title="Click to show only Agent shipments"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Agent</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                currentCategory === 'AGENT'
                  ? 'bg-white/25 text-white'
                  : 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300'
              }`}>
                {agentCount.toLocaleString()}
              </span>
            </button>

            {/* PP Button */}
            <button
              type="button"
              onClick={() => onCategoryTypeChange?.(currentCategory === 'PP' ? 'ALL' : 'PP')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentCategory === 'PP'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400 font-black'
                  : 'text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 hover:bg-blue-500/10'
              }`}
              title="Click to show PP (Prepaid) shipments"
            >
              <Package className="w-3.5 h-3.5" />
              <span>PP</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                currentCategory === 'PP'
                  ? 'bg-white/25 text-white'
                  : 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
              }`}>
                {ppCount.toLocaleString()}
              </span>
            </button>

            {/* CC Button */}
            <button
              type="button"
              onClick={() => onCategoryTypeChange?.(currentCategory === 'CC' ? 'ALL' : 'CC')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentCategory === 'CC'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400 font-black'
                  : 'text-slate-700 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-amber-500/10'
              }`}
              title="Click to show CC (Charges Collect) shipments"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>CC</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                currentCategory === 'CC'
                  ? 'bg-white/25 text-white'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
              }`}>
                {ccCount.toLocaleString()}
              </span>
            </button>

            {/* IPD Button */}
            <button
              type="button"
              onClick={() => onCategoryTypeChange?.(currentCategory === 'IPD' ? 'ALL' : 'IPD')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentCategory === 'IPD'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400 font-black'
                  : 'text-slate-700 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title="Click to show IPD (International Priority DirectDistribution) shipments"
            >
              <Plane className="w-3.5 h-3.5" />
              <span>IPD</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                currentCategory === 'IPD'
                  ? 'bg-white/25 text-white'
                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
              }`}>
                {ipdCount.toLocaleString()}
              </span>
            </button>
          </div>

          {/* 4. RESET BUTTON */}
          <button
            type="button"
            onClick={handleReset}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 border ${
              totalActiveFilters > 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25 hover:scale-[1.02]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 hover:scale-[1.02]'
            }`}
            title="Reset all search queries and active filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Reset{totalActiveFilters > 0 ? ` (${totalActiveFilters})` : ''}</span>
          </button>

        </div>

      </div>
    </div>
  );
};
