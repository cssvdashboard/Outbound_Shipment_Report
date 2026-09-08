import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  ArrowRight,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check
} from 'lucide-react';

interface DateRangePickerProps {
  dateRange: { start?: string; end?: string };
  onChange: (start: string, end: string) => void;
  availableDateRange?: { min: string; max: string };
  availablePickupDates?: Set<string>;
  totalFilteredCount?: number;
  totalRawCount?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parts[0];
  const m = parseInt(parts[1], 10) - 1;
  const d = parts[2];
  return `${d} ${MONTH_NAMES_SHORT[m] || parts[1]} ${y}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onChange,
  availableDateRange,
  availablePickupDates,
  totalFilteredCount
}) => {
  const [startInput, setStartInput] = useState<string>(dateRange.start || '');
  const [endInput, setEndInput] = useState<string>(dateRange.end || '');

  // Custom Calendar Popup State
  const [activePicker, setActivePicker] = useState<'from' | 'to' | null>(null);
  const [viewYear, setViewYear] = useState<number>(2026);
  const [viewMonth, setViewMonth] = useState<number>(7); // 7 = August (0-indexed)

  // Presets Dropdown
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state when parent dateRange updates
  useEffect(() => {
    setStartInput(dateRange.start || '');
    setEndInput(dateRange.end || '');
  }, [dateRange.start, dateRange.end]);

  // When opening picker, set view to existing date or default to August 2026
  const openPicker = (type: 'from' | 'to') => {
    setIsPresetsOpen(false);
    setActivePicker(type);
    const targetDate = type === 'from' ? startInput : (endInput || startInput);
    if (targetDate) {
      const [y, m] = targetDate.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
        return;
      }
    }
    // Default to August 2026
    setViewYear(2026);
    setViewMonth(7);
  };

  // Close calendar or presets when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePicker(null);
        setIsPresetsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDate = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const selectedIso = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (activePicker === 'from') {
      setStartInput(selectedIso);
      if (endInput) {
        onChange(selectedIso, endInput);
        setActivePicker(null);
      } else {
        // If end date is not chosen yet, automatically guide to selecting TO date
        setActivePicker('to');
      }
    } else if (activePicker === 'to') {
      setEndInput(selectedIso);
      if (startInput) {
        onChange(startInput, selectedIso);
        setActivePicker(null);
      } else {
        setActivePicker('from');
      }
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStartInput('');
    setEndInput('');
    onChange('', '');
    setActivePicker(null);
    setIsPresetsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const isFilterActive = Boolean(dateRange.start && dateRange.end);
  const isPendingSecondDate = Boolean(
    (startInput && !endInput) || (!startInput && endInput)
  );

  // Calendar Calculation for the current viewMonth & viewYear
  // 1. Day of week the month starts on (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // 2. Number of days in the month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const presets = [
    { label: 'July 2026 (Full Month)', start: '2026-07-01', end: '2026-07-31' },
    { label: 'August 2026 (Full Month)', start: '2026-08-01', end: '2026-08-31' }
  ];

  return (
    <div className="relative flex items-center" ref={containerRef}>
      {/* Date Range Bar - Elevated Command Capsule with Ambient Glow */}
      <div
        className={`group/bar flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 pl-2 sm:pl-2.5 rounded-2xl border transition-all duration-300 ${
          isFilterActive
            ? 'bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-sky-50/95 dark:from-blue-950/50 dark:via-indigo-950/40 dark:to-slate-900/80 border-blue-400 dark:border-blue-500/70 shadow-lg shadow-blue-500/15 ring-2 ring-blue-500/25'
            : isPendingSecondDate
            ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500/70 shadow-md shadow-amber-500/15 ring-2 ring-amber-400/30'
            : 'bg-white/95 dark:bg-[#0c1324]/95 border-slate-300 dark:border-slate-700/90 shadow-md shadow-slate-900/5 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/10 ring-1 ring-slate-200/80 dark:ring-slate-800'
        }`}
      >
        {/* FROM DATE TAB BUTTON */}
        <button
          type="button"
          onClick={() => openPicker(activePicker === 'from' ? null as any : 'from')}
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            activePicker === 'from'
              ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white border-blue-500 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.02]'
              : startInput
              ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-300 dark:border-sky-500/50 text-sky-800 dark:text-sky-300 hover:border-sky-400 hover:bg-sky-100/90'
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 hover:border-sky-400 hover:bg-sky-50/60 dark:hover:bg-slate-800'
          }`}
          title="Click to choose From Date"
        >
          <span className={`text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded ${
            activePicker === 'from'
              ? 'bg-white/20 text-white'
              : 'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40'
          }`}>
            From
          </span>
          <span className="font-extrabold tracking-tight text-xs sm:text-[13px]">
            {formatDateDisplay(startInput) || 'Select Date'}
          </span>
        </button>

        {/* Stylish Flow Connector */}
        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center shrink-0 shadow-xs">
          <ArrowRight className="w-3 h-3 text-sky-600 dark:text-sky-400" />
        </div>

        {/* TO DATE TAB BUTTON */}
        <button
          type="button"
          onClick={() => openPicker(activePicker === 'to' ? null as any : 'to')}
          className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            activePicker === 'to'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40 scale-[1.02]'
              : endInput
              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-500/50 text-indigo-800 dark:text-indigo-300 hover:border-indigo-400 hover:bg-indigo-100/90'
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/90 text-slate-800 dark:text-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-slate-800'
          }`}
          title="Click to choose To Date"
        >
          <span className={`text-[9px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded ${
            activePicker === 'to'
              ? 'bg-white/20 text-white'
              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40'
          }`}>
            To
          </span>
          <span className="font-extrabold tracking-tight text-xs sm:text-[13px]">
            {formatDateDisplay(endInput) || 'Select Date'}
          </span>
        </button>

        {/* Status Badge when filter is active */}
        {isFilterActive && totalFilteredCount !== undefined && (
          <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-[11px] font-black text-white shadow-sm shadow-blue-500/30">
            <span>{totalFilteredCount.toLocaleString()} AWBs</span>
          </div>
        )}

        {/* Warning Badge when only one date picked */}
        {isPendingSecondDate && (
          <span className="hidden lg:inline text-[10px] font-black text-amber-900 dark:text-amber-200 px-2 py-1 rounded-xl bg-amber-200/90 dark:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 animate-pulse">
            Pick both dates
          </span>
        )}

        {/* Presets Quick Dropdown Trigger */}
        <button
          type="button"
          onClick={() => {
            setActivePicker(null);
            setIsPresetsOpen(!isPresetsOpen);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
            isPresetsOpen
              ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/30'
              : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 shadow-xs'
          }`}
          title="Quick Month Presets (July / August 2026)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isPresetsOpen ? 'text-white' : 'text-sky-500 dark:text-sky-400'}`} />
          <span className="hidden md:inline tracking-tight">Month</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPresetsOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Instant Clear Button */}
        {(startInput || endInput) && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer shadow-xs"
            title="Reset date range filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* CUSTOM CALENDAR POPUP */}
      {activePicker && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700/90 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header: Currently editing label & Close */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Pick {activePicker === 'from' ? 'From' : 'To'} Date
            </span>

            <button
              type="button"
              onClick={() => setActivePicker(null)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close calendar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-black text-slate-800 dark:text-slate-100">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-slate-500 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid: ONLY contains dates of this specific month! */}
          {/* Days before 1st of the month are completely empty blanks! */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank spaces before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="w-8 h-8" />
            ))}

            {/* Days 1 to daysInMonth */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const formattedMonth = String(viewMonth + 1).padStart(2, '0');
              const formattedDay = String(day).padStart(2, '0');
              const cellIso = `${viewYear}-${formattedMonth}-${formattedDay}`;

              const hasPickupData = availablePickupDates
                ? availablePickupDates.has(cellIso)
                : Boolean(
                    availableDateRange?.min &&
                    availableDateRange?.max &&
                    cellIso >= availableDateRange.min &&
                    cellIso <= availableDateRange.max
                  );

              const isSelectedFrom = startInput === cellIso;
              const isSelectedTo = endInput === cellIso;
              const isSelected = activePicker === 'from' ? isSelectedFrom : isSelectedTo;
              const isInRange = Boolean(
                startInput &&
                endInput &&
                cellIso >= (startInput <= endInput ? startInput : endInput) &&
                cellIso <= (startInput <= endInput ? endInput : startInput)
              );

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  title={hasPickupData ? `${cellIso} (Pickup records available)` : `${cellIso} (No pickup records)`}
                  className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105 font-black ring-2 ring-blue-400/40'
                      : isSelectedFrom || isSelectedTo
                      ? 'bg-blue-500 text-white font-black'
                      : isInRange
                      ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-200 dark:hover:bg-blue-900/70'
                      : hasPickupData
                      ? 'font-black text-slate-950 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-600'
                      : 'font-normal text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <span className={hasPickupData ? 'font-black' : 'font-normal'}>{day}</span>
                </button>
              );
            })}
          </div>

          {/* Footer Controls & Legend in Calendar */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
              Bold = Has pickup data
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activePicker === 'from') {
                    setStartInput('');
                    if (!endInput) onChange('', '');
                  } else {
                    setEndInput('');
                    if (!startInput) onChange('', '');
                  }
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              >
                Clear {activePicker === 'from' ? 'From' : 'To'}
              </button>

              <button
                type="button"
                onClick={() => setActivePicker(null)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Presets Dropdown Menu */}
      {isPresetsOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 p-2 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            Quick Range Presets
          </div>

          <div className="py-1.5 space-y-1">
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
                    setActivePicker(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.01]'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800/90 hover:text-sky-600 dark:hover:text-sky-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-sky-500'}`} />
                    <span>{p.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-white" />
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
