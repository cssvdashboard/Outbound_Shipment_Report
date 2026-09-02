import React, { useState, useMemo } from 'react';
import {
  Shipment,
  MetricSummary,
  CountryPerformance,
  RatioBreakdown,
  FilterState
} from '../types/logistics';
import {
  generateNarrativeReport,
  formatReportForClipboard,
  generateStandaloneHTMLReport,
  NarrativeReport
} from '../utils/reportGenerator';
import {
  Printer,
  Share2,
  Copy,
  Download,
  Check,
  FileText,
  Building2,
  Globe2,
  AlertTriangle,
  TrendingUp,
  Clock,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  AlertOctagon
} from 'lucide-react';

interface ExecutiveReportHubProps {
  shipments: Shipment[];
  rawShipments: Shipment[];
  metrics: MetricSummary;
  countryPerformance: CountryPerformance[];
  deliveryTimeline: RatioBreakdown[];
  finalResolutions: RatioBreakdown[];
  allCustomers: string[];
  allDestinations: string[];
  activeFilters: FilterState;
  onApplyCustomerFilter: (customer: string) => void;
  onApplyDestinationFilter: (dest: string) => void;
}

type ReportProfile = 'briefing' | 'scorecard' | 'country' | 'exceptions';

export const ExecutiveReportHub: React.FC<ExecutiveReportHubProps> = ({
  shipments,
  rawShipments,
  metrics,
  countryPerformance,
  deliveryTimeline,
  finalResolutions,
  allCustomers,
  allDestinations,
  activeFilters,
  onApplyCustomerFilter,
  onApplyDestinationFilter
}) => {
  const [profile, setProfile] = useState<ReportProfile>('briefing');
  const [customTitle, setCustomTitle] = useState<string>('Outbound Shipment Executive Intelligence Report');
  const [preparedFor, setPreparedFor] = useState<string>('Executive Leadership & Operations Stakeholders');
  const [selectedClientScorecard, setSelectedClientScorecard] = useState<string>(
    activeFilters.selectedCustomers[0] || (allCustomers.length > 0 ? allCustomers[0] : '')
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute scope description based on filters
  const scopeDescription = useMemo(() => {
    const parts: string[] = [];
    if (activeFilters.selectedCustomers.length > 0) {
      parts.push(`Customer: ${activeFilters.selectedCustomers.join(', ')}`);
    }
    if (activeFilters.selectedDestinations.length > 0) {
      parts.push(`Destination: ${activeFilters.selectedDestinations.join(', ')}`);
    }
    if (activeFilters.selectedCategoryType && activeFilters.selectedCategoryType !== 'ALL') {
      parts.push(`Category: ${activeFilters.selectedCategoryType}`);
    }
    if (activeFilters.selectedFinalResolutions.length > 0) {
      parts.push(`Resolution: ${activeFilters.selectedFinalResolutions.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(' | ') : 'Entire Outbound Network';
  }, [activeFilters]);

  // Generate automated narrative report
  const narrativeReport: NarrativeReport = useMemo(() => {
    return generateNarrativeReport(shipments, metrics, countryPerformance, scopeDescription);
  }, [shipments, metrics, countryPerformance, scopeDescription]);

  // Handle Copy Email / Slack Summary
  const handleCopySummary = async () => {
    try {
      const summaryText = formatReportForClipboard(narrativeReport, profile === 'scorecard' ? 'client' : 'executive', selectedClientScorecard);
      await navigator.clipboard.writeText(summaryText);
      showToast('📋 Executive summary copied to clipboard! Ready to paste into Email, Slack, or Teams.');
    } catch (err) {
      showToast('Could not access clipboard directly. Please check browser permissions.');
    }
  };

  // Handle Copy Shareable Link
  const handleCopyShareableLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'reports');
      url.searchParams.set('profile', profile);
      if (activeFilters.selectedCustomers.length > 0) {
        url.searchParams.set('cust', activeFilters.selectedCustomers[0]);
      }
      if (activeFilters.selectedDestinations.length > 0) {
        url.searchParams.set('dest', activeFilters.selectedDestinations[0]);
      }
      if (activeFilters.selectedCategoryType && activeFilters.selectedCategoryType !== 'ALL') {
        url.searchParams.set('cat', activeFilters.selectedCategoryType);
      }
      await navigator.clipboard.writeText(url.toString());
      showToast('🔗 Shareable Report URL copied! Anyone opening this link will see this exact filtered report.');
    } catch (err) {
      showToast('Share link copied to address bar.');
    }
  };

  // Handle Download Standalone HTML
  const handleDownloadHTML = () => {
    const htmlContent = generateStandaloneHTMLReport(narrativeReport, customTitle);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Logistics_Executive_Report_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Standalone HTML Report downloaded! Open in any browser or email as an offline attachment.');
  };

  // Handle Print / Save as PDF
  const handlePrintPDF = () => {
    window.print();
  };

  // Client Scorecard specific data
  const clientScorecardData = useMemo(() => {
    if (!selectedClientScorecard) return null;
    const clientShipments = rawShipments.filter(
      (s) => (s.customer || '').trim().toLowerCase() === selectedClientScorecard.trim().toLowerCase()
    );
    if (clientShipments.length === 0) return null;

    const total = clientShipments.length;
    let onTime = 0;
    let sumTT = 0;
    let totalWeight = 0;
    let clearanceDelays = 0;
    let transitDelays = 0;
    let destDelays = 0;
    const destCounts: Record<string, number> = {};
    const resCounts: Record<string, number> = {};

    for (const s of clientShipments) {
      if (s.ttRange === 'Within 4-5 Days' || (s.tt > 0 && s.tt <= 5)) onTime++;
      sumTT += s.tt;
      totalWeight += s.weight || 0;
      if (s.clearanceDelay && s.clearanceDelay !== '-') clearanceDelays++;
      if (s.transitDelay && s.transitDelay !== '-') transitDelays++;
      if (s.destinationDelay && s.destinationDelay !== '-') destDelays++;

      const dest = s.destination || 'Unknown';
      destCounts[dest] = (destCounts[dest] || 0) + 1;

      const res = s.finalResolution || 'Delivered';
      resCounts[res] = (resCounts[res] || 0) + 1;
    }

    return {
      customer: selectedClientScorecard,
      totalCount: total,
      onTimeRate: Math.round((onTime / total) * 1000) / 10,
      avgTT: Math.round((sumTT / total) * 10) / 10,
      totalWeight: Math.round(totalWeight * 10) / 10,
      clearanceDelays,
      transitDelays,
      destDelays,
      topDests: Object.entries(destCounts)
        .map(([dest, count]) => ({ dest, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4),
      resolutions: Object.entries(resCounts)
        .map(([res, count]) => ({ res, count }))
        .sort((a, b) => b.count - a.count)
    };
  }, [selectedClientScorecard, rawShipments]);

  return (
    <div className="space-y-6 animate-fade-in print:p-0">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center gap-3 text-xs font-bold animate-bounce print:hidden">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP CONTROLS & ACTION SUITE (Hidden during print) */}
      <div className="print:hidden space-y-4">
        {/* Profile Tabs & Main Action Buttons */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
          
          {/* Profile Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'briefing', label: 'Executive Briefing', icon: FileText, desc: 'High-level C-Suite brief & narrative' },
              { id: 'scorecard', label: 'Client Scorecard', icon: Building2, desc: 'Single customer / partner audit' },
              { id: 'country', label: 'Destination Audit', icon: Globe2, desc: 'Country routing & clearance SLA' },
              { id: 'exceptions', label: 'Exceptions & Delay Audit', icon: AlertTriangle, desc: 'Root cause delays & RTS items' }
            ].map((p) => {
              const Icon = p.icon;
              const isActive = profile === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfile(p.id as ReportProfile)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={p.desc}
                >
                  <Icon className="w-4 h-4" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Share & Export Action Suite */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-extrabold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Print document or Save as clean PDF report"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400 dark:text-sky-600" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleCopyShareableLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Copy shareable link with current filters"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Share Link</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Copy formatted text for Slack, Outlook, or Teams"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-500" />
              <span>Copy for Email/Slack</span>
            </button>

            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
              title="Download standalone offline HTML file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>

        {/* Report Customizer Metadata Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">Report Scope:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-semibold truncate">
              {scopeDescription}
            </span>
          </div>

          {profile === 'scorecard' && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">Select Account:</span>
              <select
                value={selectedClientScorecard}
                onChange={(e) => setSelectedClientScorecard(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {allCustomers.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Records in report: <strong className="text-slate-800 dark:text-slate-200">{shipments.length.toLocaleString()}</strong> of {rawShipments.length.toLocaleString()} total
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMAL PUBLICATION REPORT CONTAINER (Clean for Print & Screen View)       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* REPORT HEADER BANNER */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-extrabold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Executive Operations Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {profile === 'briefing' && 'Executive Logistics Briefing'}
                {profile === 'scorecard' && `Client Performance Scorecard: ${selectedClientScorecard || 'All Accounts'}`}
                {profile === 'country' && 'Global Destination Lane Audit'}
                {profile === 'exceptions' && 'Delay Root-Cause & Exception Audit'}
              </h1>
            </div>

            <div className="text-right text-xs space-y-0.5 text-slate-500 dark:text-slate-400">
              <div><strong>Generated:</strong> {narrativeReport.generatedAt}</div>
              <div><strong>Prepared For:</strong> {preparedFor}</div>
              <div><strong>Dataset Scope:</strong> {scopeDescription}</div>
            </div>
          </div>
        </div>

        {/* 1. EXECUTIVE NARRATIVE INSIGHTS BOX */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/50 dark:from-blue-950/30 dark:via-slate-900/80 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-900/50 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>Executive Overview & Narrative</span>
          </div>
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
            {narrativeReport.summaryParagraph}
          </p>
        </div>

        {/* 2. CORE KPI SCORECARD GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Volume</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {narrativeReport.totalShipments.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Outbound Air Shipments</div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">On-Time SLA</div>
            <div className={`text-2xl sm:text-3xl font-black mt-1 ${
              narrativeReport.onTimeRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
              narrativeReport.onTimeRate >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {narrativeReport.onTimeRate}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Within 4-5 Day Target</div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Transit Time</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {narrativeReport.avgTT} <span className="text-sm font-normal text-slate-500">days</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Min: {narrativeReport.minTT}d • Max: {narrativeReport.maxTT}d</div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Critical Exceptions</div>
            <div className={`text-2xl sm:text-3xl font-black mt-1 ${
              (narrativeReport.criticalExceptions.rtsCount + narrativeReport.criticalExceptions.lostCount) > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {(narrativeReport.criticalExceptions.rtsCount + narrativeReport.criticalExceptions.lostCount + narrativeReport.criticalExceptions.seizedCount + narrativeReport.criticalExceptions.destroyedCount).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">RTS / Lost / Seized / Destroyed</div>
          </div>
        </div>

        {/* 3. PROFILE-SPECIFIC CONTENT SECTIONS */}
        {profile === 'briefing' && (
          <div className="space-y-8">
            {/* Key Takeaways & Bottlenecks Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Highlights */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Key Operational Takeaways
                </h2>
                <div className="space-y-2.5">
                  {narrativeReport.keyTakeaways.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                        ✓
                      </span>
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delay Drivers */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-amber-500" />
                  Delay Drivers & Bottlenecks
                </h2>
                <div className="space-y-2.5">
                  {narrativeReport.bottlenecks.length > 0 ? (
                    narrativeReport.bottlenecks.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                          !
                        </span>
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-4">No major operational bottlenecks recorded for this scope.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Destinations Summary Table */}
            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Top 5 Destination Volume & SLA Performance</h2>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-extrabold">
                    <tr>
                      <th className="px-4 py-3">Destination Country</th>
                      <th className="px-4 py-3">Volume (AWB)</th>
                      <th className="px-4 py-3">On-Time SLA %</th>
                      <th className="px-4 py-3">Avg Transit Time</th>
                      <th className="px-4 py-3">SLA Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                    {narrativeReport.topDestinations.map((d) => (
                      <tr key={d.country} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{d.country}</td>
                        <td className="px-4 py-3">{d.count.toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold">{d.onTimeRate}%</td>
                        <td className="px-4 py-3">{d.avgTT} days</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            d.onTimeRate >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' :
                            d.onTimeRate >= 65 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                            'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                          }`}>
                            {d.onTimeRate >= 80 ? 'Excellent' : d.onTimeRate >= 65 ? 'Moderate' : 'Underperforming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strategic Recommendations */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white space-y-3">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-sky-300">
                <Sparkles className="w-4 h-4" />
                Strategic Action Items & Next Steps
              </h2>
              <div className="space-y-2">
                {narrativeReport.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-100">
                    <span className="font-bold text-sky-400 shrink-0">{idx + 1}.</span>
                    <span className="leading-snug">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {profile === 'scorecard' && clientScorecardData && (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase">Account Audit</div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">{clientScorecardData.customer}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Account On-Time Rate</div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{clientScorecardData.onTimeRate}%</div>
                  </div>
                </div>
              </div>

              {/* Client Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Shipment Count</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{clientScorecardData.totalCount.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Avg Transit Time</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{clientScorecardData.avgTT} days</div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Gross Weight</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{clientScorecardData.totalWeight.toLocaleString()} kg</div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Total Delays</div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {clientScorecardData.clearanceDelays + clientScorecardData.transitDelays + clientScorecardData.destDelays}
                  </div>
                </div>
              </div>

              {/* Top Destinations for this customer */}
              <div className="pt-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">Key Destination Routes</h3>
                <div className="flex flex-wrap gap-2">
                  {clientScorecardData.topDests.map((d) => (
                    <div key={d.dest} className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                      <strong>{d.dest}</strong>: {d.count.toLocaleString()} shipments
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {profile === 'country' && (
          <div className="space-y-6">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">All Destination Lanes SLA & Bottleneck Breakdown</h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-extrabold">
                  <tr>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3">AWBs</th>
                    <th className="px-4 py-3">Avg TT</th>
                    <th className="px-4 py-3">On-Time %</th>
                    <th className="px-4 py-3">Clearance Delays</th>
                    <th className="px-4 py-3">Transit Delays</th>
                    <th className="px-4 py-3">Dest Delays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                  {countryPerformance.slice(0, 15).map((c) => (
                    <tr key={c.countryCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.countryCode}</td>
                      <td className="px-4 py-3">{c.awbCount.toLocaleString()}</td>
                      <td className="px-4 py-3">{c.avgTT}d</td>
                      <td className="px-4 py-3 font-bold">{c.onTimePercentage}%</td>
                      <td className="px-4 py-3">{c.clearanceDelays}</td>
                      <td className="px-4 py-3">{c.transitDelays}</td>
                      <td className="px-4 py-3">{c.destinationDelays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {profile === 'exceptions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Return-To-Shipper (RTS)</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">{narrativeReport.criticalExceptions.rtsCount}</div>
              </div>
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                <div className="text-xs font-bold text-red-600 dark:text-red-400">Lost / Destroyed</div>
                <div className="text-2xl font-black text-red-700 dark:text-red-300 mt-1">
                  {narrativeReport.criticalExceptions.lostCount + narrativeReport.criticalExceptions.destroyedCount}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">Seized by Customs</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{narrativeReport.criticalExceptions.seizedCount}</div>
              </div>
              <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
                <div className="text-xs font-bold text-orange-600 dark:text-orange-400">Undelivered Holds</div>
                <div className="text-2xl font-black text-orange-700 dark:text-orange-300 mt-1">{narrativeReport.criticalExceptions.undeliveredCount}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Top Delay Root Causes</h2>
              <div className="space-y-2">
                {narrativeReport.topDelayCauses.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400">[{c.category}]</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.reason}</span>
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                      {c.count.toLocaleString()} occurrences
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REPORT FOOTER */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div>Outbound Shipment Report Intelligence Platform • Confidential</div>
          <div>Page 1 of 1 • System Generated Report</div>
        </div>

      </div>

    </div>
  );
};
