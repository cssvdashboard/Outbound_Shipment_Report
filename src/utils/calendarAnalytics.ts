import { Shipment } from '../types/logistics';

export interface WeekStats {
  weekNum: number;
  avgTT: number;
  count: number;
  shipments: Shipment[];
}

export interface CalendarDayRow {
  dayName: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  weeks: {
    [weekNum: number]: WeekStats;
  };
  overallAvgTT: number;
  totalCount: number;
  onTimeCount: number;
  onTimePercentage: number;
  shipments: Shipment[];
}

export interface CalendarMatrixResult {
  rows: CalendarDayRow[];
  maxWeeks: number; // usually 4 or 5
  sundayMetrics: {
    avgTT: number;
    totalCount: number;
    weekBreakdown: { weekNum: number; avgTT: number; count: number }[];
  };
  fleetMetrics: {
    overallAvgTT: number;
    totalCount: number;
    fastestDay: { day: string; avgTT: number } | null;
    slowestDay: { day: string; avgTT: number } | null;
    peakVolumeDay: { day: string; count: number } | null;
  };
  availableMonths: { id: string; label: string; count: number }[];
  availableShippers: string[];
}

export const WEEKDAYS: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Parses a shipment pickup date into a valid Date object.
 * Handles Excel serial numbers (e.g. 46212.5), ISO date strings, and timestamp numbers.
 */
export function parseShipmentDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;

  // Handle Excel serial date numbers (e.g. 46212.50694)
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const d = new Date(excelEpoch.getTime() + num * msPerDay);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle standard date string
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Computes calendar day (Sunday–Saturday) and week (Week 1–4/5) transit time comparison.
 */
