import { Shipment } from '../types/logistics';
import { parseShipmentDate } from './calendarAnalytics';

export interface WeeklyTTMetric {
  weekNum: number;
  label: string; // e.g. "Week 1 (Days 1–7)"
  count: number;
  avgTT: number;
  minTT: number;
  maxTT: number;
}

export interface MonthlyMetric {
  monthId: string; // e.g. "2026-07"
  monthLabel: string; // e.g. "July 2026"
  totalAWBs: number;
  totalWeight: number;
  totalPkgs: number;
  momChangeAWB: number | null; // % change in AWBs compared to prior month
  avgTT: number;
  momChangeTT: number | null; // % change in Avg TT compared to prior month
  minTT: number;
  maxTT: number;
  onTimeCount: number;
  onTimePercentage: number;
  delayedCount: number;
  delayedPercentage: number;
  
  // Recorded Delays
  delays: {
    totalDelayed: number;
    delayedPercentage: number;
    transit: { count: number; percentage: number };
    clearance: { count: number; percentage: number };
    destination: { count: number; percentage: number };
    weekend: { count: number; percentage: number };
    topTransitReasons: { reason: string; count: number }[];
    topClearanceReasons: { reason: string; count: number }[];
    topDestinationReasons: { reason: string; count: number }[];
  };

  // Final Resolutions
  resolutions: {
    delivered: { count: number; percentage: number };
    rts: { count: number; percentage: number };
    other: { count: number; percentage: number };
    breakdown: { resolution: string; count: number; percentage: number }[];
  };

  // Weekly TT Metrics (W1 to W5)
  weeks: {
    [weekNum: number]: WeeklyTTMetric;
  };
}

export interface MonthlyComparisonResult {
  months: MonthlyMetric[];
  allMonthIds: string[];
  grandTotalAWBs: number;
  overallAvgTT: number;
  overallOnTimeRate: number;
  availableResolutions: string[];
}

/**
 * Computes comparative monthly metrics across all available months in the dataset.
 */
