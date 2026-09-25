import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Lock,
  Unlock,
  KeyRound,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Building,
  Plane,
  FileText,
  Truck,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { useEditorAuth } from '../hooks/useEditorAuth';
import { formatExcelDate } from '../utils/formatters';

interface DelayReasonEditorModalProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    awb: string,
    updates: {
      transitDelay?: string;
      clearanceDelay?: string;
      destinationDelay?: string;
      weekendDelay?: string;
      remarks?: string;
      finalResolution?: string;
    }
  ) => Promise<{ success: boolean; error?: string } | void>;
  existingTransitDelays?: string[];
  existingClearanceDelays?: string[];
  existingDestinationDelays?: string[];
}

const CUSTOM_TRANSIT_KEY = 'mgh_custom_transit_delays';
const CUSTOM_CLEARANCE_KEY = 'mgh_custom_clearance_delays';
const CUSTOM_DESTINATION_KEY = 'mgh_custom_dest_delays';

function loadStoredDelays(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredDelays(key: string, items: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

const COMMON_TRANSIT_DELAYS = [
  'Transit Delay',
  'US Transit Delay',
  'CDG Transit Delay',
  'Gateway Delay',
  'Missort',
  'Was Untraceable at MEMH',
  'Was Untraceable at CDG'
];

const COMMON_CLEARANCE_DELAYS = [
  'Customs Inspection',
  'Invoice Missing',
  'Manufacturer Name & Address',
  'Clearance Authorization',
  'Fabric Measurement',
  'Insufficient Description',
  'Held for Duty Tax',
  'Unable To Locate Consignee'
];

const COMMON_DESTINATION_DELAYS = [
  'Incorrect Address',
  'Delay Attempt',
  'Unable to Collect Payment',
  'Business Closed',
  'Refused by Consignee',
  'Dispute POD',
  'Future Delivery',
  'ODA Delay',
  'Misdelivered',
  'Available For Pickup'
];

export const DelayReasonEditorModal: React.FC<DelayReasonEditorModalProps> = ({
  shipment,
  isOpen,
  onClose,
  onSave,
  existingTransitDelays,
  existingClearanceDelays,
  existingDestinationDelays
}) => {
  const { isEditor, login } = useEditorAuth();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Custom user-defined delay lists stored in browser
  const [customTransitDelays, setCustomTransitDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_TRANSIT_KEY));
  const [customClearanceDelays, setCustomClearanceDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_CLEARANCE_KEY));
  const [customDestinationDelays, setCustomDestinationDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_DESTINATION_KEY));

  // Form fields
  const [transitDelay, setTransitDelay] = useState('');
  const [clearanceDelay, setClearanceDelay] = useState('');
  const [destinationDelay, setDestinationDelay] = useState('');
  const [weekendDelay, setWeekendDelay] = useState('No');
  const [remarks, setRemarks] = useState('');
  const [finalResolution, setFinalResolution] = useState('Delivered');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dynamically computed options for dropdowns (Preset + Dataset + Custom Added)
  const transitOptions = useMemo(() => {
    const set = new Set<string>();
    COMMON_TRANSIT_DELAYS.forEach(d => set.add(d.trim()));
    if (existingTransitDelays) {
      existingTransitDelays.forEach(d => {
        if (d && d !== '-' && d.trim()) set.add(d.trim());
      });
    }
    customTransitDelays.forEach(d => {
      if (d && d.trim()) set.add(d.trim());
    });
    if (transitDelay && transitDelay.trim()) {
      set.add(transitDelay.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingTransitDelays, customTransitDelays, transitDelay]);

  const clearanceOptions = useMemo(() => {
    const set = new Set<string>();
    COMMON_CLEARANCE_DELAYS.forEach(d => set.add(d.trim()));
    if (existingClearanceDelays) {
      existingClearanceDelays.forEach(d => {
        if (d && d !== '-' && d.trim()) set.add(d.trim());
      });
    }
    customClearanceDelays.forEach(d => {
      if (d && d.trim()) set.add(d.trim());
    });
    if (clearanceDelay && clearanceDelay.trim()) {
      set.add(clearanceDelay.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingClearanceDelays, customClearanceDelays, clearanceDelay]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    COMMON_DESTINATION_DELAYS.forEach(d => set.add(d.trim()));
    if (existingDestinationDelays) {
      existingDestinationDelays.forEach(d => {
        if (d && d !== '-' && d.trim()) set.add(d.trim());
      });
    }
    customDestinationDelays.forEach(d => {
      if (d && d.trim()) set.add(d.trim());
    });
    if (destinationDelay && destinationDelay.trim()) {
      set.add(destinationDelay.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingDestinationDelays, customDestinationDelays, destinationDelay]);

  // Sync state when shipment changes
  useEffect(() => {
    if (shipment) {
      setTransitDelay(shipment.transitDelay && shipment.transitDelay !== '-' ? shipment.transitDelay : '');
      setClearanceDelay(shipment.clearanceDelay && shipment.clearanceDelay !== '-' ? shipment.clearanceDelay : '');
      setDestinationDelay(shipment.destinationDelay && shipment.destinationDelay !== '-' ? shipment.destinationDelay : '');
      setWeekendDelay(
        shipment.weekendDelay && shipment.weekendDelay.toLowerCase() === 'yes' ? 'Yes' : 'No'
      );
      setRemarks(shipment.remarks || '');
      setFinalResolution(shipment.finalResolution || 'Delivered');
      setSaveSuccess(false);
      setErrorMessage('');
    }
  }, [shipment]);

  if (!isOpen || !shipment) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = login(pinInput);
    if (res.success) {
      setPinError('');
      setPinInput('');
    } else {
      setPinError(res.error || 'Invalid PIN');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      const res = await onSave(shipment.awb, {
        transitDelay: transitDelay.trim(),
        clearanceDelay: clearanceDelay.trim(),
        destinationDelay: destinationDelay.trim(),
        weekendDelay: weekendDelay.trim(),
        remarks: remarks.trim(),
        finalResolution: finalResolution.trim()
      });

      if (res && res.success === false) {
        setErrorMessage(res.error || 'Failed to update delay');
        setIsSaving(false);
        return;
      }

      // Add newly typed reasons to dropdown list and persist
      const trimmedTransit = transitDelay.trim();
      if (trimmedTransit && !COMMON_TRANSIT_DELAYS.includes(trimmedTransit) && !customTransitDelays.includes(trimmedTransit)) {
        const next = [...customTransitDelays, trimmedTransit];
        setCustomTransitDelays(next);
        saveStoredDelays(CUSTOM_TRANSIT_KEY, next);
      }

      const trimmedClearance = clearanceDelay.trim();
      if (trimmedClearance && !COMMON_CLEARANCE_DELAYS.includes(trimmedClearance) && !customClearanceDelays.includes(trimmedClearance)) {
        const next = [...customClearanceDelays, trimmedClearance];
        setCustomClearanceDelays(next);
        saveStoredDelays(CUSTOM_CLEARANCE_KEY, next);
      }

      const trimmedDest = destinationDelay.trim();
      if (trimmedDest && !COMMON_DESTINATION_DELAYS.includes(trimmedDest) && !customDestinationDelays.includes(trimmedDest)) {
        const next = [...customDestinationDelays, trimmedDest];
        setCustomDestinationDelays(next);
        saveStoredDelays(CUSTOM_DESTINATION_KEY, next);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving delay details');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Update Delay Reason
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                  AWB #{shipment.awb}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Edit delay classifications, root cause remarks, and status for this shipment.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authentication Gate */}
        {!isEditor ? (
          <div className="p-8 sm:p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center justify-center mb-4 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Editor PIN Required
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6">
              Editing delay reasons is restricted to authorized team members. Enter your editor PIN to unlock.
            </p>

            <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="Enter editor PIN..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-center font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                />
              </div>

              {pinError && (
                <div className="text-xs text-rose-500 font-semibold flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Editor Mode</span>
              </button>
            </form>
          </div>
        ) : (
          /* Editor Form */
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Shipment Quick Context Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Building className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Customer
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-200 truncate block mt-0.5" title={shipment.customer}>
                  {shipment.customer || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Destination
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-200 block mt-0.5">
                  {shipment.destination || 'N/A'} {shipment.city ? `(${shipment.city})` : ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Transit Time
                </span>
                <span className={`font-black font-mono block mt-0.5 ${shipment.tt > 8 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-900 dark:text-slate-200'}`}>
                  {shipment.tt} days {shipment.tt > 8 && <span className="text-[10px] px-1 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ml-1">Day 8+</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  Pickup Date
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300 block mt-0.5">
                  {formatExcelDate(shipment.pickup)}
                </span>
              </div>
            </div>

            {/* Delay Categorization Fields */}
            <div className="space-y-4">
              
              {/* 1. Transit Delay */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-indigo-500" />
                    Transit Delay Reason
                  </label>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">Airline / Hub / Gateway</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={transitOptions.includes(transitDelay) ? transitDelay : transitDelay ? 'CUSTOM' : ''}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setTransitDelay('');
                      } else {
                        setTransitDelay(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- No Transit Delay --</option>
                    {transitOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="CUSTOM">Custom / Other Reason...</option>
                  </select>

                  <input
                    type="text"
                    value={transitDelay}
                    onChange={(e) => setTransitDelay(e.target.value)}
                    placeholder="Type transit delay reason..."
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 2. Clearance Delay */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    Customs Clearance Delay Reason
                  </label>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">Paperwork / Regulatory / Duty</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={clearanceOptions.includes(clearanceDelay) ? clearanceDelay : clearanceDelay ? 'CUSTOM' : ''}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setClearanceDelay('');
                      } else {
                        setClearanceDelay(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- No Clearance Delay --</option>
                    {clearanceOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="CUSTOM">Custom / Other Reason...</option>
                  </select>

                  <input
                    type="text"
                    value={clearanceDelay}
                    onChange={(e) => setClearanceDelay(e.target.value)}
                    placeholder="Type customs delay reason..."
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 3. Destination Delay */}
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-rose-950 dark:text-rose-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-rose-500" />
                    Destination / Delivery Delay Reason
                  </label>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">Last-Mile / Consignee / Address</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={destinationOptions.includes(destinationDelay) ? destinationDelay : destinationDelay ? 'CUSTOM' : ''}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setDestinationDelay('');
                      } else {
                        setDestinationDelay(e.target.value);
                      }
                    }}
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">-- No Destination Delay --</option>
                    {destinationOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="CUSTOM">Custom / Other Reason...</option>
                  </select>

                  <input
                    type="text"
                    value={destinationDelay}
                    onChange={(e) => setDestinationDelay(e.target.value)}
                    placeholder="Type destination delay reason..."
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Weekend Delay & Final Resolution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40">
                  <label className="text-xs font-bold text-cyan-950 dark:text-cyan-300 flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                    Weekend Delay
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="weekendDelay"
                        checked={weekendDelay.toLowerCase() === 'yes'}
                        onChange={() => setWeekendDelay('Yes')}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="weekendDelay"
                        checked={weekendDelay.toLowerCase() !== 'yes'}
                        onChange={() => setWeekendDelay('No')}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      No
                    </label>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Final Resolution Status
                  </label>
                  <select
                    value={finalResolution}
                    onChange={(e) => setFinalResolution(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Delivered">Delivered</option>
                    <option value="Undelivered">Undelivered</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Returned">Returned</option>
                    <option value="Destroyed">Destroyed</option>
                  </select>
                </div>
              </div>

              {/* Remarks Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Remarks / Root-Cause Details
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter specific notes, root cause explanations, or resolution history..."
                  rows={2}
                  className="w-full text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

            </div>

            {/* Error / Success Notifications */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fade-in font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Delay reason saved successfully! Updating charts and dashboard...</span>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || saveSuccess}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save Delay Details'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