export function computeCalendarMatrix(
  shipments: Shipment[],
  options?: {
    customer?: string;
    destination?: string;
    shipper?: string;
    month?: string; // e.g. "2026-07" or "ALL"
  }
): CalendarMatrixResult {
  const selectedCustomer = options?.customer?.trim() || '';
  const selectedDestination = options?.destination?.trim().toUpperCase() || '';
  const selectedShipper = options?.shipper?.trim() || '';
  const selectedMonth = options?.month || '';

  // Extract all available months from dataset
  const monthCounts: Record<string, number> = {};
  const shipperSet = new Set<string>();

  shipments.forEach((s) => {
    if (s.shprName) shipperSet.add(s.shprName);
    const d = parseShipmentDate(s.pickup);
    if (d) {
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    }
  });

  const availableMonths = Object.keys(monthCounts)
    .sort()
    .map((ym) => {
      const [year, month] = ym.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return { id: ym, label, count: monthCounts[ym] };
    });

  // Filter shipments based on customer, destination, shipper, and month
  const filtered = shipments.filter((s) => {
    if (selectedCustomer && s.customer !== selectedCustomer) return false;
    if (selectedDestination && s.destination.toUpperCase() !== selectedDestination) return false;
    if (selectedShipper && s.shprName !== selectedShipper) return false;

    if (selectedMonth && selectedMonth !== 'ALL') {
      const d = parseShipmentDate(s.pickup);
      if (!d) return false;
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (ym !== selectedMonth) return false;
    }

    return true;
  });

  // Initialize Matrix structure for each day of the week
  let maxWeekEncountered = 4;
  const dayDataMap: Record<
    number,
    {
      weeks: Record<number, { sumTT: number; shipments: Shipment[] }>;
      allShipments: Shipment[];
    }
  > = {};

  WEEKDAYS.forEach((_, idx) => {
    dayDataMap[idx] = {
      weeks: {
        1: { sumTT: 0, shipments: [] },
        2: { sumTT: 0, shipments: [] },
        3: { sumTT: 0, shipments: [] },
        4: { sumTT: 0, shipments: [] },
        5: { sumTT: 0, shipments: [] }
      },
      allShipments: []
    };
  });

  // Populate data
  filtered.forEach((s) => {
    const d = parseShipmentDate(s.pickup);
    if (!d) return;

    const dayIndex = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const dayOfMonth = d.getUTCDate();
    const weekNum = Math.min(Math.ceil(dayOfMonth / 7), 5); // Week 1 to Week 5

    if (weekNum > maxWeekEncountered && dayDataMap[dayIndex].weeks[weekNum]) {
      maxWeekEncountered = weekNum;
    }

    const tt = typeof s.tt === 'number' && !isNaN(s.tt) ? s.tt : 0;

    if (!dayDataMap[dayIndex].weeks[weekNum]) {
      dayDataMap[dayIndex].weeks[weekNum] = { sumTT: 0, shipments: [] };
    }

    dayDataMap[dayIndex].weeks[weekNum].sumTT += tt;
    dayDataMap[dayIndex].weeks[weekNum].shipments.push(s);
    dayDataMap[dayIndex].allShipments.push(s);
  });

  // Construct table rows
  const rows: CalendarDayRow[] = WEEKDAYS.map((dayName, dayIndex) => {
    const dData = dayDataMap[dayIndex];
    const totalCount = dData.allShipments.length;
    const totalTT = dData.allShipments.reduce((acc, s) => acc + (s.tt || 0), 0);
    const overallAvgTT = totalCount > 0 ? parseFloat((totalTT / totalCount).toFixed(2)) : 0;
    
    const onTimeCount = dData.allShipments.filter((s) => (s.tt || 0) <= 5).length;
    const onTimePercentage = totalCount > 0 ? parseFloat(((onTimeCount / totalCount) * 100).toFixed(1)) : 0;

    const weeks: Record<number, WeekStats> = {};
    for (let w = 1; w <= 5; w++) {
      const wInfo = dData.weeks[w] || { sumTT: 0, shipments: [] };
      const count = wInfo.shipments.length;
      const avgTT = count > 0 ? parseFloat((wInfo.sumTT / count).toFixed(2)) : 0;
      weeks[w] = {
        weekNum: w,
        avgTT,
        count,
        shipments: wInfo.shipments
      };
    }

    return {
      dayName,
      dayIndex,
      weeks,
      overallAvgTT,
      totalCount,
      onTimeCount,
      onTimePercentage,
      shipments: dData.allShipments
    };
  });

  // Sunday Metrics
  const sundayRow = rows[0];
  const sundayMetrics = {
    avgTT: sundayRow.overallAvgTT,
    totalCount: sundayRow.totalCount,
    weekBreakdown: [1, 2, 3, 4, 5].map((w) => ({
      weekNum: w,
      avgTT: sundayRow.weeks[w]?.avgTT || 0,
      count: sundayRow.weeks[w]?.count || 0
    }))
  };

  // Fleet Metrics
  const activeDays = rows.filter((r) => r.totalCount > 0);
  const totalFleetShipments = rows.reduce((acc, r) => acc + r.totalCount, 0);
  const totalFleetTT = rows.reduce((acc, r) => acc + r.shipments.reduce((sAcc, s) => sAcc + (s.tt || 0), 0), 0);
  const fleetAvgTT = totalFleetShipments > 0 ? parseFloat((totalFleetTT / totalFleetShipments).toFixed(2)) : 0;

  let fastestDay: { day: string; avgTT: number } | null = null;
  let slowestDay: { day: string; avgTT: number } | null = null;
  let peakVolumeDay: { day: string; count: number } | null = null;

  if (activeDays.length > 0) {
    const sortedByAvg = [...activeDays].sort((a, b) => a.overallAvgTT - b.overallAvgTT);
    fastestDay = { day: sortedByAvg[0].dayName, avgTT: sortedByAvg[0].overallAvgTT };
    slowestDay = { day: sortedByAvg[sortedByAvg.length - 1].dayName, avgTT: sortedByAvg[sortedByAvg.length - 1].overallAvgTT };

    const sortedByCount = [...activeDays].sort((a, b) => b.totalCount - a.totalCount);
    peakVolumeDay = { day: sortedByCount[0].dayName, count: sortedByCount[0].totalCount };
  }

  return {
    rows,
    maxWeeks: maxWeekEncountered,
    sundayMetrics,
    fleetMetrics: {
      overallAvgTT: fleetAvgTT,
      totalCount: totalFleetShipments,
      fastestDay,
      slowestDay,
      peakVolumeDay
    },
    availableMonths,
    availableShippers: Array.from(shipperSet).sort()
  };
}
