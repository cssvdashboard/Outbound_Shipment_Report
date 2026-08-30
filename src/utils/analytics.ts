import {
  Shipment,
  FilterState,
  MetricSummary,
  RatioBreakdown,
  CountryPerformance,
  CustomerComparisonMetric
} from '../types/logistics';

export function filterShipments(shipments: Shipment[], filters: FilterState): Shipment[] {
  return shipments.filter((item) => {
    // 1. Shipper Filter (supports Include and Filter Out / Exclude)
    if (filters.selectedShippers && filters.selectedShippers.length > 0) {
      const match = filters.selectedShippers.some(
        (s) => s.trim().toLowerCase() === (item.shprName || '').trim().toLowerCase()
      );
      if (filters.filterMode === 'include' && !match) return false;
      if (filters.filterMode === 'exclude' && match) return false;
    }

    // 2. Customer Filter (supports Include and Filter Out / Exclude)
    if (filters.selectedCustomers && filters.selectedCustomers.length > 0) {
      const match = filters.selectedCustomers.some(
        (c) => c.trim().toLowerCase() === (item.customer || '').trim().toLowerCase()
      );
      if (filters.filterMode === 'include' && !match) return false;
      if (filters.filterMode === 'exclude' && match) return false;
    }

    // 3. Destination Country Filter
    if (filters.selectedDestinations && filters.selectedDestinations.length > 0) {
      if (!filters.selectedDestinations.includes(item.destination)) return false;
    }

    // 4. TT Range Filter
    if (filters.selectedTTRanges && filters.selectedTTRanges.length > 0) {
      if (!filters.selectedTTRanges.includes(item.ttRange)) return false;
    }

    // 5. Final Resolution Filter
    if (filters.selectedFinalResolutions && filters.selectedFinalResolutions.length > 0) {
      if (!filters.selectedFinalResolutions.includes(item.finalResolution)) return false;
    }

    // 6. Transit Delay Filter
    if (filters.selectedTransitDelays && filters.selectedTransitDelays.length > 0) {
      if (!item.transitDelay || !filters.selectedTransitDelays.includes(item.transitDelay)) return false;
    }

    // 7. Clearance Delay Filter
    if (filters.selectedClearanceDelays && filters.selectedClearanceDelays.length > 0) {
      if (!item.clearanceDelay || !filters.selectedClearanceDelays.includes(item.clearanceDelay)) return false;
    }

    // 8. Destination Delay Filter
    if (filters.selectedDestinationDelays && filters.selectedDestinationDelays.length > 0) {
      if (!item.destinationDelay || !filters.selectedDestinationDelays.includes(item.destinationDelay)) return false;
    }

    return true;
  });
}

export function computeSummaryMetrics(shipments: Shipment[]): MetricSummary {
  const totalCount = shipments.length;
  if (totalCount === 0) {
    return {
      totalCount: 0,
      totalWeight: 0,
      totalPkgs: 0,
      avgTT: 0,
      minTT: 0,
      maxTT: 0,
      onTimeCount: 0,
      onTimePercentage: 0,
      delayedTimelineCount: 0,
      delayedTimelinePercentage: 0,
      transitDelayCount: 0,
      clearanceDelayCount: 0,
      destinationDelayCount: 0,
      weekendDelayCount: 0
    };
  }

  let totalWeight = 0;
  let totalPkgs = 0;
  let sumTT = 0;
  let minTT = Number.MAX_VALUE;
  let maxTT = 0;
  let onTimeCount = 0;
  let delayedTimelineCount = 0;
  let transitDelayCount = 0;
  let clearanceDelayCount = 0;
  let destinationDelayCount = 0;
  let weekendDelayCount = 0;

  for (let i = 0; i < totalCount; i++) {
    const s = shipments[i];
    totalWeight += s.weight || 0;
    totalPkgs += s.pkgCount || 0;

    const tt = s.tt;
    sumTT += tt;
    if (tt > 0 && tt < minTT) minTT = tt;
    if (tt > maxTT) maxTT = tt;

    if (s.ttRange === 'Within 4-5 Days' || (tt > 0 && tt <= 5)) {
      onTimeCount++;
    } else {
      delayedTimelineCount++;
    }

    if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') {
      transitDelayCount++;
    }
    if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') {
      clearanceDelayCount++;
    }
    if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') {
      destinationDelayCount++;
    }
    if (s.weekendDelay && s.weekendDelay.toLowerCase() === 'yes') {
      weekendDelayCount++;
    }
  }

  return {
    totalCount,
    totalWeight: Math.round(totalWeight * 100) / 100,
    totalPkgs,
    avgTT: Math.round((sumTT / totalCount) * 100) / 100,
    minTT: minTT === Number.MAX_VALUE ? 0 : Math.round(minTT * 100) / 100,
    maxTT: Math.round(maxTT * 100) / 100,
    onTimeCount,
    onTimePercentage: Math.round((onTimeCount / totalCount) * 10000) / 100,
    delayedTimelineCount,
    delayedTimelinePercentage: Math.round((delayedTimelineCount / totalCount) * 10000) / 100,
    transitDelayCount,
    clearanceDelayCount,
    destinationDelayCount,
    weekendDelayCount
  };
}

