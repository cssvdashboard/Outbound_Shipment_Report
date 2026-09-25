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

  // Checkbox state for delay categories qualifying for PDF printing (all selected by default)
  const [unselectedDelayCategories, setUnselectedDelayCategories] = useState<Set<string>>(new Set());

  // Reset selections to all-selected whenever scope changes
  useEffect(() => {
    setUnselectedDelayCategories(new Set());
  }, [initialCustomer, initialDestination, isOpen, dateRange]);

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
        delayCategories: [] as Array<{ category: string; count: number }>,
        totalImpactedShipments: 0,
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

    // Delay categories aggregation (grouped directly without country segment)
    const delayCategoryMap = new Map<string, number>();

    scopedShipments.forEach((s) => {
      const categories: string[] = [];

      const cleanReason = (val: string) => val.replace(/^(clearance|transit|delivery|remarks)\s*:\s*/i, '').trim();

      if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') {
        const cleaned = cleanReason(s.transitDelay);
        if (cleaned) categories.push(cleaned);
      }
      if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') {
        const cleaned = cleanReason(s.clearanceDelay);
        if (cleaned) categories.push(cleaned);
      }
      if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') {
        const cleaned = cleanReason(s.destinationDelay);
        if (cleaned) categories.push(cleaned);
      }
      if (s.weekendDelay && s.weekendDelay.toLowerCase() === 'yes') {
        categories.push('Weekend Delay');
      }
      if (s.remarks && s.remarks !== '-' && s.remarks.trim() !== '' && categories.length === 0) {
        const cleaned = cleanReason(s.remarks);
        if (cleaned) categories.push(cleaned);
      }

      categories.forEach((cat) => {
        delayCategoryMap.set(cat, (delayCategoryMap.get(cat) || 0) + 1);
      });
    });

    const delayCategories = Array.from(delayCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const totalImpactedShipments = delayCategories.reduce((sum, item) => sum + item.count, 0);

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
      delayCategories,
      totalImpactedShipments,
      timeline,
      destinations,
      exceptionsList: exceptionsList.slice(0, 50)
    };
  }, [scopedShipments]);

  // Selection handlers for Delay Categories qualifying for PDF printing
  const allCategoryNames = useMemo(() => {
    return metrics.delayCategories.map((item) => item.category);
  }, [metrics.delayCategories]);

  const allDelaysSelected = unselectedDelayCategories.size === 0 && metrics.delayCategories.length > 0;

  const toggleDelayCategory = (category: string) => {
    setUnselectedDelayCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleAllDelays = () => {
    if (unselectedDelayCategories.size === 0) {
      setUnselectedDelayCategories(new Set(allCategoryNames));
    } else {
      setUnselectedDelayCategories(new Set());
    }
  };

  const selectedPrintCategories = useMemo(() => {
    return metrics.delayCategories.filter(
      (item) => !unselectedDelayCategories.has(item.category)
    );
  }, [metrics.delayCategories, unselectedDelayCategories]);

  const selectedPrintImpactedCount = useMemo(() => {
    return selectedPrintCategories.reduce((sum, item) => sum + item.count, 0);
  }, [selectedPrintCategories]);

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
    lines.push(`• On-Time Delivery         : ${metrics.onTimeRate.toFixed(1)}%`);
    lines.push(`• Average Transit Time     : ${metrics.avgTT.toFixed(2)} days`);
    lines.push(`• Delivered Shipments      : ${metrics.deliveredCount} AWBs (${((metrics.deliveredCount / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    if (metrics.timeline.undelivered > 0) {
      lines.push(`• Undelivered Shipments    : ${metrics.timeline.undelivered} AWBs (${((metrics.timeline.undelivered / (metrics.total || 1)) * 100).toFixed(1)}%)\n`);
    } else {
      lines.push(``);
    }

    lines.push(`⏱️ DELIVERY TIMELINE`);
    lines.push(`----------------------------------------------------------------------`);
    lines.push(`• Day 1–4                        : ${metrics.timeline.day1_4} AWBs (${((metrics.timeline.day1_4 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 5                          : ${metrics.timeline.day5} AWBs (${((metrics.timeline.day5 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 6                          : ${metrics.timeline.day6} AWBs (${((metrics.timeline.day6 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 7                          : ${metrics.timeline.day7} AWBs (${((metrics.timeline.day7 / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    lines.push(`• Day 8+                         : ${metrics.timeline.day8Plus} AWBs (${((metrics.timeline.day8Plus / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    if (metrics.timeline.undelivered > 0) {
      lines.push(`• UNDELIVERED                    : ${metrics.timeline.undelivered} AWBs (${((metrics.timeline.undelivered / (metrics.total || 1)) * 100).toFixed(1)}%)`);
    }
    lines.push(``);

    if (metrics.destinations.length > 0) {
      lines.push(`🌍 DESTINATION DETAILS`);
      lines.push(`----------------------------------------------------------------------`);
      metrics.destinations.slice(0, 6).forEach((d, idx) => {
        lines.push(`${idx + 1}. ${d.dest.padEnd(6)}: ${String(d.count).padStart(4)} AWBs (${formatWeight(d.weight)} kg) | On-Time: ${d.onTimeRate.toFixed(1)}% | Avg TT: ${d.avgTT.toFixed(2)}d`);
      });
      lines.push(``);
    }

    if (selectedPrintCategories.length > 0) {
      lines.push(`⚠️ DELAY CATEGORIES & IMPACTED SHIPMENTS`);
      lines.push(`----------------------------------------------------------------------`);
      selectedPrintCategories.slice(0, 15).forEach((dc, idx) => {
        lines.push(`${idx + 1}. ${dc.category.padEnd(32)}: ${dc.count} AWBs (${((dc.count / (metrics.total || 1)) * 100).toFixed(1)}%)`);
      });
      lines.push(``);
    }

    lines.push(`======================================================================`);
    lines.push(`Customer Service Export Operations | Confidential`);
    lines.push(`======================================================================`);

    return lines.join('\n');
  }, [summaryTitle, timePeriodLabel, metrics, selectedPrintCategories]);

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
      
      {/* Comprehensive Zero-Blank-Page Single-Page Print Style */}
      {/* Executive Professional Print & PDF Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 6mm 10mm;
          }

          /* Hide all main app nodes inside #root except the modal */
          body.customer-summary-print-active > #root > div > *:not(.customer-modal-portal) {
            display: none !important;
          }

          /* Force immaculate light corporate paper in print across all elements and wrappers */
          html,
          body,
          body.customer-summary-print-active,
          #root,
          #root > div,
          body.customer-summary-print-active #root,
          body.customer-summary-print-active #root > div,
          .customer-modal-portal,
          #customer-printable-dossier {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
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
            background-color: #ffffff !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            overflow: visible !important;
          }

          #customer-printable-dossier {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            overflow: visible !important;
          }

          #customer-printable-dossier .overflow-y-auto {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }

          /* Overwrite all dark mode backgrounds to clean white in print */
          #customer-printable-dossier,
          #customer-printable-dossier div,
          #customer-printable-dossier table {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* General card & tile borders in print */
          #customer-printable-dossier .border,
          #customer-printable-dossier .border-2 {
            border-width: 1px !important;
            border-color: #cbd5e1 !important;
          }

          /* Force light card backgrounds for KPI cards */
          #customer-printable-dossier .kpi-card {
            background-color: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }

          /* Override dark classes on print */
          #customer-printable-dossier .dark\\:bg-slate-900,
          #customer-printable-dossier .dark\\:bg-slate-900\\/80,
          #customer-printable-dossier .dark\\:bg-slate-900\\/90,
          #customer-printable-dossier .dark\\:bg-slate-900\\/60,
          #customer-printable-dossier .dark\\:bg-slate-900\\/70,
          #customer-printable-dossier .dark\\:bg-slate-950,
          #customer-printable-dossier .dark\\:bg-slate-800,
          #customer-printable-dossier .dark\\:bg-\\[\\#0c1222\\] {
            background-color: #ffffff !important;
          }

          /* Deep, crisp text colors for print readability */
          #customer-printable-dossier .dark\\:text-white,
          #customer-printable-dossier .text-white {
            color: #0f172a !important;
          }
          #customer-printable-dossier .dark\\:text-slate-200,
          #customer-printable-dossier .dark\\:text-slate-300 {
            color: #1e293b !important;
          }
          #customer-printable-dossier .dark\\:text-slate-400,
          #customer-printable-dossier .text-slate-400 {
            color: #475569 !important;
          }

          /* High-contrast colored numbers for print */
          #customer-printable-dossier [class*="text-emerald-"] {
            color: #047857 !important;
          }
          #customer-printable-dossier [class*="text-blue-"] {
            color: #1d4ed8 !important;
          }
          #customer-printable-dossier [class*="text-indigo-"] {
            color: #4338ca !important;
          }
          #customer-printable-dossier [class*="text-amber-"] {
            color: #b45309 !important;
          }
          #customer-printable-dossier [class*="text-orange-"] {
            color: #c2410c !important;
          }
          #customer-printable-dossier [class*="text-rose-"] {
            color: #be123c !important;
          }

          /* Clean, refined timeline tiles in print */
          #customer-printable-dossier .timeline-day1_4,
          #customer-printable-dossier .timeline-day5,
          #customer-printable-dossier .timeline-day6,
          #customer-printable-dossier .timeline-day7,
          #customer-printable-dossier .timeline-day8Plus,
          #customer-printable-dossier .timeline-undelivered {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }

          /* Table headers in print */
          #customer-printable-dossier th {
            background-color: #f8fafc !important;
            color: #334155 !important;
            border-bottom: 2px solid #cbd5e1 !important;
            font-weight: 800 !important;
          }

          /* Table row borders & zebra striping in print */
          #customer-printable-dossier td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
          #customer-printable-dossier tbody tr:nth-child(even) td {
            background-color: #f8fafc !important;
          }

          /* Prevent table cutoffs */
          tr, .rounded-2xl, .rounded-xl, table, .grid {
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
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden print:max-h-none print:border-none print:shadow-none print:rounded-none"
      >
        {/* Modal Header */}
        <div className="relative px-6 py-3.5 print:px-2 print:py-2 border-b border-slate-200 dark:border-slate-800 print:border-b-2 print:border-slate-900 bg-slate-50/80 dark:bg-slate-900/60 print:bg-white flex items-center justify-center shrink-0">
          <div className="flex items-center justify-center gap-2.5 text-center">
            <div className="w-8 h-8 print:w-6 print:h-6 rounded-xl print:rounded-md bg-indigo-600 print:bg-slate-900 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building className="w-4 h-4 print:w-3.5 print:h-3.5" />
            </div>
            <h2 className="text-base print:text-lg font-black tracking-tight text-slate-900 dark:text-white print:text-slate-950 uppercase font-sans">
              Export Summary
            </h2>
          </div>

          {/* Action Buttons: Copy Email, Print PDF, Close */}
          <div className="absolute right-6 flex items-center gap-2 shrink-0 no-print">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4 print:p-0 print:space-y-2 print:overflow-visible">

          {/* Account & Scope Banner with CENTERED TIME PERIOD & CUSTOMER */}
          <div className="p-4 print:p-2 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center justify-center text-center gap-1.5 print:gap-1 shadow-xs">
            <div className="flex flex-col items-center justify-center text-center w-full">
              <h3 className="text-xl print:text-lg font-black text-slate-950 dark:text-white print:text-slate-950 tracking-tight text-center">
                {summaryTitle}
              </h3>
              
              {/* Subtle, Understated Time Period & Destination */}
              <div className="flex items-center justify-center gap-3 mt-1 print:mt-0.5 flex-wrap text-xs print:text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-mono">
                <div className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 print:text-slate-500 shrink-0" />
                  <span>Time Period: <strong className="font-semibold text-slate-800 dark:text-slate-200 print:text-slate-900">{timePeriodLabel}</strong></span>
                </div>

                {currentDestination && currentDestination !== 'ALL' && (
                  <div className="inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400 print:text-slate-500 shrink-0" />
                    <span>Destination: <strong className="font-semibold text-slate-800 dark:text-slate-200 print:text-slate-900">{currentDestination}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Customer Switcher Dropdown (Centered, Hidden when printing) */}
            <div className="relative w-full max-w-xs shrink-0 no-print mt-0.5">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer shadow-xs"
              >
                <span className="truncate">{effectiveCustomer || 'Switch Customer...'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>

              {isDropdownOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-95">
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
          <div className={`grid gap-3 print:gap-2 ${
            metrics.timeline.undelivered > 0
              ? 'grid-cols-2 sm:grid-cols-4 print:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-3 print:grid-cols-3'
          }`}>
            {/* Total Shipments */}
            <div className="kpi-card p-3.5 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[11px] print:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                <span>Total Shipments</span>
                <Package className="w-3.5 h-3.5 text-blue-600 print:w-3 print:h-3" />
              </div>
              <div className="text-2xl print:text-xl font-black text-slate-900 dark:text-white print:text-slate-950 mt-1 print:mt-0.5 font-mono">
                {metrics.total.toLocaleString()}
              </div>
              <div className="text-[10.5px] print:text-[9.5px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-mono mt-0.5">
                Gross: <strong className="text-slate-700 dark:text-slate-200 print:text-slate-800">{formatWeight(metrics.totalWeight)} kg</strong>
              </div>
            </div>

            {/* ON-TIME DELIVERY */}
            <div className="kpi-card p-3.5 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[11px] print:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                <span>ON-TIME DELIVERY</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 print:w-3 print:h-3" />
              </div>
              <div
                className={`text-2xl print:text-xl font-black mt-1 print:mt-0.5 font-mono ${
                  metrics.onTimeRate >= 70
                    ? 'text-emerald-700 dark:text-emerald-400 print:text-emerald-700'
                    : metrics.onTimeRate >= 50
                    ? 'text-amber-700 dark:text-amber-400 print:text-amber-700'
                    : 'text-rose-700 dark:text-rose-400 print:text-rose-700'
                }`}
              >
                {metrics.onTimeRate.toFixed(1)}%
              </div>
            </div>

            {/* Average Transit Time */}
            <div className="kpi-card p-3.5 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center justify-center text-center shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[11px] print:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                <span>Avg Transit Time</span>
                <Clock className="w-3.5 h-3.5 text-indigo-600 print:w-3 print:h-3" />
              </div>
              <div className="text-2xl print:text-xl font-black text-indigo-700 dark:text-indigo-400 print:text-indigo-700 mt-1 print:mt-0.5 font-mono">
                {metrics.avgTT > 0 ? `${metrics.avgTT.toFixed(2)}d` : '-'}
              </div>
            </div>

            {/* Undelivered Shipments (Only shown if any) */}
            {metrics.timeline.undelivered > 0 && (
              <div className="kpi-card p-3.5 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="flex items-center justify-center gap-1.5 text-[11px] print:text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider">
                  <span>UNDELIVERED</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 print:w-3 print:h-3" />
                </div>
                <div className="text-2xl print:text-xl font-black text-amber-700 dark:text-amber-400 print:text-amber-700 mt-1 print:mt-0.5 font-mono">
                  {metrics.timeline.undelivered}
                </div>
                <div className="text-[10.5px] print:text-[9.5px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-mono mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.undelivered / metrics.total) * 100).toFixed(1) : '0.0'}% of scope
                </div>
              </div>
            )}
          </div>

          {/* Delivery Timeline Breakdown */}
          <div className="p-4 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900 print:bg-white border border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 print:text-slate-800 tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500 print:hidden" />
              Delivery Timeline
            </h4>
            <div className={`grid gap-2 print:gap-1.5 text-center ${
              metrics.timeline.undelivered > 0
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-5'
            }`}>
              {/* Day 1-4 */}
              <div className="timeline-day1_4 p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                <div className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 print:text-emerald-800 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Day 1–4
                </div>
                <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                  {metrics.timeline.day1_4}
                </div>
                <div className="text-[11px] print:text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400 print:text-emerald-800 mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.day1_4 / metrics.total) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>

              {/* Day 5 */}
              <div className="timeline-day5 p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                <div className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-400 print:text-blue-800 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Day 5
                </div>
                <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                  {metrics.timeline.day5}
                </div>
                <div className="text-[11px] print:text-[10px] font-bold font-mono text-blue-700 dark:text-blue-400 print:text-blue-800 mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.day5 / metrics.total) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>

              {/* Day 6 */}
              <div className="timeline-day6 p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                <div className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 print:text-amber-800 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Day 6
                </div>
                <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                  {metrics.timeline.day6}
                </div>
                <div className="text-[11px] print:text-[10px] font-bold font-mono text-amber-700 dark:text-amber-400 print:text-amber-800 mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.day6 / metrics.total) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>

              {/* Day 7 */}
              <div className="timeline-day7 p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                <div className="text-[10px] font-black uppercase text-orange-800 dark:text-orange-400 print:text-orange-800 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Day 7
                </div>
                <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                  {metrics.timeline.day7}
                </div>
                <div className="text-[11px] print:text-[10px] font-bold font-mono text-orange-700 dark:text-orange-400 print:text-orange-800 mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.day7 / metrics.total) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>

              {/* Day 8+ */}
              <div className="timeline-day8Plus p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                <div className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-400 print:text-rose-800 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Day 8+
                </div>
                <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                  {metrics.timeline.day8Plus}
                </div>
                <div className="text-[11px] print:text-[10px] font-bold font-mono text-rose-700 dark:text-rose-400 print:text-rose-800 mt-0.5">
                  {metrics.total > 0 ? ((metrics.timeline.day8Plus / metrics.total) * 100).toFixed(1) : '0.0'}%
                </div>
              </div>

              {/* UNDELIVERED (Only shown if any) */}
              {metrics.timeline.undelivered > 0 && (
                <div className="timeline-undelivered p-2.5 print:p-1.5 rounded-xl print:rounded-lg bg-slate-50/80 dark:bg-slate-800/40 print:bg-slate-50/80 border border-slate-200 dark:border-slate-700/60 print:border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 print:text-slate-700 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    UNDELIVERED
                  </div>
                  <div className="text-lg print:text-base font-black text-slate-900 dark:text-white print:text-slate-900 font-mono mt-0.5">
                    {metrics.timeline.undelivered}
                  </div>
                  <div className="text-[11px] print:text-[10px] font-bold font-mono text-slate-600 dark:text-slate-400 print:text-slate-700 mt-0.5">
                    {metrics.total > 0 ? ((metrics.timeline.undelivered / metrics.total) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Two Columns: Destination Details & Destination Delay Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2.5">
            
            {/* Top Destinations */}
            <div className="p-4 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-500 print:hidden" />
                Destination Details
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs print:text-[10.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-black">
                      <th className="py-2 print:py-1 text-center">Destination</th>
                      <th className="py-2 print:py-1 text-center">AWBs</th>
                      <th className="py-2 print:py-1 text-center">Weight</th>
                      <th className="py-2 print:py-1 text-center">Avg TT</th>
                      <th className="py-2 print:py-1 text-center">On-Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metrics.destinations.slice(0, 8).map((d, idx) => (
                      <tr key={d.dest} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${idx >= 6 ? 'print:hidden' : ''}`}>
                        <td className="py-2 print:py-1 text-center font-bold text-slate-800 dark:text-slate-200">{d.dest}</td>
                        <td className="py-2 print:py-1 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {d.count}
                        </td>
                        <td className="py-2 print:py-1 text-center font-mono text-slate-500 dark:text-slate-400">
                          {formatWeight(d.weight)} kg
                        </td>
                        <td className="py-2 print:py-1 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400 print:text-indigo-700">
                          {d.avgTT > 0 ? `${d.avgTT.toFixed(1)}d` : '-'}
                        </td>
                        <td className="py-2 print:py-1 text-center font-mono font-black text-emerald-700 dark:text-emerald-400 print:text-emerald-700">
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

            {/* Delay Categories Table */}
            <div className="p-4 print:p-2.5 rounded-2xl print:rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 print:hidden" />
                  Delay Categories
                </h4>
                <div className="flex items-center gap-2">
                  <span className="no-print text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {selectedPrintCategories.length}/{metrics.delayCategories.length} for Print
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 print:text-slate-500 font-medium">
                    ({selectedPrintImpactedCount} Impacted AWBs)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-64 print:max-h-none overflow-y-auto print:overflow-visible">
                <table className="w-full text-xs print:text-[10.5px]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-black">
                      <th className="py-2 print:py-1 text-center w-8 no-print" title="Toggle Select All">
                        <input
                          type="checkbox"
                          checked={allDelaysSelected}
                          onChange={toggleAllDelays}
                          aria-label="Select or deselect all categories for PDF printing"
                          className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                        />
                      </th>
                      <th className="py-2 print:py-1 text-center">Delay Category</th>
                      <th className="py-2 print:py-1 text-center">Impacted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metrics.delayCategories.map((item, idx) => {
                      const isSelected = !unselectedDelayCategories.has(item.category);
                      return (
                        <tr
                          key={`${item.category}-${idx}`}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            !isSelected ? 'print:hidden opacity-45 bg-slate-100/50 dark:bg-slate-900/40' : ''
                          }`}
                        >
                          <td className="py-2 print:py-1 text-center w-8 no-print">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDelayCategory(item.category)}
                              aria-label={`Include ${item.category} in PDF print`}
                              className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                            />
                          </td>
                          <td className="py-2 print:py-1 text-center text-slate-700 dark:text-slate-300 font-medium truncate max-w-[280px]" title={item.category}>
                            {item.category}
                          </td>
                          <td className="py-2 print:py-1 text-center font-mono font-bold text-amber-700 dark:text-amber-400 print:text-amber-700">
                            {item.count} AWBs
                          </td>
                        </tr>
                      );
                    })}
                    {metrics.delayCategories.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-xs text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Clean Performance</span>
                            <span>No delay categories recorded.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
            <pre className="p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto whitespace-pre leading-relaxed max-h-40">
              {emailSummaryText}
            </pre>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-end gap-2 shrink-0 no-print">
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
  );
};
