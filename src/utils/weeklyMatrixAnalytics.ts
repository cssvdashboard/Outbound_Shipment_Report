import { Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

export type WeekId = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'ALL';
export const WEEKS_LIST = ['W1', 'W2', 'W3', 'W4', 'W5'] as const;
export type SingleWeekId = typeof WEEKS_LIST[number];

export const DAYS_OF_WEEK = [
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday'
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export interface WeekDefinition {
  id: WeekId;
  label: string;
  dateRange: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  dayDates: Record<DayOfWeek, string>;
}

export const WEEKS_METADATA: WeekDefinition[] = [
  {
    id: 'W1',
    label: 'Week 1 (W1)',
    dateRange: '07/01/2026 – 07/07/2026',
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    dayDates: {
      Wednesday: '07/01',
      Thursday: '07/02',
      Friday: '07/03',
      Saturday: '07/04',
      Sunday: '07/05',
      Monday: '07/06',
      Tuesday: '07/07'
    }
  },
  {
    id: 'W2',
    label: 'Week 2 (W2)',
    dateRange: '07/08/2026 – 07/14/2026',
    startDate: '2026-07-08',
    endDate: '2026-07-14',
    dayDates: {
      Wednesday: '07/08',
      Thursday: '07/09',
      Friday: '07/10',
      Saturday: '07/11',
      Sunday: '07/12',
      Monday: '07/13',
      Tuesday: '07/14'
    }
  },
  {
    id: 'W3',
    label: 'Week 3 (W3)',
    dateRange: '07/15/2026 – 07/21/2026',
    startDate: '2026-07-15',
    endDate: '2026-07-21',
    dayDates: {
      Wednesday: '07/15',
      Thursday: '07/16',
      Friday: '07/17',
      Saturday: '07/18',
      Sunday: '07/19',
      Monday: '07/20',
      Tuesday: '07/21'
    }
  },
  {
    id: 'W4',
    label: 'Week 4 (W4)',
    dateRange: '07/22/2026 – 07/28/2026',
    startDate: '2026-07-22',
    endDate: '2026-07-28',
    dayDates: {
      Wednesday: '07/22',
      Thursday: '07/23',
      Friday: '07/24',
      Saturday: '07/25',
      Sunday: '07/26',
      Monday: '07/27',
      Tuesday: '07/28'
    }
  },
  {
    id: 'W5',
    label: 'Week 5 (W5)',
    dateRange: '07/29/2026 – 07/31/2026',
    startDate: '2026-07-29',
    endDate: '2026-08-04',
    dayDates: {
      Wednesday: '07/29',
      Thursday: '07/30',
      Friday: '07/31',
      Saturday: '08/01',
      Sunday: '08/02',
      Monday: '08/03',
      Tuesday: '08/04'
    }
  }
];

export interface DayMetricCell {
  count: number;
  avgTT: number;
  minTT: number;
  maxTT: number;
  hasData: boolean;
}

export interface MultiWeekDayMatrixRow {
  country: string;
  totalCount: number;
  totalAvgTT: number;
  totalMinTT: number;
  totalMaxTT: number;
  dayWeekMetrics: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>>;
}

export interface MultiWeekMatrixSummary {
  totalShipments: number;
  totalCountries: number;
  overallAvgTT: number;
  overallMinTT: number;
  overallMaxTT: number;
  dailyWeekTotals: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>>;
  countryRows: MultiWeekDayMatrixRow[];
  countryDayWeekShipments: Map<string, Shipment[]>;
  countryTotalShipments: Map<string, Shipment[]>;
}

const DAY_NAMES_BY_UTC_DAY: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Ultra-fast Date and Week Parser (Pre-computed integer comparisons, zero regex)
 */
export function fastClassifyPickup(pickup: string | number | undefined): { wId: SingleWeekId; day: DayOfWeek } | null {
  if (!pickup) return null;
  let d: Date;
  if (typeof pickup === 'number') {
    const utcDays = Math.floor(pickup - 25569);
    d = new Date(utcDays * 86400 * 1000);
  } else {
    d = new Date(pickup);
  }
  const time = d.getTime();
  if (isNaN(time)) return null;

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed: July is 6, Aug is 7
  const date = d.getUTCDate();
  const day = DAY_NAMES_BY_UTC_DAY[d.getUTCDay()];

  if (year !== 2026) return null;

  let wId: SingleWeekId | null = null;
  if (month === 6) {
    if (date >= 1 && date <= 7) wId = 'W1';
    else if (date >= 8 && date <= 14) wId = 'W2';
    else if (date >= 15 && date <= 21) wId = 'W3';
    else if (date >= 22 && date <= 28) wId = 'W4';
    else if (date >= 29 && date <= 31) wId = 'W5';
  } else if (month === 7 && date <= 4) {
    wId = 'W5';
  }

  if (!wId) return null;
  return { wId, day };
}

export function calculateMetricsForTTs(tts: number[]): DayMetricCell {
  const len = tts.length;
  if (len === 0) {
    return { count: 0, avgTT: 0, minTT: 0, maxTT: 0, hasData: false };
  }

  let sum = 0;
  let validCount = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < len; i++) {
    const tt = tts[i];
    if (typeof tt === 'number' && !isNaN(tt) && tt > 0) {
      sum += tt;
      validCount++;
      if (tt < min) min = tt;
      if (tt > max) max = tt;
    }
  }

  if (validCount === 0) {
    return { count: len, avgTT: 0, minTT: 0, maxTT: 0, hasData: true };
  }

  return {
    count: len,
    avgTT: Number((sum / validCount).toFixed(2)),
    minTT: Number(min.toFixed(2)),
    maxTT: Number(max.toFixed(2)),
    hasData: true
  };
}

// -------------------------------------------------------------
// ULTRA-FAST SINGLE-PASS COMPUTE FOR MULTI-WEEK MATRIX (O(N) Linear Time)
// -------------------------------------------------------------
export function computeMultiWeekDayMatrix(shipments: Shipment[]): MultiWeekMatrixSummary {
  const allTTs: number[] = [];
  
  // Global day-week buckets
  const globalDayWeekTTs: Record<DayOfWeek, Record<SingleWeekId, number[]>> = {} as any;
  DAYS_OF_WEEK.forEach((d) => {
    globalDayWeekTTs[d] = { W1: [], W2: [], W3: [], W4: [], W5: [] };
  });

  // Country-level buckets
  const countryTTMap = new Map<string, number[]>();
  const countryDayWeekTTMap = new Map<string, Record<DayOfWeek, Record<SingleWeekId, number[]>>>();

  // Pre-cached shipment arrays for instant modal drill-down
  const countryDayWeekShipments = new Map<string, Shipment[]>();
  const countryTotalShipments = new Map<string, Shipment[]>();

  // SINGLE PASS LOOP OVER SHIPMENTS (O(N))
  const total = shipments.length;
  for (let i = 0; i < total; i++) {
    const s = shipments[i];
    const classified = fastClassifyPickup(s.pickup);
    if (!classified) continue;

    const { wId, day } = classified;
    const tt = s.tt;
    allTTs.push(tt);
    globalDayWeekTTs[day][wId].push(tt);

    const dest = (s.destination || 'UNKNOWN').toUpperCase().trim();

    // Country All TTs
    let cTTs = countryTTMap.get(dest);
    if (!cTTs) {
      cTTs = [];
      countryTTMap.set(dest, cTTs);
    }
    cTTs.push(tt);

    // Country Day-Week Matrix TTs
    let cDW = countryDayWeekTTMap.get(dest);
    if (!cDW) {
      const newCDW: Record<DayOfWeek, Record<SingleWeekId, number[]>> = {} as any;
      DAYS_OF_WEEK.forEach((d) => {
        newCDW[d] = { W1: [], W2: [], W3: [], W4: [], W5: [] };
      });
      cDW = newCDW;
      countryDayWeekTTMap.set(dest, cDW);
    }
    cDW[day][wId].push(tt);

    // Country Total Shipments Cache
    let cTotalShipments = countryTotalShipments.get(dest);
    if (!cTotalShipments) {
      cTotalShipments = [];
      countryTotalShipments.set(dest, cTotalShipments);
    }
    cTotalShipments.push(s);

    // Country Day-Week Shipments Cache Key: `${dest}-${day}-${wId}`
    const dwKey = `${dest}-${day}-${wId}`;
    let cDWShipments = countryDayWeekShipments.get(dwKey);
    if (!cDWShipments) {
      cDWShipments = [];
      countryDayWeekShipments.set(dwKey, cDWShipments);
    }
    cDWShipments.push(s);
  }

  // Calculate Overall Metrics
  const overall = calculateMetricsForTTs(allTTs);

  // Calculate Daily-Week Totals (ALL COUNTRIES)
  const dailyWeekTotals: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>> = {} as any;
  DAYS_OF_WEEK.forEach((d) => {
    dailyWeekTotals[d] = {} as any;
    WEEKS_LIST.forEach((wId) => {
      dailyWeekTotals[d][wId] = calculateMetricsForTTs(globalDayWeekTTs[d][wId]);
    });
  });

  // Build Country Rows
  const countryRows: MultiWeekDayMatrixRow[] = [];
  countryDayWeekTTMap.forEach((cDW, country) => {
    const cTTs = countryTTMap.get(country) || [];
    const cOverall = calculateMetricsForTTs(cTTs);

    const dayWeekMetrics: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>> = {} as any;
    DAYS_OF_WEEK.forEach((d) => {
      dayWeekMetrics[d] = {} as any;
      WEEKS_LIST.forEach((wId) => {
        dayWeekMetrics[d][wId] = calculateMetricsForTTs(cDW[d][wId]);
      });
    });

    countryRows.push({
      country,
      totalCount: cOverall.count,
      totalAvgTT: cOverall.avgTT,
      totalMinTT: cOverall.minTT,
      totalMaxTT: cOverall.maxTT,
      dayWeekMetrics
    });
  });

  // Sort descending by total volume
  countryRows.sort((a, b) => b.totalCount - a.totalCount);

  return {
    totalShipments: allTTs.length,
    totalCountries: countryRows.length,
    overallAvgTT: overall.avgTT,
    overallMinTT: overall.minTT,
    overallMaxTT: overall.maxTT,
    dailyWeekTotals,
    countryRows,
    countryDayWeekShipments,
    countryTotalShipments
  };
}

// -------------------------------------------------------------
// EXCEL & CSV EXPORT FOR FULL MULTI-WEEK SIDE-BY-SIDE MATRIX
// -------------------------------------------------------------
export function exportMultiWeekMatrixToExcel(
  matrixSummary: MultiWeekMatrixSummary,
  filenamePrefix = 'Delivery_Comparison_Day_by_Day_W1_to_W5'
) {
  const sheetData: any[][] = [];

  // Row 1: Header - Super Groupings (Day of Week)
  const headerRow1: any[] = ['Country', 'Total Volume', 'Overall Avg TT (Days)'];
  DAYS_OF_WEEK.forEach((day) => {
    headerRow1.push(day.toUpperCase(), '', '', '', '');
  });
  sheetData.push(headerRow1);

  // Row 2: Header - Sub-columns: W1..W5 per Day
  const headerRow2: any[] = ['', '', ''];
  DAYS_OF_WEEK.forEach((day) => {
    WEEKS_LIST.forEach((wId) => {
      const wMeta = WEEKS_METADATA.find((w) => w.id === wId);
      const dateLabel = wMeta?.dayDates[day] || '';
      headerRow2.push(`${wId} (${dateLabel})`);
    });
  });
  sheetData.push(headerRow2);

  // Data Rows: Per Country
  matrixSummary.countryRows.forEach((row) => {
    const r: any[] = [row.country, row.totalCount, row.totalAvgTT];
    DAYS_OF_WEEK.forEach((day) => {
      WEEKS_LIST.forEach((wId) => {
        const cell = row.dayWeekMetrics[day][wId];
        r.push(cell.hasData && cell.count > 0 ? cell.avgTT : '-');
      });
    });
    sheetData.push(r);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 18 }, // Country
    { wch: 14 }, // Total Volume
    { wch: 20 }, // Overall Avg TT
    ...Array(35).fill({ wch: 14 }) // 35 Day-Week columns
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Day_by_Day_W1_W5');

  const cleanFilename = `${filenamePrefix}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}

export function exportMultiWeekMatrixToCSV(
  matrixSummary: MultiWeekMatrixSummary,
  filenamePrefix = 'Delivery_Comparison_Day_by_Day_W1_to_W5'
) {
  const rows: string[] = [];

  // Row 1
  const header1: string[] = ['"Country"', '"Total Volume"', '"Overall Avg TT (Days)"'];
  DAYS_OF_WEEK.forEach((day) => {
    header1.push(`"${day.toUpperCase()}"`, '""', '""', '""', '""');
  });
  rows.push(header1.join(','));

  // Row 2
  const header2: string[] = ['""', '""', '""'];
  DAYS_OF_WEEK.forEach((day) => {
    WEEKS_LIST.forEach((wId) => {
      const wMeta = WEEKS_METADATA.find((w) => w.id === wId);
      const dateLabel = wMeta?.dayDates[day] || '';
      header2.push(`"${wId} (${dateLabel})"`);
    });
  });
  rows.push(header2.join(','));

  // Data Rows
  matrixSummary.countryRows.forEach((row) => {
    const cols: string[] = [
      `"${row.country}"`,
      String(row.totalCount),
      String(row.totalAvgTT)
    ];
    DAYS_OF_WEEK.forEach((day) => {
      WEEKS_LIST.forEach((wId) => {
        const cell = row.dayWeekMetrics[day][wId];
        cols.push(cell.hasData && cell.count > 0 ? String(cell.avgTT) : '"-"');
      });
    });
    rows.push(cols.join(','));
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