export function computeDeliveryTimeline(shipments: Shipment[]): RatioBreakdown[] {
  const total = shipments.length;
  if (total === 0) return [];

  let within = 0;
  let moreThan = 0;

  for (const s of shipments) {
    if (s.ttRange === 'Within 4-5 Days' || (s.tt > 0 && s.tt <= 5)) {
      within++;
    } else {
      moreThan++;
    }
  }

  return [
    {
      name: 'Within 4-5 Days',
      count: within,
      percentage: Math.round((within / total) * 10000) / 100,
      color: '#10b981' // emerald
    },
    {
      name: 'More Than 5 Days',
      count: moreThan,
      percentage: Math.round((moreThan / total) * 10000) / 100,
      color: '#f59e0b' // amber
    }
  ];
}

export function computeFinalResolutions(shipments: Shipment[]): RatioBreakdown[] {
  const total = shipments.length;
  if (total === 0) return [];

  const counts: Record<string, number> = {};
  for (const s of shipments) {
    const res = (s.finalResolution || 'Delivered').trim();
    counts[res] = (counts[res] || 0) + 1;
  }

  const palette: Record<string, string> = {
    'Delivered': '#10b981',
    'RTS': '#ef4444',       // Blood red / Crimson alert
    'Lost': '#dc2626',      // Deep blood red / severe loss
    'Destroyed': '#b91c1c', // Crimson burgundy / critical loss
    'Seized': '#991b1b',    // Deep blood crimson / customs confiscation
    'Undelivered': '#ea580c', // High-alert orange-red
    'NFBRK': '#8b5cf6',
    'Re-route': '#3b82f6',
    'Available For Pickup': '#06b6d4'
  };

  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 10000) / 100,
      color: palette[name] || '#94a3b8'
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeDelayBreakdown(
  shipments: Shipment[],
  delayField: 'transitDelay' | 'clearanceDelay' | 'destinationDelay'
): RatioBreakdown[] {
  const counts: Record<string, number> = {};
  let totalDelays = 0;

  for (const s of shipments) {
    const val = s[delayField]?.trim();
    if (val && val !== '-' && val !== '') {
      counts[val] = (counts[val] || 0) + 1;
      totalDelays++;
    }
  }

  if (totalDelays === 0) return [];

  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalDelays) * 10000) / 100
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeCountryPerformance(shipments: Shipment[]): CountryPerformance[] {
  const map: Record<
    string,
    {
      count: number;
      sumTT: number;
      minTT: number;
      maxTT: number;
      onTime: number;
      transitDelays: number;
      clearanceDelays: number;
      destinationDelays: number;
    }
  > = {};

  for (const s of shipments) {
    const code = (s.destination || 'UNKNOWN').toUpperCase();
    if (!map[code]) {
      map[code] = {
        count: 0,
        sumTT: 0,
        minTT: Number.MAX_VALUE,
        maxTT: 0,
        onTime: 0,
        transitDelays: 0,
        clearanceDelays: 0,
        destinationDelays: 0
      };
    }

    const c = map[code];
    c.count++;
    const tt = s.tt;
    c.sumTT += tt;
    if (tt > 0 && tt < c.minTT) c.minTT = tt;
    if (tt > c.maxTT) c.maxTT = tt;

    if (s.ttRange === 'Within 4-5 Days' || (tt > 0 && tt <= 5)) {
      c.onTime++;
    }

    if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') {
      c.transitDelays++;
    }
    if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') {
      c.clearanceDelays++;
    }
    if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') {
      c.destinationDelays++;
    }
  }

  return Object.entries(map)
    .map(([countryCode, d]) => ({
      countryCode,
      awbCount: d.count,
      avgTT: Math.round((d.sumTT / d.count) * 100) / 100,
      minTT: d.minTT === Number.MAX_VALUE ? 0 : Math.round(d.minTT * 100) / 100,
      maxTT: Math.round(d.maxTT * 100) / 100,
      onTimeCount: d.onTime,
      onTimePercentage: Math.round((d.onTime / d.count) * 10000) / 100,
      transitDelays: d.transitDelays,
      clearanceDelays: d.clearanceDelays,
      destinationDelays: d.destinationDelays
    }))
    .sort((a, b) => b.awbCount - a.awbCount);
}

