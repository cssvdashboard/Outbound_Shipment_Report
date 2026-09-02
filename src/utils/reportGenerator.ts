import { Shipment, MetricSummary, CountryPerformance, RatioBreakdown } from '../types/logistics';

export interface NarrativeReport {
  title: string;
  generatedAt: string;
  totalShipments: number;
  onTimeRate: number;
  avgTT: number;
  minTT: number;
  maxTT: number;
  totalWeightKg: number;
  totalPkgs: number;
  summaryParagraph: string;
  keyTakeaways: string[];
  bottlenecks: string[];
  recommendations: string[];
  criticalExceptions: {
    rtsCount: number;
    lostCount: number;
    destroyedCount: number;
    seizedCount: number;
    undeliveredCount: number;
  };
  topDestinations: { country: string; count: number; onTimeRate: number; avgTT: number }[];
  topDelayCauses: { category: string; reason: string; count: number }[];
  topClientsByVolume: { customer: string; count: number; onTimeRate: number; avgTT: number }[];
}

/**
 * Automatically generates a structured executive narrative based on active shipments and metrics.
 */
export function generateNarrativeReport(
  shipments: Shipment[],
  metrics: MetricSummary,
  countryPerf: CountryPerformance[],
  scopeDescription: string = 'All Outbound Shipments'
): NarrativeReport {
  const total = shipments.length;
  const nowStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (total === 0) {
    return {
      title: `Executive Logistics Briefing — ${scopeDescription}`,
      generatedAt: nowStr,
      totalShipments: 0,
      onTimeRate: 0,
      avgTT: 0,
      minTT: 0,
      maxTT: 0,
      totalWeightKg: 0,
      totalPkgs: 0,
      summaryParagraph: 'No shipment records match the current active filter criteria.',
      keyTakeaways: ['No data available for the selected parameters.'],
      bottlenecks: [],
      recommendations: ['Adjust or reset filter criteria to include active shipments.'],
      criticalExceptions: { rtsCount: 0, lostCount: 0, destroyedCount: 0, seizedCount: 0, undeliveredCount: 0 },
      topDestinations: [],
      topDelayCauses: [],
      topClientsByVolume: []
    };
  }

  // 1. Critical exceptions tally
  let rtsCount = 0;
  let lostCount = 0;
  let destroyedCount = 0;
  let seizedCount = 0;
  let undeliveredCount = 0;

  // 2. Client performance tally
  const clientMap: Record<string, { count: number; onTime: number; sumTT: number }> = {};
  // 3. Delay cause tallies
  const delayCounts: Record<string, { category: string; reason: string; count: number }> = {};

  for (const s of shipments) {
    const res = (s.finalResolution || '').toLowerCase();
    if (res.includes('rts')) rtsCount++;
    if (res.includes('lost')) lostCount++;
    if (res.includes('destroy')) destroyedCount++;
    if (res.includes('seiz')) seizedCount++;
    if (res.includes('undelivered')) undeliveredCount++;

    // Client tally
    const cust = (s.customer || 'Unknown').trim();
    if (!clientMap[cust]) clientMap[cust] = { count: 0, onTime: 0, sumTT: 0 };
    clientMap[cust].count++;
    clientMap[cust].sumTT += s.tt;
    if (s.ttRange === 'Within 4-5 Days' || (s.tt > 0 && s.tt <= 5)) {
      clientMap[cust].onTime++;
    }

    // Delays
    if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') {
      const k = `Transit: ${s.transitDelay}`;
      if (!delayCounts[k]) delayCounts[k] = { category: 'Transit', reason: s.transitDelay, count: 0 };
      delayCounts[k].count++;
    }
    if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') {
      const k = `Clearance: ${s.clearanceDelay}`;
      if (!delayCounts[k]) delayCounts[k] = { category: 'Customs Clearance', reason: s.clearanceDelay, count: 0 };
      delayCounts[k].count++;
    }
    if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') {
      const k = `Destination: ${s.destinationDelay}`;
      if (!delayCounts[k]) delayCounts[k] = { category: 'Destination Hub', reason: s.destinationDelay, count: 0 };
      delayCounts[k].count++;
    }
  }

  // Top clients by volume
  const topClientsByVolume = Object.entries(clientMap)
    .map(([customer, data]) => ({
      customer,
      count: data.count,
      onTimeRate: Math.round((data.onTime / data.count) * 1000) / 10,
      avgTT: Math.round((data.sumTT / data.count) * 10) / 10
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top destinations
  const topDestinations = countryPerf
    .slice(0, 5)
    .map((c) => ({
      country: c.countryCode,
      count: c.awbCount,
      onTimeRate: c.onTimePercentage,
      avgTT: c.avgTT
    }));

  // Top delay root causes
  const topDelayCauses = Object.values(delayCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // SLA health category
  const onTimeRate = metrics.onTimePercentage;
  const isHealthy = onTimeRate >= 85;
  const isModerate = onTimeRate >= 70 && onTimeRate < 85;

  // Build Summary Narrative Paragraph
  const totalExc = rtsCount + lostCount + destroyedCount + seizedCount + undeliveredCount;
  const topDestStr = topDestinations.length > 0 ? topDestinations[0].country : 'global destinations';
  
  const summaryParagraph = `During this reporting cycle, a total of ${total.toLocaleString()} outbound air shipments (${metrics.totalWeight.toLocaleString()} kg total gross weight) were processed across ${countryPerf.length} international destinations. The overall On-Time SLA delivery rate stands at ${onTimeRate}%, with an average transit time of ${metrics.avgTT} days. ${topDestStr} represented the highest volume destination lane. Total critical operational exceptions accounted for ${totalExc} AWBs (${Math.round((totalExc / total) * 1000) / 10}% of total volume).`;

  // Key Takeaways
  const keyTakeaways: string[] = [
    `Volume & Velocity: ${total.toLocaleString()} total AWBs processed with ${metrics.avgTT} days average end-to-end turnaround time.`,
    `On-Time SLA: ${onTimeRate}% of shipments met the standard transit SLA (${metrics.onTimeCount.toLocaleString()} delivered within 4-5 days).`,
    topDestinations.length > 0
      ? `Primary Route: ${topDestinations[0].country} led with ${topDestinations[0].count.toLocaleString()} shipments (${topDestinations[0].onTimeRate}% on-time rate, ${topDestinations[0].avgTT} days avg TT).`
      : 'Primary destinations operational across all outbound lanes.',
    totalExc > 0
      ? `Operational Exceptions: ${totalExc} shipments flagged (${rtsCount} RTS, ${lostCount} Lost, ${seizedCount} Seized, ${destroyedCount} Destroyed).`
      : 'Zero critical lost, seized, or destroyed cargo exceptions reported.'
  ];

  // Bottlenecks
  const bottlenecks: string[] = [];
  if (metrics.clearanceDelayCount > 0) {
    bottlenecks.push(`Customs Clearance: ${metrics.clearanceDelayCount.toLocaleString()} shipments experienced customs/documentation holds (${Math.round((metrics.clearanceDelayCount / total) * 1000) / 10}% of volume).`);
  }
  if (metrics.transitDelayCount > 0) {
    bottlenecks.push(`Airline & Transit: ${metrics.transitDelayCount.toLocaleString()} shipments affected by airline flight schedule delays or hub transfers.`);
  }
  if (metrics.destinationDelayCount > 0) {
    bottlenecks.push(`Last-Mile & Destination Delivery: ${metrics.destinationDelayCount.toLocaleString()} shipments held due to consignee availability or address verification.`);
  }
  if (topDelayCauses.length > 0) {
    bottlenecks.push(`Top Root-Cause Driver: "${topDelayCauses[0].reason}" under ${topDelayCauses[0].category} with ${topDelayCauses[0].count.toLocaleString()} occurrences.`);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (metrics.clearanceDelayCount > metrics.transitDelayCount) {
    recommendations.push('Establish pre-clearance EDI data validation with destination brokerages to reduce customs documentation holds prior to flight arrival.');
  } else {
    recommendations.push('Review direct airline allocations on high-volume lanes to minimize multi-leg transit connection delays.');
  }
  if (rtsCount > 0) {
    recommendations.push(`Implement automated recipient address validation at pickup to mitigate the ${rtsCount} Return-To-Shipper (RTS) instances.`);
  }
  if (topClientsByVolume.some((c) => c.onTimeRate < 75)) {
    const laggingClient = topClientsByVolume.find((c) => c.onTimeRate < 75);
    recommendations.push(`Conduct a dedicated lane review with key account "${laggingClient?.customer}" whose current on-time rate is ${laggingClient?.onTimeRate}%.`);
  }
  recommendations.push('Maintain weekly operational exception tracking to ensure faster resolution on pending clearance shipments.');

  return {
    title: `Executive Logistics Briefing — ${scopeDescription}`,
    generatedAt: nowStr,
    totalShipments: total,
    onTimeRate,
    avgTT: metrics.avgTT,
    minTT: metrics.minTT,
    maxTT: metrics.maxTT,
    totalWeightKg: metrics.totalWeight,
    totalPkgs: metrics.totalPkgs,
    summaryParagraph,
    keyTakeaways,
    bottlenecks,
    recommendations,
    criticalExceptions: { rtsCount, lostCount, destroyedCount, seizedCount, undeliveredCount },
    topDestinations,
    topDelayCauses,
    topClientsByVolume
  };
}

/**
 * Formats report data into plain text / markdown ideal for copying to Email, Slack, or Microsoft Teams.
 */
export function formatReportForClipboard(
  report: NarrativeReport,
  reportType: 'executive' | 'client' | 'country' | 'delay' = 'executive',
  clientOrScopeName?: string
): string {
  const divider = '------------------------------------------------------------';
  const subDivider = '============================================================';

  let text = `📦 ${report.title.toUpperCase()}\n`;
  text += `Generated: ${report.generatedAt}\n`;
  text += `${subDivider}\n\n`;

  text += `📊 EXECUTIVE SUMMARY\n`;
  text += `${report.summaryParagraph}\n\n`;

  text += `📈 KEY PERFORMANCE INDICATORS\n`;
  text += `${divider}\n`;
  text += `• Total Volume:          ${report.totalShipments.toLocaleString()} AWBs\n`;
  text += `• Total Weight:          ${report.totalWeightKg.toLocaleString()} kg (${report.totalPkgs.toLocaleString()} packages)\n`;
  text += `• On-Time SLA (<= 5 d):  ${report.onTimeRate}%\n`;
  text += `• Avg Transit Time:      ${report.avgTT} days (Min: ${report.minTT}d, Max: ${report.maxTT}d)\n`;
  text += `• Critical Exceptions:   ${report.criticalExceptions.rtsCount + report.criticalExceptions.lostCount + report.criticalExceptions.seizedCount + report.criticalExceptions.destroyedCount} AWBs\n\n`;

  text += `💡 KEY TAKEAWAYS & HIGHLIGHTS\n`;
  text += `${divider}\n`;
  report.keyTakeaways.forEach((k) => {
    text += `✔ ${k}\n`;
  });
  text += `\n`;

  if (report.bottlenecks.length > 0) {
    text += `⚠️ OPERATIONAL BOTTLENECKS & DELAY DRIVERS\n`;
    text += `${divider}\n`;
    report.bottlenecks.forEach((b) => {
      text += `• ${b}\n`;
    });
    text += `\n`;
  }

  if (report.topDestinations.length > 0) {
    text += `🌍 TOP DESTINATION LANES\n`;
    text += `${divider}\n`;
    report.topDestinations.forEach((d, idx) => {
      text += `${idx + 1}. ${d.country.padEnd(6)} | Volume: ${d.count.toLocaleString().padEnd(6)} | On-Time: ${d.onTimeRate}% | Avg TT: ${d.avgTT}d\n`;
    });
    text += `\n`;
  }

  if (report.topClientsByVolume.length > 0 && reportType !== 'client') {
    text += `🏢 TOP CUSTOMERS BY VOLUME\n`;
    text += `${divider}\n`;
    report.topClientsByVolume.forEach((c, idx) => {
      text += `${idx + 1}. ${c.customer.slice(0, 22).padEnd(23)} | Volume: ${c.count.toLocaleString().padEnd(6)} | On-Time: ${c.onTimeRate}% | Avg TT: ${c.avgTT}d\n`;
    });
    text += `\n`;
  }

  text += `🎯 ACTIONABLE RECOMMENDATIONS\n`;
  text += `${divider}\n`;
  report.recommendations.forEach((r, idx) => {
    text += `${idx + 1}. ${r}\n`;
  });
  text += `\n${subDivider}\n`;
  text += `Report generated via Outbound Shipment Logistics Intelligence Platform.`;

  return text;
}

/**
 * Generates a self-contained, standalone HTML document ready for download and offline viewing/sharing.
 */
export function generateStandaloneHTMLReport(
  report: NarrativeReport,
  scopeTitle: string = 'Executive Outbound Logistics Report'
): string {
  const statusColor = report.onTimeRate >= 80 ? '#10b981' : report.onTimeRate >= 65 ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${report.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
      padding: 32px 20px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 32px;
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    .header .meta {
      font-size: 13px;
      color: #94a3b8;
    }
    .content {
      padding: 32px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .kpi-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
      margin-top: 28px;
    }
    .narrative-box {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 18px 20px;
      border-radius: 8px;
      font-size: 14.5px;
      color: #0369a1;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .list-item {
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13.5px;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .list-item:last-child { border-bottom: none; }
    .bullet-icon { color: #0284c7; font-weight: bold; }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    .table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
    }
    .table td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
    }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .container { border: none; box-shadow: none; max-width: 100%; }
      .header { background: #0f172a !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-badge">Confidential Executive Briefing</div>
      <h1>${report.title}</h1>
      <div class="meta">Generated on ${report.generatedAt} • Automated Operations Audit</div>
    </div>

    <div class="content">
      <div class="narrative-box">
        <strong>Executive Overview:</strong> ${report.summaryParagraph}
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Total Shipments</div>
          <div class="kpi-value">${report.totalShipments.toLocaleString()}</div>
          <div class="kpi-sub">Outbound AWBs</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">On-Time SLA</div>
          <div class="kpi-value" style="color: ${statusColor}">${report.onTimeRate}%</div>
          <div class="kpi-sub">Within 4-5 Days</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Avg Transit Time</div>
          <div class="kpi-value">${report.avgTT} <span style="font-size: 16px">days</span></div>
          <div class="kpi-sub">Min: ${report.minTT}d • Max: ${report.maxTT}d</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Gross Volume</div>
          <div class="kpi-value">${report.totalWeightKg.toLocaleString()} <span style="font-size: 16px">kg</span></div>
          <div class="kpi-sub">${report.totalPkgs.toLocaleString()} packages</div>
        </div>
      </div>

      <div class="section-title">Key Operational Highlights</div>
      <div>
        ${report.keyTakeaways.map((k) => `<div class="list-item"><span class="bullet-icon">✔</span><span>${k}</span></div>`).join('')}
      </div>

      ${
        report.bottlenecks.length > 0
          ? `
      <div class="section-title">Delay Drivers & Bottlenecks</div>
      <div>
        ${report.bottlenecks.map((b) => `<div class="list-item"><span class="bullet-icon" style="color: #ea580c">⚠️</span><span>${b}</span></div>`).join('')}
      </div>`
          : ''
      }

      ${
        report.topDestinations.length > 0
          ? `
      <div class="section-title">Top Destination Performance</div>
      <table class="table">
        <thead>
          <tr>
            <th>Destination Country</th>
            <th>Volume (AWBs)</th>
            <th>On-Time SLA Rate</th>
            <th>Avg Transit Time</th>
          </tr>
        </thead>
        <tbody>
          ${report.topDestinations
            .map(
              (d) => `
            <tr>
              <td><strong>${d.country}</strong></td>
              <td>${d.count.toLocaleString()}</td>
              <td><span class="badge ${d.onTimeRate >= 80 ? 'badge-green' : d.onTimeRate >= 65 ? 'badge-amber' : 'badge-red'}">${d.onTimeRate}%</span></td>
              <td>${d.avgTT} days</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
          : ''
      }

      <div class="section-title">Strategic Action Items & Next Steps</div>
      <div>
        ${report.recommendations.map((r, i) => `<div class="list-item"><span class="bullet-icon"><strong>${i + 1}.</strong></span><span>${r}</span></div>`).join('')}
      </div>
    </div>

    <div class="footer">
      Generated automatically by Outbound Shipment Report Intelligence • Confidential & Proprietary
    </div>
  </div>
</body>
</html>`;
}