export function computeMonthlyComparison(
  shipments: Shipment[],
  knownMonths?: string[]
): MonthlyComparisonResult {
  // 1. Group shipments by month (YYYY-MM)
  const monthGroups: Record<string, Shipment[]> = {};

  if (knownMonths && knownMonths.length > 0) {
    knownMonths.forEach((ym) => {
      monthGroups[ym] = [];
    });
  }

  shipments.forEach((s) => {
    const d = parseShipmentDate(s.pickup);
    if (!d) return;
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthGroups[ym]) {
      monthGroups[ym] = [];
    }
    monthGroups[ym].push(s);
  });

  const sortedMonthIds = Object.keys(monthGroups).sort();
  const allResolutionsSet = new Set<string>();

  // 2. Compute metrics for each month
  const monthlyMetrics: MonthlyMetric[] = sortedMonthIds.map((ym, index) => {
    const monthShipments = monthGroups[ym];
    const totalAWBs = monthShipments.length;
    const totalWeight = Math.round(monthShipments.reduce((acc, s) => acc + (s.weight || 0), 0) * 100) / 100;
    const totalPkgs = monthShipments.reduce((acc, s) => acc + (s.pkgCount || 0), 0);

    // Month Label
    const [yearStr, monthStr] = ym.split('-');
    const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Transit Times (only consider valid positive transit times > 0 for minTT)
    const validTTList = monthShipments
      .map((s) => (typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0))
      .filter((tt) => tt > 0);

    const sumTT = monthShipments.reduce((acc, s) => acc + (typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0), 0);
    const avgTT = totalAWBs > 0 ? parseFloat((sumTT / totalAWBs).toFixed(2)) : 0;
    const minTT = validTTList.length > 0 ? parseFloat(Math.min(...validTTList).toFixed(2)) : 0;
    const maxTT = validTTList.length > 0 ? parseFloat(Math.max(...validTTList).toFixed(2)) : 0;

    // On-Time Delivery (<= 5.0 days)
    const onTimeCount = monthShipments.filter((s) => (s.tt || 0) <= 5).length;
    const onTimePercentage = totalAWBs > 0 ? parseFloat(((onTimeCount / totalAWBs) * 100).toFixed(1)) : 0;
    const delayedCount = totalAWBs - onTimeCount;
    const delayedPercentage = totalAWBs > 0 ? parseFloat(((delayedCount / totalAWBs) * 100).toFixed(1)) : 0;

    // Recorded Delays
    let transitCount = 0;
    let clearanceCount = 0;
    let destinationCount = 0;
    let weekendCount = 0;
    let totalWithAnyDelay = 0;

    const transitReasonsMap: Record<string, number> = {};
    const clearanceReasonsMap: Record<string, number> = {};
    const destinationReasonsMap: Record<string, number> = {};

    monthShipments.forEach((s) => {
      let hasDelay = false;

      if (s.transitDelay && s.transitDelay.trim()) {
        transitCount++;
        hasDelay = true;
        const reason = s.transitDelay.trim();
        transitReasonsMap[reason] = (transitReasonsMap[reason] || 0) + 1;
      }
      if (s.clearanceDelay && s.clearanceDelay.trim()) {
        clearanceCount++;
        hasDelay = true;
        const reason = s.clearanceDelay.trim();
        clearanceReasonsMap[reason] = (clearanceReasonsMap[reason] || 0) + 1;
      }
      if (s.destinationDelay && s.destinationDelay.trim()) {
        destinationCount++;
        hasDelay = true;
        const reason = s.destinationDelay.trim();
        destinationReasonsMap[reason] = (destinationReasonsMap[reason] || 0) + 1;
      }
      if (s.weekendDelay && s.weekendDelay.trim()) {
        weekendCount++;
        hasDelay = true;
      }

      if (hasDelay) totalWithAnyDelay++;
    });

    const getTopReasons = (map: Record<string, number>) => {
      return Object.entries(map)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    };

    // Final Resolutions
    const resMap: Record<string, number> = {};
    let deliveredCount = 0;
    let rtsCount = 0;
    let otherResCount = 0;

    monthShipments.forEach((s) => {
      const res = (s.finalResolution || 'Delivered').trim();
      allResolutionsSet.add(res);
      resMap[res] = (resMap[res] || 0) + 1;

      const lowerRes = res.toLowerCase();
      if (lowerRes.includes('delivered')) {
        deliveredCount++;
      } else if (lowerRes.includes('rts') || lowerRes.includes('return to shipper')) {
        rtsCount++;
      } else {
        otherResCount++;
      }
    });

    const resBreakdown = Object.entries(resMap)
      .map(([resolution, count]) => ({
        resolution,
        count,
        percentage: totalAWBs > 0 ? parseFloat(((count / totalAWBs) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Weekly TT (W1 to W5)
    const weekGroups: Record<number, number[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: []
    };

    monthShipments.forEach((s) => {
      const d = parseShipmentDate(s.pickup);
      if (!d) return;
      const dom = d.getUTCDate();
      const weekNum = Math.min(Math.ceil(dom / 7), 5);
      const tt = typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0;
      weekGroups[weekNum].push(tt);
    });

    const weekLabels: Record<number, string> = {
      1: 'Week 1 (Days 1–7)',
      2: 'Week 2 (Days 8–14)',
      3: 'Week 3 (Days 15–21)',
      4: 'Week 4 (Days 22–28)',
      5: 'Week 5 (Days 29+)'
    };

    const weeks: Record<number, WeeklyTTMetric> = {};
    for (let w = 1; w <= 5; w++) {
      const wList = weekGroups[w] || [];
      const validWList = wList.filter((tt) => tt > 0);
      const wCount = wList.length;
      const wSum = wList.reduce((a, b) => a + b, 0);
      const wAvg = wCount > 0 ? parseFloat((wSum / wCount).toFixed(2)) : 0;
      const wMin = validWList.length > 0 ? parseFloat(Math.min(...validWList).toFixed(2)) : 0;
      const wMax = validWList.length > 0 ? parseFloat(Math.max(...validWList).toFixed(2)) : 0;

      weeks[w] = {
        weekNum: w,
        label: weekLabels[w],
        count: wCount,
        avgTT: wAvg,
        minTT: wMin,
        maxTT: wMax
      };
    }

    // MoM Deltas compared to prior month
    let momChangeAWB: number | null = null;
    let momChangeTT: number | null = null;

    if (index > 0) {
      const prevMonthShipments = monthGroups[sortedMonthIds[index - 1]];
      const prevAWB = prevMonthShipments.length;
      if (prevAWB > 0 && totalAWBs > 0) {
        momChangeAWB = parseFloat((((totalAWBs - prevAWB) / prevAWB) * 100).toFixed(1));
      } else if (prevAWB === 0 && totalAWBs > 0) {
        momChangeAWB = 100;
      }

      const prevTTList = prevMonthShipments
        .map((s) => (typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0))
        .filter((tt) => tt >= 0);
      const prevAvgTT = prevTTList.length > 0 ? prevTTList.reduce((a, b) => a + b, 0) / prevTTList.length : 0;
      if (prevAvgTT > 0 && avgTT > 0) {
        momChangeTT = parseFloat((((avgTT - prevAvgTT) / prevAvgTT) * 100).toFixed(1));
      }
    }

    return {
      monthId: ym,
      monthLabel,
      totalAWBs,
      totalWeight,
      totalPkgs,
      momChangeAWB,
      avgTT,
      momChangeTT,
      minTT,
      maxTT,
      onTimeCount,
      onTimePercentage,
      delayedCount,
      delayedPercentage,
      delays: {
        totalDelayed: totalWithAnyDelay,
        delayedPercentage: totalAWBs > 0 ? parseFloat(((totalWithAnyDelay / totalAWBs) * 100).toFixed(1)) : 0,
        transit: {
          count: transitCount,
          percentage: totalAWBs > 0 ? parseFloat(((transitCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        clearance: {
          count: clearanceCount,
          percentage: totalAWBs > 0 ? parseFloat(((clearanceCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        destination: {
          count: destinationCount,
          percentage: totalAWBs > 0 ? parseFloat(((destinationCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        weekend: {
          count: weekendCount,
          percentage: totalAWBs > 0 ? parseFloat(((weekendCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        topTransitReasons: getTopReasons(transitReasonsMap),
        topClearanceReasons: getTopReasons(clearanceReasonsMap),
        topDestinationReasons: getTopReasons(destinationReasonsMap)
      },
      resolutions: {
        delivered: {
          count: deliveredCount,
          percentage: totalAWBs > 0 ? parseFloat(((deliveredCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        rts: {
          count: rtsCount,
          percentage: totalAWBs > 0 ? parseFloat(((rtsCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        other: {
          count: otherResCount,
          percentage: totalAWBs > 0 ? parseFloat(((otherResCount / totalAWBs) * 100).toFixed(1)) : 0
        },
        breakdown: resBreakdown
      },
      weeks
    };
  });

  // Grand totals
  const grandTotalAWBs = shipments.length;
  const allTTs = shipments.map((s) => (typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0));
  const overallAvgTT = grandTotalAWBs > 0 ? parseFloat((allTTs.reduce((a, b) => a + b, 0) / grandTotalAWBs).toFixed(2)) : 0;
  const overallOnTime = shipments.filter((s) => (s.tt || 0) <= 5).length;
  const overallOnTimeRate = grandTotalAWBs > 0 ? parseFloat(((overallOnTime / grandTotalAWBs) * 100).toFixed(1)) : 0;

  return {
    months: monthlyMetrics,
    allMonthIds: sortedMonthIds,
    grandTotalAWBs,
    overallAvgTT,
    overallOnTimeRate,
    availableResolutions: Array.from(allResolutionsSet).sort()
  };
}
