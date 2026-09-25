import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Printer,
  Mail,
  Building,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  Search,
  Calendar,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { formatTT, formatWeight, formatExcelDate } from '../utils/formatters';
import { getPickupISODate } from '../utils/analytics';

interface CustomerSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  initialCustomer?: string;
  initialDestination?: string;
  allCustomers?: string[];
  allDestinations?: string[];
  dateRange?: { start?: string; end?: string } | null;
}

export const CustomerSummaryModal: React.FC<CustomerSummaryModalProps> = ({
  isOpen,
  onClose,
  shipments,
  initialCustomer,
  initialDestination,
  allCustomers = [],
  allDestinations = [],
  dateRange
}) => {
  // Active customer & destination selection
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialCustomer || '');
  const [selectedDestination, setSelectedDestination] = useState<string>(initialDestination || '');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Sync initial selections when modal opens or props change
  useEffect(() => {
    setSelectedCustomer(initialCustomer || '');
    setSelectedDestination(initialDestination || '');
  }, [initialCustomer, initialDestination, isOpen]);

  // Manage body class for zero-margin print styling
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('customer-summary-print-active');
    } else {
      document.body.classList.remove('customer-summary-print-active');
    }
    return () => {
      document.body.classList.remove('customer-summary-print-active');
    };
  }, [isOpen]);

  // Active customer list for quick switching
  const activeCustomerList = useMemo(() => {
    if (allCustomers && allCustomers.length > 0) return allCustomers;
    const counts = new Map<string, number>();
    shipments.forEach((s) => {
      if (s.customer && s.customer.trim()) {
        counts.set(s.customer, (counts.get(s.customer) || 0) + 1);
      }
    });
    return Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
  }, [allCustomers, shipments]);

  // Fallback if neither customer nor destination is chosen
  const currentCustomer = selectedCustomer.trim();
  const currentDestination = selectedDestination.trim().toUpperCase();

  // If no customer and no destination selected, default to top customer
  const effectiveCustomer = useMemo(() => {
    if (currentCustomer) return currentCustomer;
    if (currentDestination && currentDestination !== 'ALL') return ''; // Destination-only mode
    return activeCustomerList[0] || '';
  }, [currentCustomer, currentDestination, activeCustomerList]);

  // Filter shipments for this customer and/or destination AND active selected date range
  const scopedShipments = useMemo(() => {
    const start = dateRange?.start?.trim();
    const end = dateRange?.end?.trim();

    return shipments.filter((s) => {
      // 1. Customer Filter
      if (effectiveCustomer) {
        if (!s.customer || s.customer.trim().toLowerCase() !== effectiveCustomer.toLowerCase()) {
          return false;
        }
      }

      // 2. Destination Filter
      if (currentDestination && currentDestination !== 'ALL') {
        if (!s.destination || s.destination.trim().toUpperCase() !== currentDestination) {
          return false;
        }
      }

      // 3. Date / Time Period Filter!
      if (start && end) {
        const [minRange, maxRange] = start <= end ? [start, end] : [end, start];
        const pickupIso = getPickupISODate(s.pickup);
        if (!pickupIso) return false;
        if (pickupIso < minRange || pickupIso > maxRange) return false;
      } else if (start && !end) {
        const pickupIso = getPickupISODate(s.pickup);
        if (!pickupIso || pickupIso !== start) return false;
      } else if (!start && end) {
        const pickupIso = getPickupISODate(s.pickup);
        if (!pickupIso || pickupIso !== end) return false;
      }

      return true;
    });
  }, [shipments, effectiveCustomer, currentDestination, dateRange]);

  // Compute prominent Time Period label
  const timePeriodLabel = useMemo(() => {
    const start = dateRange?.start?.trim();
    const end = dateRange?.end?.trim();

    if (start && end) {
      if (start === end) {
        return formatExcelDate(start);
      }
      return `${formatExcelDate(start)} – ${formatExcelDate(end)}`;
    }
    if (start && !end) {
      return formatExcelDate(start);
    }
    if (!start && end) {
      return formatExcelDate(end);
    }

    // Fallback: calculate from shipment pickup dates if any
    let minD: string | null = null;
    let maxD: string | null = null;
    scopedShipments.forEach((s) => {
      if (s.pickup) {
        const d = getPickupISODate(s.pickup);
        if (d) {
          if (!minD || d < minD) minD = d;
          if (!maxD || d > maxD) maxD = d;
        }
      }
    });
    if (minD && maxD) {
      if (minD === maxD) return formatExcelDate(minD);
      return `${formatExcelDate(minD)} – ${formatExcelDate(maxD)}`;
    }
    return 'All Available Records';
  }, [dateRange, scopedShipments]);

  // Compute Performance Analytics
  const metrics = useMemo(() => {
    const total = scopedShipments.length;
    if (total === 0) {
      return {
        total: 0,
        totalWeight: 0,
        avgTT: 0,
        onTimeCount: 0,
        onTimeRate: 0,
        delayedCount: 0,
        deliveredCount: 0,
        exceptionsCount: 0,
        timeline: { day1_4: 0, day5: 0, day6: 0, day7: 0, day8Plus: 0, undelivered: 0 },
        destinations: [] as Array<{ dest: string; count: number; weight: number; avgTT: number; onTimeRate: number }>,
        exceptionsList: [] as Shipment[]
      };
    }

    let weightSum = 0;
    let ttSum = 0;
    let validTTCount = 0;
    let onTimeCount = 0;
    let deliveredCount = 0;

    const timeline = { day1_4: 0, day5: 0, day6: 0, day7: 0, day8Plus: 0, undelivered: 0 };
    const destMap = new Map<string, { count: number; weight: number; ttSum: number; ttCount: number; onTimeCount: number }>();
    const exceptionsList: Shipment[] = [];

    scopedShipments.forEach((s) => {
      weightSum += s.weight || 0;

      if (s.finalResolution === 'Delivered') deliveredCount++;

      const tt = s.tt || 0;
      if (tt > 0 && s.finalResolution !== 'Undelivered') {
        ttSum += tt;
        validTTCount++;
        if (tt <= 5.0) onTimeCount++;

        if (tt <= 4.0) timeline.day1_4++;
        else if (tt <= 5.0) timeline.day5++;
        else if (tt <= 6.0) timeline.day6++;
        else if (tt <= 7.0) timeline.day7++;
        else timeline.day8Plus++;
      } else {
        timeline.undelivered++;
      }

      const hasDelayRemark = Boolean(
        (s.transitDelay && s.transitDelay !== '-') ||
        (s.clearanceDelay && s.clearanceDelay !== '-') ||
        (s.destinationDelay && s.destinationDelay !== '-') ||
        (s.weekendDelay && s.weekendDelay.toLowerCase() === 'yes') ||
        (s.remarks && s.remarks !== '-') ||
        s.tt > 5.0
      );

      if (hasDelayRemark) {
        exceptionsList.push(s);
      }

      const dest = s.destination ? s.destination.toUpperCase() : 'OTHER';
      const existing = destMap.get(dest) || { count: 0, weight: 0, ttSum: 0, ttCount: 0, onTimeCount: 0 };
      existing.count++;
      existing.weight += s.weight || 0;
      if (tt > 0) {
        existing.ttSum += tt;
        existing.ttCount++;
        if (tt <= 5.0) existing.onTimeCount++;
      }
      destMap.set(dest, existing);
    });

    const destinations = Array.from(destMap.entries())
      .map(([dest, val]) => ({
        dest,
        count: val.count,
        weight: val.weight,
        avgTT: val.ttCount > 0 ? val.ttSum / val.ttCount : 0,
        onTimeRate: val.count > 0 ? (val.onTimeCount / val.count) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      totalWeight: weightSum,
      avgTT: validTTCount > 0 ? ttSum / validTTCount : 0,
      onTimeCount,
      onTimeRate: total > 0 ? (onTimeCount / total) * 100 : 0,
      delayedCount: total - onTimeCount,
      deliveredCount,
      exceptionsCount: exceptionsList.length,
      timeline,
      destinations,
      exceptionsList: exceptionsList.slice(0, 50)
    };
  }, [scopedShipments]);

  // Display Titles
  const summaryTitle = useMemo(() => {
    if (effectiveCustomer && currentDestination && currentDestination !== 'ALL') {
      return `${effectiveCustomer} (${currentDestination})`;
    }
    if (effectiveCustomer) return effectiveCustomer;
    if (currentDestination && currentDestination !== 'ALL') {
      return `Destination: ${currentDestination} Market`;
    }
    return 'Summary Report';
  }, [effectiveCustomer, currentDestination]);

  // Formatted Email Summary Generator
  const emailSummaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`======================================================================`);
    lines.push(`LOGISTICS PERFORMANCE SUMMARY: ${summaryTitle.toUpperCase()}`);
    lines.push(`Outbound Shipment Intelligence Report`);
    lines.push(`Time Period : ${timePeriodLabel}`);
    lines.push(`Generated   : ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    lines.push(`======================================================================\n`);

    lines.push(`📊 EXECUTIVE SHIPMENT KPI SUMMARY`);
    lines.push(`----------------------------------------------------------------------`);
    lines.push(`• Time Period Scope        : ${timePeriodLabel}`);
    lines.push(`• Total Outbound Shipments : ${metrics.total} AWBs`);
    lines.push(`• Total Gross Weight       : ${formatWeight(metrics.totalWeight)} kg`);
    lines.push(`• On-Time Delivery Rate    : ${metrics.onTimeRate.toFixed(1)}% (${metrics.onTimeCount} on-time vs ${metrics.delayedCount} delayed)`);
    lines.push(`• Average Transit Time     : ${metrics.avgTT.toFixed(2)} days (Target: ≤ 5.0 days)`);
    lines.push(`• Delivered Shipments      : ${metrics.deliveredCount} AWBs (${((metrics.deliveredCount / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Logged Exceptions/Delays : ${metrics.exceptionsCount} AWBs\n`);

    lines.push(`⏱️ DELIVERY TIMELINE DISTRIBUTION`);
    lines.push(`----------------------------------------------------------------------`);
    lines.push(`• Day 1–4 (Express delivery)     : ${metrics.timeline.day1_4} AWBs (${((metrics.timeline.day1_4 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 5   (Standard SLA on-time) : ${metrics.timeline.day5} AWBs (${((metrics.timeline.day5 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 6   (Minor delay)          : ${metrics.timeline.day6} AWBs (${((metrics.timeline.day6 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 7                          : ${metrics.timeline.day7} AWBs (${((metrics.timeline.day7 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 8+  (Critical delay)       : ${metrics.timeline.day8Plus} AWBs (${((metrics.timeline.day8Plus / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    if (metrics.timeline.undelivered > 0) {
      lines.push(`• Undelivered / In-Transit       : ${metrics.timeline.undelivered} AWBs`);
    }
    lines.push(``);

    if (metrics.destinations.length > 0) {
      lines.push(`🌍 DESTINATION MARKET BREAKDOWN`);
      lines.push(`----------------------------------------------------------------------`);
      metrics.destinations.slice(0, 6).forEach((d, idx) => {
        lines.push(`${idx + 1}. ${d.dest.padEnd(6)}: ${String(d.count).padStart(4)} AWBs (${formatWeight(d.weight)} kg) | On-Time: ${d.onTimeRate.toFixed(1)}% | Avg TT: ${d.avgTT.toFixed(2)}d`);
      });
      lines.push(``);
    }

    if (metrics.exceptionsList.length > 0) {
      lines.push(`⚠️ ACTIVE LOGGED DELAYS & ROOT CAUSES (SAMPLE)`);
      lines.push(`----------------------------------------------------------------------`);
      metrics.exceptionsList.slice(0, 8).forEach((s, idx) => {
        const reason = s.clearanceDelay && s.clearanceDelay !== '-'
          ? `Clearance: ${s.clearanceDelay}`
          : s.transitDelay && s.transitDelay !== '-'
          ? `Transit: ${s.transitDelay}`
          : s.destinationDelay && s.destinationDelay !== '-'
          ? `Delivery: ${s.destinationDelay}`
          : s.remarks && s.remarks !== '-'
          ? `Remarks: ${s.remarks}`
          : `Extended Transit Time (${formatTT(s.tt)} days)`;

        lines.push(`${idx + 1}. AWB ${s.awb} (${s.destination || 'N/A'}) - TT: ${formatTT(s.tt)}d | Status: ${s.finalResolution || 'Delivered'}`);
        lines.push(`   Reason: ${reason}`);
      });
      lines.push(``);
    }

    lines.push(`======================================================================`);
    lines.push(`Customer Service Export Operations | Confidential`);
    lines.push(`======================================================================`);

    return lines.join('\n');
  }, [summaryTitle, timePeriodLabel, metrics]);

  // Handler: Copy email to clipboard
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(emailSummaryText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 3000);
  };

  // Handler: Print / Save PDF
  const handlePrintPDF = () => {
    window.print();
  };

  if (!isOpen) return null;

  const filteredCustomers = customerSearch.trim()
    ? activeCustomerList.filter((c) => c.toLowerCase().includes(customerSearch.trim().toLowerCase())).slice(0, 100)
    : activeCustomerList.slice(0, 100);

  return (
    <div className="customer-modal-portal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in print:static print:p-0 print:m-0 print:bg-white print:backdrop-none">
      
      {/* Comprehensive Zero-Blank-Page Print Style */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }

          /* Hide all main app nodes inside #root except the modal */
          body.customer-summary-print-active > #root > div > *:not(.customer-modal-portal) {
            display: none !important;
          }

          body.customer-summary-print-active {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .customer-modal-portal {
            position: static !important;
            display: block !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            overflow: visible !important;
          }

          #customer-printable-dossier {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            overflow: visible !important;
          }

          #customer-printable-dossier .overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }

          /* Prevent table cutoffs */
          tr, .rounded-2xl, .rounded-3xl, table, .grid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div
        id="customer-printable-dossier"
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0c1222] border-2 border-slate-300 dark:border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden print:max-h-none print:border-none print:shadow-none"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                  Executive Performance Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 no-print">
                  Client Briefing
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Comprehensive outbound SLA report ready for client communication &amp; executive review.
              </p>
            </div>
          </div>

          {/* Action Buttons: Copy Email, Print PDF, Close */}
          <div className="flex items-center gap-2 shrink-0 no-print">
            <button
              type="button"
              onClick={handleCopyEmail}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copiedEmail
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
              }`}
              title="Copy formatted summary to paste into Outlook or Gmail"
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Email'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Account & Scope Banner with PROMINENT TIME PERIOD */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 via-indigo-50/40 to-sky-50/40 dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-sky-950/30 border-2 border-indigo-200/70 dark:border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-0.5">
                Active Summary Scope
              </span>
              <h3 className="text-lg font-black text-slate-950 dark:text-white truncate">
                {summaryTitle}
              </h3>
              
              {/* Prominent Time Period Badge */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100/90 dark:bg-blue-950/90 text-blue-900 dark:text-sky-300 font-mono text-xs font-black border border-blue-300 dark:border-blue-700/60 shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0" />
                  <span>Time Period: <strong className="text-slate-900 dark:text-white">{timePeriodLabel}</strong></span>
                </div>

                {currentDestination && currentDestination !== 'ALL' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100/90 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-300 font-mono text-xs font-black border border-emerald-300 dark:border-emerald-700/60 shadow-xs">
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Destination: <strong>{currentDestination}</strong></span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">
                Scope Volume: <strong>{metrics.total}</strong> outbound shipments totaling{' '}
                <strong>{formatWeight(metrics.totalWeight)} kg</strong>
              </p>
            </div>

            {/* Quick Customer Switcher Dropdown (Hidden when printing) */}
            <div className="relative w-full sm:w-72 shrink-0 no-print">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer shadow-xs"
              >
                <span className="truncate">{effectiveCustomer || 'Switch Customer...'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95">
                  <div className="p-2 bg-slate-50 dark:bg-slate-950/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search account name..."
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setIsDropdownOpen(false);
                          setCustomerSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-between cursor-pointer ${
                          effectiveCustomer === c
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{c}</span>
                        {effectiveCustomer === c && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Shipments */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>Total Shipments</span>
                <Package className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                {metrics.total.toLocaleString()}
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Gross: <strong>{formatWeight(metrics.totalWeight)} kg</strong>
              </div>
            </div>

            {/* On-Time SLA Rate */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>On-Time SLA Rate</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div
                className={`text-2xl font-black mt-1 font-mono ${
                  metrics.onTimeRate >= 70
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : metrics.onTimeRate >= 50
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {metrics.onTimeRate.toFixed(1)}%
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                {metrics.onTimeCount} on-time vs {metrics.delayedCount} delayed
              </div>
            </div>

            {/* Average Transit Time */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>Avg Transit Time</span>
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                {metrics.avgTT > 0 ? `${metrics.avgTT.toFixed(2)}d` : '-'}
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                Target: ≤ 5.0 Days SLA
              </div>
            </div>

            {/* Active Exceptions */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-700">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>Logged Delays</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {metrics.exceptionsCount}
              </div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                {metrics.deliveredCount} Delivered ({((metrics.deliveredCount / (metrics.total || 1)) * 100).toFixed(0)}%)
              </div>
            </div>
          </div>

          {/* Delivery Timeline Distribution Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Delivery Timeline Distribution
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
              {/* Day 1-4 */}
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60">
                <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">Day 1–4</div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                  {metrics.timeline.day1_4}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80">Express</div>
              </div>

              {/* Day 5 */}
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/60">
                <div className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300">Day 5</div>
                <div className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono mt-0.5">
                  {metrics.timeline.day5}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400/80">On-Time SLA</div>
              </div>

              {/* Day 6 */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60">
                <div className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">Day 6</div>
                <div className="text-lg font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                  {metrics.timeline.day6}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400/80">Minor Delay</div>
              </div>

              {/* Day 7 */}
              <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/60">
                <div className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-300">Day 7</div>
                <div className="text-lg font-black text-orange-700 dark:text-orange-400 font-mono mt-0.5">
                  {metrics.timeline.day7}
                </div>
                <div className="text-[10px] text-orange-600 dark:text-orange-400/80">+2 Days Delay</div>
              </div>

              {/* Day 8+ */}
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60">
                <div className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-300">Day 8+</div>
                <div className="text-lg font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                  {metrics.timeline.day8Plus}
                </div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400/80">Critical Delay</div>
              </div>

              {/* Undelivered */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                <div className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">In-Transit</div>
                <div className="text-lg font-black text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                  {metrics.timeline.undelivered}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Undelivered</div>
              </div>
            </div>
          </div>

          {/* Two Columns: Destination Breakdown & Active Exception List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Top Destinations */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                Destination Market Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-black">
                      <th className="py-2 text-left">Destination</th>
                      <th className="py-2 text-right">AWBs</th>
                      <th className="py-2 text-right">Weight</th>
                      <th className="py-2 text-right">Avg TT</th>
                      <th className="py-2 text-right">On-Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metrics.destinations.slice(0, 8).map((d) => (
                      <tr key={d.dest} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 font-bold text-slate-800 dark:text-slate-200">{d.dest}</td>
                        <td className="py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {d.count}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-500 dark:text-slate-400">
                          {formatWeight(d.weight)} kg
                        </td>
                        <td className="py-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {d.avgTT > 0 ? `${d.avgTT.toFixed(1)}d` : '-'}
                        </td>
                        <td className="py-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {d.onTimeRate.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                    {metrics.destinations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No shipments logged for this selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Delay Exceptions Table */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Active Exceptions &amp; Delay Root Causes
                </h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {metrics.exceptionsCount} logged
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {metrics.exceptionsList.slice(0, 12).map((s) => {
                  const delayReason = s.clearanceDelay && s.clearanceDelay !== '-'
                    ? `Clearance: ${s.clearanceDelay}`
                    : s.transitDelay && s.transitDelay !== '-'
                    ? `Transit: ${s.transitDelay}`
                    : s.destinationDelay && s.destinationDelay !== '-'
                    ? `Delivery: ${s.destinationDelay}`
                    : s.remarks && s.remarks !== '-'
                    ? `Remarks: ${s.remarks}`
                    : `TT: ${formatTT(s.tt)} days`;

                  return (
                    <div
                      key={s.awb}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                          AWB: {s.awb}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">
                            {s.destination}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatTT(s.tt)}d
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                        {delayReason}
                      </p>
                    </div>
                  );
                })}

                {metrics.exceptionsList.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Clean Performance</span>
                    <span>No active delays or exceptions logged for this selection.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Formatted Email Text Preview Card (Hidden when printing) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 no-print">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-500" />
                Raw Email Text Preview (Auto-Generated)
              </span>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedEmail ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto whitespace-pre leading-relaxed max-h-40">
              {emailSummaryText}
            </pre>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-4 shrink-0 no-print">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Scope: <strong className="text-slate-800 dark:text-slate-200">{summaryTitle}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyEmail}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copiedEmail
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEmail ? 'Copied to Clipboard' : 'Copy Email Summary'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
