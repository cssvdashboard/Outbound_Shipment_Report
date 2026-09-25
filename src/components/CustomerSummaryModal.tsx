import React, { useState, useMemo } from 'react';
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
  Share2,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Shipment } from '../types/logistics';
import { formatTT, formatWeight, formatExcelDate } from '../utils/formatters';

interface CustomerSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  initialCustomer?: string;
  allCustomers?: string[];
}

export const CustomerSummaryModal: React.FC<CustomerSummaryModalProps> = ({
  isOpen,
  onClose,
  shipments,
  initialCustomer,
  allCustomers = []
}) => {
  // Active customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<string>(initialCustomer || '');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Sync initial customer if changed
  React.useEffect(() => {
    if (initialCustomer) {
      setSelectedCustomer(initialCustomer);
    }
  }, [initialCustomer]);

  // If no customer selected, default to the top customer with most shipments
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

  const currentCustomer = selectedCustomer || activeCustomerList[0] || '';

  // Filter shipments for this customer
  const customerShipments = useMemo(() => {
    if (!currentCustomer) return [];
    return shipments.filter(
      (s) => s.customer && s.customer.trim().toLowerCase() === currentCustomer.trim().toLowerCase()
    );
  }, [shipments, currentCustomer]);

  // Compute Customer Analytics
  const metrics = useMemo(() => {
    const total = customerShipments.length;
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

    customerShipments.forEach((s) => {
      // Weight
      weightSum += s.weight || 0;

      // Final resolution
      if (s.finalResolution === 'Delivered') deliveredCount++;

      // TT & Timelines
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

      // Check for delays / exceptions
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

      // Destinations
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
      exceptionsList: exceptionsList.slice(0, 50) // Cap top 50
    };
  }, [customerShipments]);

  // Formatted Email Summary Generator
  const emailSummaryText = useMemo(() => {
    if (!currentCustomer) return '';

    const lines: string[] = [];
    lines.push(`======================================================================`);
    lines.push(`CUSTOMER PERFORMANCE SUMMARY: ${currentCustomer.toUpperCase()}`);
    lines.push(`Outbound Shipment Intelligence Report`);
    lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    lines.push(`======================================================================\n`);

    lines.push(`📊 EXECUTIVE SHIPMENT KPI SUMMARY`);
    lines.push(`----------------------------------------------------------------------`);
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
      lines.push(`🌍 TOP DESTINATION MARKETS`);
      lines.push(`----------------------------------------------------------------------`);
      metrics.destinations.slice(0, 5).forEach((d, idx) => {
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
  }, [currentCustomer, metrics]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static print:backdrop-none">
      
      {/* Print Specific CSS Override */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #customer-printable-dossier, #customer-printable-dossier * {
            visibility: visible;
          }
          #customer-printable-dossier {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 16px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
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
                  Customer Performance Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 no-print">
                  Single Account Briefing
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
              <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Email Summary'}</span>
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

          {/* Customer Selection Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 via-indigo-50/40 to-sky-50/40 dark:from-slate-900/90 dark:via-indigo-950/30 dark:to-sky-950/30 border-2 border-indigo-200/70 dark:border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-0.5">
                Active Account Dossier
              </span>
              <h3 className="text-lg font-black text-slate-950 dark:text-white truncate">
                {currentCustomer || 'No customer selected'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Showing <strong>{metrics.total}</strong> outbound shipments totaling{' '}
                <strong>{formatWeight(metrics.totalWeight)} kg</strong>
              </p>
            </div>

            {/* Quick Customer Switcher Dropdown (Hidden when printing) */}
            <div className="relative w-full sm:w-72 shrink-0 no-print">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer shadow-xs"
              >
                <span className="truncate">{currentCustomer || 'Switch Customer...'}</span>
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
                          selectedCustomer === c
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{c}</span>
                        {selectedCustomer === c && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4-Card Executive KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Total Volume</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics.total}</span>
                <span className="text-xs font-semibold text-slate-500">AWBs</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                Gross Wt: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatWeight(metrics.totalWeight)} kg</strong>
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">On-Time SLA Rate</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-2xl font-black font-mono ${metrics.onTimeRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {metrics.onTimeRate.toFixed(1)}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                <strong className="text-emerald-600 dark:text-emerald-400">{metrics.onTimeCount} On-Time</strong> vs {metrics.delayedCount} Delayed
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Average Transit Time</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics.avgTT.toFixed(2)}</span>
                <span className="text-xs font-semibold text-slate-500">days</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                Standard SLA Target: ≤ 5.0 days
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Delivered vs Exceptions</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{metrics.deliveredCount}</span>
                <span className="text-xs font-semibold text-slate-500">Delivered</span>
              </div>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 block">
                {metrics.exceptionsCount} logged delays / remarks
              </span>
            </div>
          </div>

          {/* Delivery Timeline Distribution */}
          <div className="p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Transit Time Timeline Distribution
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Total {metrics.total} Shipments</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">Day 1–4</span>
                <span className="text-base font-black text-emerald-900 dark:text-emerald-200 font-mono block mt-0.5">{metrics.timeline.day1_4}</span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-semibold">
                  {((metrics.timeline.day1_4 / (metrics.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40">
                <span className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 block">Day 5</span>
                <span className="text-base font-black text-cyan-900 dark:text-cyan-200 font-mono block mt-0.5">{metrics.timeline.day5}</span>
                <span className="text-[10px] text-cyan-700/80 dark:text-cyan-400 font-semibold">
                  {((metrics.timeline.day5 / (metrics.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40">
                <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 block">Day 6</span>
                <span className="text-base font-black text-indigo-900 dark:text-indigo-200 font-mono block mt-0.5">{metrics.timeline.day6}</span>
                <span className="text-[10px] text-indigo-700/80 dark:text-indigo-400 font-semibold">
                  {((metrics.timeline.day6 / (metrics.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">Day 7</span>
                <span className="text-base font-black text-amber-900 dark:text-amber-200 font-mono block mt-0.5">{metrics.timeline.day7}</span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-semibold">
                  {((metrics.timeline.day7 / (metrics.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
                <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">Day 8+</span>
                <span className="text-base font-black text-rose-900 dark:text-rose-200 font-mono block mt-0.5">{metrics.timeline.day8Plus}</span>
                <span className="text-[10px] text-rose-700/80 dark:text-rose-400 font-semibold">
                  {((metrics.timeline.day8Plus / (metrics.total || 1)) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Top Destination Markets & Exceptions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Top Destinations */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                Top Destination Markets
              </span>

              <div className="space-y-2">
                {metrics.destinations.slice(0, 6).map((d) => (
                  <div
                    key={d.dest}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-mono font-black text-[11px] text-slate-900 dark:text-white">
                        {d.dest}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">{d.count} AWBs</span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">{formatWeight(d.weight)} kg</span>
                      <span className={d.onTimeRate >= 80 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                        {d.onTimeRate.toFixed(0)}% On-Time
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">{d.avgTT.toFixed(1)}d</span>
                    </div>
                  </div>
                ))}

                {metrics.destinations.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No destination data recorded.</p>
                )}
              </div>
            </div>

            {/* Exceptions & Delay Remarks */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Active Exceptions &amp; Delays ({metrics.exceptionsList.length})
              </span>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.exceptionsList.slice(0, 10).map((s) => {
                  const delayReason = s.clearanceDelay && s.clearanceDelay !== '-'
                    ? `📋 ${s.clearanceDelay}`
                    : s.transitDelay && s.transitDelay !== '-'
                    ? `✈️ ${s.transitDelay}`
                    : s.destinationDelay && s.destinationDelay !== '-'
                    ? `🚚 ${s.destinationDelay}`
                    : s.remarks && s.remarks !== '-'
                    ? `💬 ${s.remarks}`
                    : `TT: ${formatTT(s.tt)} days`;

                  return (
                    <div key={s.awb} className="pt-2 first:pt-0 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-600 dark:text-sky-400">{s.awb}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold">
                            {s.destination}
                          </span>
                          <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-[11px]">
                            {formatTT(s.tt)}d
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                        {delayReason}
                      </p>
                    </div>
                  );
                })}

                {metrics.exceptionsList.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Clean Performance</span>
                    <span>No active delays or exceptions logged for this account.</span>
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
            Account: <strong className="text-slate-800 dark:text-slate-200">{currentCustomer}</strong>
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
