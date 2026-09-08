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
      {/* Date Range Bar */}
      <div
        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-2xl border transition-all duration-200 shadow-sm ${
          isFilterActive
            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400/60 dark:border-blue-500/50 ring-2 ring-blue-500/20'
            : isPendingSecondDate
            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400/60 dark:border-amber-500/50 ring-1 ring-amber-400/20'
            : 'bg-slate-100/90 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        {/* FROM DATE TAB BUTTON */}
        <button
          type="button"
          onClick={() => openPicker(activePicker === 'from' ? null as any : 'from')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activePicker === 'from'
              ? 'bg-blue-600 text-white border-blue-500 shadow-sm ring-2 ring-blue-400/30'
              : startInput
              ? 'bg-white dark:bg-slate-950 border-blue-400/50 dark:border-blue-500/40 text-blue-600 dark:text-blue-400'
              : 'bg-white/80 dark:bg-slate-950/70 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-400'
          }`}
          title="Click to choose From Date"
        >
          <span className={`text-[10px] uppercase font-black tracking-wider ${
            activePicker === 'from' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
          }`}>
            From
          </span>
          <span className="font-semibold tracking-tight">
            {formatDateDisplay(startInput) || 'Select Date'}
          </span>
        </button>

        {/* Separator Arrow */}
        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />

        {/* TO DATE TAB BUTTON */}
        <button
          type="button"
          onClick={() => openPicker(activePicker === 'to' ? null as any : 'to')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activePicker === 'to'
              ? 'bg-blue-600 text-white border-blue-500 shadow-sm ring-2 ring-blue-400/30'
              : endInput
              ? 'bg-white dark:bg-slate-950 border-blue-400/50 dark:border-blue-500/40 text-blue-600 dark:text-blue-400'
              : 'bg-white/80 dark:bg-slate-950/70 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-400'
          }`}
          title="Click to choose To Date"
        >
          <span className={`text-[10px] uppercase font-black tracking-wider ${
            activePicker === 'to' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
          }`}>
            To
          </span>
          <span className="font-semibold tracking-tight">
            {formatDateDisplay(endInput) || 'Select Date'}
          </span>
        </button>

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

        {/* Instant Clear Button */}
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
          onClick={() => {
            setActivePicker(null);
            setIsPresetsOpen(!isPresetsOpen);
          }}
          className={`p-1 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
            isPresetsOpen ? 'rotate-180 text-blue-500' : ''
          }`}
          title="Quick date range presets"
        >
          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
        </button>
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
                    setActivePicker(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{p.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-500" />
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
