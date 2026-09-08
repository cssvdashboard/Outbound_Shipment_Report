import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  ArrowRight,
  X,
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface DateRangePickerProps {
  dateRange: { start?: string; end?: string };
  onChange: (start: string, end: string) => void;
  availableDateRange?: { min: string; max: string };
  totalFilteredCount?: number;
  totalRawCount?: number;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onChange,
  availableDateRange,
  totalFilteredCount
}) => {
  const [startInput, setStartInput] = useState<string>(dateRange.start || '');
  const [endInput, setEndInput] = useState<string>(dateRange.end || '');
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Sync internal state when parent dateRange updates
  useEffect(() => {
    setStartInput(dateRange.start || '');
    setEndInput(dateRange.end || '');
  }, [dateRange.start, dateRange.end]);

  // Close presets dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(event.target as Node)) {
        setIsPresetsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartChange = (val: string) => {
    setStartInput(val);
    if (val && endInput) {
      onChange(val, endInput);
    } else if (!val && !endInput) {
      onChange('', '');
    }
  };

  const handleEndChange = (val: string) => {
    setEndInput(val);
    if (startInput && val) {
      onChange(startInput, val);
    } else if (!startInput && !val) {
      onChange('', '');
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStartInput('');
    setEndInput('');
    onChange('', '');
    setIsPresetsOpen(false);
  };

  const isFilterActive = Boolean(dateRange.start && dateRange.end);
  const isPendingSecondDate = Boolean(
    (startInput && !endInput) || (!startInput && endInput)
  );

  const presets = [
    { label: 'All Dates (Full Dataset)', start: '', end: '' },
    { label: 'July 2026 (Full Month)', start: '2026-07-01', end: '2026-07-31' },
    { label: 'August 2026 (Full Month)', start: '2026-08-01', end: '2026-08-31' },
    { label: 'July 1 – 15, 2026', start: '2026-07-01', end: '2026-07-15' },
    { label: 'July 16 – 31, 2026', start: '2026-07-16', end: '2026-07-31' },
    { label: 'August 1 – 15, 2026', start: '2026-08-01', end: '2026-08-15' },
    { label: 'August 16 – 31, 2026', start: '2026-08-16', end: '2026-08-31' }
  ];

  return (
    <div className="relative flex items-center" ref={presetsRef}>
      <div
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-2xl border transition-all duration-200 shadow-sm ${
          isFilterActive
            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400/60 dark:border-blue-500/50 ring-2 ring-blue-500/20'
            : isPendingSecondDate
            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400/60 dark:border-amber-500/50 ring-1 ring-amber-400/20'
            : 'bg-slate-100/90 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* Calendar Icon */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            isFilterActive
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
          title="Pickup Date Range Filter"
        >
          <Calendar className="w-3.5 h-3.5" />
        </div>

        {/* From Date Input */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 select-none">
            From
          </span>
          <input
            type="date"
            value={startInput}
            min={availableDateRange?.min}
            max={endInput || availableDateRange?.max}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-[118px] sm:w-[124px] text-xs font-bold text-slate-800 dark:text-slate-100 bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            title="Select Pickup start date"
          />
        </div>

        {/* Separator */}
        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />

        {/* To Date Input */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-500 select-none">
            To
          </span>
          <input
            type="date"
            value={endInput}
            min={startInput || availableDateRange?.min}
            max={availableDateRange?.max}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-[118px] sm:w-[124px] text-xs font-bold text-slate-800 dark:text-slate-100 bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            title="Select Pickup end date"
          />
        </div>

        {/* Status Badge when filter is active */}
        {isFilterActive && totalFilteredCount !== undefined && (
          <div className="hidden xl:flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-blue-100/90 dark:bg-blue-900/50 text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
            <span>{totalFilteredCount.toLocaleString()} AWBs</span>
          </div>
        )}

        {/* Warning Badge when only one date picked */}
        {isPendingSecondDate && (
          <span className="hidden lg:inline text-[10px] font-bold text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/60 animate-pulse">
            Pick both dates
          </span>
        )}

        {/* Clear Button */}
        {(startInput || endInput) && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title="Reset date range filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Presets Quick Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsPresetsOpen(!isPresetsOpen)}
          className={`p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
            isPresetsOpen ? 'rotate-180 text-blue-500' : ''
          }`}
          title="Quick date range presets"
        >
          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
        </button>
      </div>

      {/* Presets Dropdown Menu */}
      {isPresetsOpen && (
        <div className="absolute left-0 top-full mt-2 w-56 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-blue-500" />
            Quick Range Presets
          </div>

          <div className="py-1">
            {presets.map((p, idx) => {
              const isSelected =
                (!p.start && !p.end && !startInput && !endInput) ||
                (p.start === startInput && p.end === endInput);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setStartInput(p.start);
                    setEndInput(p.end);
                    onChange(p.start, p.end);
                    setIsPresetsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{p.label}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
