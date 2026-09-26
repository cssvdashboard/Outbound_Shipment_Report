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
  Sparkles,
  Package,
  User,
  Scale,
  Hash,
  Globe,
  Tag
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { useEditorAuth } from '../hooks/useEditorAuth';
import { formatExcelDate, formatExcelDateTime, formatTT, formatWeight } from '../utils/formatters';

interface DelayReasonEditorModalProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    awb: string,
    updates: Partial<Shipment>
  ) => Promise<{ success: boolean; error?: string } | void>;
  existingTransitDelays?: string[];
  existingClearanceDelays?: string[];
  existingDestinationDelays?: string[];
  initialTab?: 'delays' | 'cargo' | 'parties' | 'milestones';
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
  'Unable To Locate Consignee',
  'NFBRK',
  'Restricted Commodity',
  'CPSC Required',
  'EORI Required',
  'KYC Required',
  'Proof of Payment',
  'Refused by Consignee'
];

const COMMON_DESTINATION_DELAYS = [
  'Incorrect Address',
  'Delay Attempt',
  'Unable to Collect Payment',
  'Business Closed',
  'Refused by Consignee',
  'Dispute POD',
  'Missing POD',
  'Future Delivery',
  'ODA Delay',
  'Misdelivered',
  'Available For Pickup'
];

function toDateTimeParts(val: any): { date: string; time: string } {
  if (!val) return { date: '', time: '' };

  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + num * msPerDay);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toISOString().slice(0, 10);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const hasTime = (num % 1) > 0.0001;
      return { date: dateStr, time: hasTime ? `${hh}:${mm}` : '' };
    }
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const dateStr = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      const timeStr = match[4] !== undefined && match[5] !== undefined
        ? `${match[4].padStart(2, '0')}:${match[5].padStart(2, '0')}`
        : '';
      return { date: dateStr, time: timeStr };
    }
  }

  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
      return { date: `${y}-${m}-${day}`, time: hasTime ? `${hh}:${mm}` : '' };
    }
  } catch (e) {}

  return { date: '', time: '' };
}