export function computeCustomerComparison(
  shipments: Shipment[],
  destination: string, // 'ALL' or specific country code like 'US'
  customerNames: string[]
): CustomerComparisonMetric[] {
  return customerNames.map((cust) => {
    const custShipments = shipments.filter((s) => {
      if (s.customer !== cust) return false;
      if (destination && destination !== 'ALL' && s.destination !== destination) return false;
      return true;
    });

    const count = custShipments.length;
    if (count === 0) {
      return {
        customer: cust,
        awbCount: 0,
        avgTT: 0,
        minTT: 0,
        maxTT: 0,
        onTimeCount: 0,
        onTimePercentage: 0,
        delayCount: 0,
        delayPercentage: 0,
        transitDelays: 0,
        clearanceDelays: 0,
        destinationDelays: 0
      };
    }

    let sumTT = 0;
    let minTT = Number.MAX_VALUE;
    let maxTT = 0;
    let onTimeCount = 0;
    let transitDelays = 0;
    let clearanceDelays = 0;
    let destinationDelays = 0;
    let delayCount = 0;

    for (const s of custShipments) {
      const tt = s.tt;
      sumTT += tt;
      if (tt > 0 && tt < minTT) minTT = tt;
      if (tt > maxTT) maxTT = tt;

      if (s.ttRange === 'Within 4-5 Days' || (tt > 0 && tt <= 5)) {
        onTimeCount++;
      }

      let hasDelay = false;
      if (s.transitDelay && s.transitDelay !== '-' && s.transitDelay.trim() !== '') {
        transitDelays++;
        hasDelay = true;
      }
      if (s.clearanceDelay && s.clearanceDelay !== '-' && s.clearanceDelay.trim() !== '') {
        clearanceDelays++;
        hasDelay = true;
      }
      if (s.destinationDelay && s.destinationDelay !== '-' && s.destinationDelay.trim() !== '') {
        destinationDelays++;
        hasDelay = true;
      }
      if (hasDelay || s.ttRange === 'More Than 5 Days' || tt > 5) {
        delayCount++;
      }
    }

    return {
      customer: cust,
      awbCount: count,
      avgTT: Math.round((sumTT / count) * 100) / 100,
      minTT: minTT === Number.MAX_VALUE ? 0 : Math.round(minTT * 100) / 100,
      maxTT: Math.round(maxTT * 100) / 100,
      onTimeCount,
      onTimePercentage: Math.round((onTimeCount / count) * 10000) / 100,
      delayCount,
      delayPercentage: Math.round((delayCount / count) * 10000) / 100,
      transitDelays,
      clearanceDelays,
      destinationDelays
    };
  });
}

export function searchShippers(
  shipments: Shipment[],
  query: string,
  limit: number = 25
): { name: string; count: number }[] {
  const trimmed = (query || '').toLowerCase().trim();
  const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

  const countMap: Record<string, number> = {};
  for (const s of shipments) {
    if (!s.shprName) continue;
    const name = s.shprName.trim();
    if (!name) continue;

    if (tokens.length === 0) {
      countMap[name] = (countMap[name] || 0) + 1;
    } else {
      const lower = name.toLowerCase();
      const matches = tokens.every((token) => lower.includes(token));
      if (matches) {
        countMap[name] = (countMap[name] || 0) + 1;
      }
    }
  }

  return Object.entries(countMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function searchCustomers(
  shipments: Shipment[],
  query: string,
  limit: number = 25
): { name: string; count: number }[] {
  const trimmed = (query || '').toLowerCase().trim();
  const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

  const countMap: Record<string, number> = {};
  for (const s of shipments) {
    if (!s.customer) continue;
    const name = s.customer.trim();
    if (!name) continue;

    if (tokens.length === 0) {
      countMap[name] = (countMap[name] || 0) + 1;
    } else {
      const lower = name.toLowerCase();
      const matches = tokens.every((token) => lower.includes(token));
      if (matches) {
        countMap[name] = (countMap[name] || 0) + 1;
      }
    }
  }

  return Object.entries(countMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