export const DelayReasonEditorModal: React.FC<DelayReasonEditorModalProps> = ({
  shipment,
  isOpen,
  onClose,
  onSave,
  existingTransitDelays,
  existingClearanceDelays,
  existingDestinationDelays,
  initialTab = 'delays'
}) => {
  const { isEditor, login } = useEditorAuth();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<'delays' | 'cargo' | 'parties' | 'milestones'>('delays');

  // Custom user-defined delay lists stored in browser
  const [customTransitDelays, setCustomTransitDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_TRANSIT_KEY));
  const [customClearanceDelays, setCustomClearanceDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_CLEARANCE_KEY));
  const [customDestinationDelays, setCustomDestinationDelays] = useState<string[]>(() => loadStoredDelays(CUSTOM_DESTINATION_KEY));

  // Tab 1: Status & Delays
  const [transitDelay, setTransitDelay] = useState('');
  const [clearanceDelay, setClearanceDelay] = useState('');
  const [destinationDelay, setDestinationDelay] = useState('');
  const [weekendDelay, setWeekendDelay] = useState('No');
  const [remarks, setRemarks] = useState('');
  const [finalResolution, setFinalResolution] = useState('Delivered');

  // Tab 2: Cargo & Packages
  const [weight, setWeight] = useState<string>('');
  const [pkgCount, setPkgCount] = useState<string>('1');
  const [description, setDescription] = useState<string>('');

  // Tab 3: Parties & Route
  const [customer, setCustomer] = useState<string>('');
  const [shprName, setShprName] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [destination, setDestination] = useState<string>('');

  // Tab 4: Dates & Milestones (Date + Time)
  const [pickupDate, setPickupDate] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [podDate, setPodDate] = useState<string>('');
  const [podTime, setPodTime] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dynamically computed options for dropdowns
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

      setWeight(shipment.weight !== undefined && shipment.weight !== null ? String(shipment.weight) : '');
      setPkgCount(shipment.pkgCount !== undefined && shipment.pkgCount !== null ? String(shipment.pkgCount) : '1');
      setDescription(shipment.description || '');

      setCustomer(shipment.customer || '');
      setShprName(shipment.shprName || '');
      setRecipient(shipment.recipient || '');
      setCity(shipment.city || '');
      setDestination(shipment.destination || '');

      const pickupParts = toDateTimeParts(shipment.pickup);
      setPickupDate(pickupParts.date);
      setPickupTime(pickupParts.time);

      const podParts = toDateTimeParts(shipment.pod);
      setPodDate(podParts.date);
      setPodTime(podParts.time);

      setActiveTab(initialTab || 'delays');
      setSaveSuccess(false);
      setErrorMessage('');
    }
  }, [shipment, initialTab]);

  // Live Transit Time Preview when dates and times are adjusted
  const liveTTPreview = useMemo(() => {
    if (!pickupDate || !podDate) {
      return shipment?.tt !== undefined ? { tt: shipment.tt, ttRange: shipment.ttRange } : null;
    }
    const pStr = `${pickupDate}T${pickupTime || '00:00'}`;
    const dStr = `${podDate}T${podTime || '00:00'}`;
    const p = new Date(pStr).getTime();
    const d = new Date(dStr).getTime();
    if (isNaN(p) || isNaN(d) || d < p) return { tt: 0, ttRange: 'Undelivered' };
    const diffDays = Math.max(0, Math.round(((d - p) / (1000 * 60 * 60 * 24)) * 100) / 100);
    let range = 'Undelivered';
    if (diffDays <= 0) range = 'Undelivered';
    else if (diffDays <= 4) range = 'Day 1–4';
    else if (diffDays <= 5) range = 'Day 5';
    else if (diffDays <= 6) range = 'Day 6';
    else if (diffDays <= 7) range = 'Day 7';
    else range = 'Day 8+';
    return { tt: diffDays, ttRange: range };
  }, [pickupDate, pickupTime, podDate, podTime, shipment]);

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
      const parsedWeight = parseFloat(weight);
      const parsedPkg = parseInt(pkgCount, 10);

      const updates: Partial<Shipment> = {
        transitDelay: transitDelay.trim(),
        clearanceDelay: clearanceDelay.trim(),
        destinationDelay: destinationDelay.trim(),
        weekendDelay: weekendDelay.trim(),
        remarks: remarks.trim(),
        finalResolution: finalResolution.trim(),
        weight: !isNaN(parsedWeight) ? parsedWeight : shipment.weight,
        pkgCount: !isNaN(parsedPkg) ? parsedPkg : shipment.pkgCount,
        description: description.trim(),
        customer: customer.trim() || shipment.customer,
        shprName: shprName.trim() || shipment.shprName,
        recipient: recipient.trim(),
        city: city.trim(),
        destination: destination.trim().toUpperCase() || shipment.destination,
      };

      if (pickupDate) {
        updates.pickup = pickupTime ? `${pickupDate} ${pickupTime}:00` : pickupDate;
      }
      if (podDate) {
        updates.pod = podTime ? `${podDate} ${podTime}:00` : podDate;
      }
      if (liveTTPreview) {
        updates.tt = liveTTPreview.tt;
        updates.ttRange = liveTTPreview.ttRange;
      }

      const res = await onSave(shipment.awb, updates);

      if (res && res.success === false) {
        setErrorMessage(res.error || 'Failed to update shipment');
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
      setErrorMessage(err?.message || 'Error saving shipment details');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Edit Shipment Dossier
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                  AWB #{shipment.awb}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {shipment.destination}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Modify delay categories, cargo weight, consignee details, and milestone dates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
              Editor Mode PIN Required
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6">
              Modifying shipment details and delay logs is protected to prevent accidental edits. Enter your PIN to unlock.
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
                  placeholder="Enter editor PIN (e.g. 1234)..."
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
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 px-6 pt-2.5 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('delays')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'delays'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#0c121e] shadow-xs'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Delays &amp; Status</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cargo')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'cargo'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#0c121e] shadow-xs'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Cargo &amp; Weight</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('parties')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'parties'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#0c121e] shadow-xs'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Parties &amp; Route</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('milestones')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'milestones'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#0c121e] shadow-xs'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Dates &amp; Transit Time</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              
              {/* Quick Summary Pill Bar */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Customer</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200 truncate block mt-0.5">{customer || shipment.customer}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Destination</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200 block mt-0.5">{destination || shipment.destination} {city ? `(${city})` : ''}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Weight / Pieces</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200 block mt-0.5 font-mono">{weight || 0} kg / {pkgCount || 1} pcs</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Resolution</span>
                  <span className={`font-bold block mt-0.5 ${finalResolution === 'Delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {finalResolution}
                  </span>
                </div>
              </div>

              {/* TAB 1: DELAYS & STATUS */}
              {activeTab === 'delays' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Final Resolution Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-500" />
                      Final Resolution Status
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['Delivered', 'RTS', 'Undelivered', 'In Transit', 'Lost', 'Destroyed', 'Seized'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFinalResolution(status)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            finalResolution === status
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transit Delay */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                        <Plane className="w-3.5 h-3.5 text-indigo-500" />
                        Transit Delay Reason
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Hub / Gateway / Flight</span>
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

                  {/* Clearance Delay */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        Customs Clearance Delay Reason
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Customs / Duty / Inspection</span>
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

                  {/* Destination Delay */}
                  <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-rose-950 dark:text-rose-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-rose-500" />
                        Destination / Delivery Delay Reason
                      </label>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Address / Recipient / POD</span>
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

                  {/* Weekend Delay & Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                    <div className="sm:col-span-2 space-y-1.5">
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
                </div>
              )}

              {/* TAB 2: CARGO & WEIGHT */}
              {activeTab === 'cargo' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-emerald-500" />
                        Gross Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 12.50"
                        className="w-full text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Original weight: {formatWeight(shipment.weight)} kg</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Hash className="w-4 h-4 text-sky-500" />
                        Package Pieces (pcs)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={pkgCount}
                        onChange={(e) => setPkgCount(e.target.value)}
                        placeholder="e.g. 1"
                        className="w-full text-sm font-mono font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Total individual cartons / parcels</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-500" />
                      Goods / Commodity Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. READYMADE GARMENTS, KNITTED SHIRTS, TEXTILE SAMPLES..."
                      rows={3}
                      className="w-full text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: PARTIES & ROUTE */}
              {activeTab === 'parties' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-blue-500" />
                        Customer Account Name
                      </label>
                      <input
                        type="text"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        placeholder="Customer Account..."
                        className="w-full text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-indigo-500" />
                        Shipper Name
                      </label>
                      <input
                        type="text"
                        value={shprName}
                        onChange={(e) => setShprName(e.target.value)}
                        placeholder="Shipper Company..."
                        className="w-full text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                    <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-500" />
                      Recipient / Consignee
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="Receiver name and company..."
                      className="w-full text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        Delivery Destination City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. NEW YORK, LONDON, DUBAI"
                        className="w-full text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2">
                      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-sky-500" />
                        Destination Country Code
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={destination}
                        onChange={(e) => setDestination(e.target.value.toUpperCase())}
                        placeholder="e.g. US, GB, DE, AE"
                        className="w-full text-xs font-mono font-bold uppercase rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DATES & MILESTONES */}
              {activeTab === 'milestones' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Pickup Date & Time */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-purple-500" />
                          Pickup Date &amp; Time
                        </label>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold font-mono">
                          Origin Dispatch
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        <div className="col-span-3">
                          <span className="text-[10px] text-slate-500 dark:text-slate-300 block mb-1 font-bold">Date</span>
                          <input
                            type="date"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 dark:focus:border-indigo-400 p-2.5 text-slate-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-xs cursor-pointer"
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-300 block mb-1 font-bold">Time</span>
                          <input
                            type="time"
                            value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 dark:focus:border-indigo-400 p-2.5 text-slate-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-mono">
                        Original: {formatExcelDateTime(shipment.pickup)}
                      </span>
                    </div>

                    {/* POD / Delivery Date & Time */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-500" />
                          POD / Delivery Date &amp; Time
                        </label>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold font-mono">
                          Destination Delivery
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        <div className="col-span-3">
                          <span className="text-[10px] text-slate-500 dark:text-slate-300 block mb-1 font-bold">Date</span>
                          <input
                            type="date"
                            value={podDate}
                            onChange={(e) => setPodDate(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 dark:focus:border-indigo-400 p-2.5 text-slate-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-xs cursor-pointer"
                          />
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-300 block mb-1 font-bold">Time</span>
                          <input
                            type="time"
                            value={podTime}
                            onChange={(e) => setPodTime(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 dark:focus:border-indigo-400 p-2.5 text-slate-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-xs cursor-pointer"
                          />
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-mono">
                        Original: {formatExcelDateTime(shipment.pod)}
                      </span>
                    </div>
                  </div>

                  {/* Smart Transit Time Calculation Preview */}
                  {liveTTPreview && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          Auto-Calculated Transit Time
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          Updating date and time automatically recalculates precise Transit Time (days &amp; hours) and Day Range buckets.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black font-mono text-indigo-800 dark:text-indigo-300">
                          {formatTT(liveTTPreview.tt)} days
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs">
                          {liveTTPreview.ttRange}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Error / Success Notifications */}
            {errorMessage && (
              <div className="mx-6 mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="mx-6 mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fade-in font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Changes saved successfully! Updating charts, live cloud, and Excel queue...</span>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving Changes...' : 'Save & Broadcast'}</span>
                </button>
              </div>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
