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
  },
  {
    id: 'ALL',
    label: 'All July (W1 - W5)',
    dateRange: '07/01/2026 – 07/31/2026',
    startDate: '2026-07-01',
    endDate: '2026-08-04',
    dayDates: {
      Wednesday: 'All Wed',
      Thursday: 'All Thu',
      Friday: 'All Fri',
      Saturday: 'All Sat',
      Sunday: 'All Sun',
      Monday: 'All Mon',
      Tuesday: 'All Tue'
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
}

export function parsePickupDate(pickup: string | number | undefined): Date | null {
  if (!pickup) return null;
  if (typeof pickup === 'number' || !isNaN(Number(pickup))) {
    const serial = Number(pickup);
    const utcDays = Math.floor(serial - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const d = new Date(pickup);
  return isNaN(d.getTime()) ? null : d;
}

export function getWeekIdForDate(date: Date): WeekId | 'W0' {
  const iso = date.toISOString().split('T')[0];
  if (iso >= '2026-07-01' && iso <= '2026-07-07') return 'W1';
  if (iso >= '2026-07-08' && iso <= '2026-07-14') return 'W2';
  if (iso >= '2026-07-15' && iso <= '2026-07-21') return 'W3';
  if (iso >= '2026-07-22' && iso <= '2026-07-28') return 'W4';
  if (iso >= '2026-07-29' && iso <= '2026-08-04') return 'W5';
  return 'W0';
}

export function getDayOfWeek(date: Date): DayOfWeek {
  const dayNames: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
  return dayNames[date.getUTCDay()];
}

export function calculateMetricsForTTs(tts: number[]): DayMetricCell {
  if (tts.length === 0) {
    return {
      count: 0,
      avgTT: 0,
      minTT: 0,
      maxTT: 0,
      hasData: false
    };
  }

  // Filter for valid delivered transit times (excluding 0 or shipments with no POD)
  const validTTs = tts.filter((tt) => typeof tt === 'number' && !isNaN(tt) && tt > 0);

  if (validTTs.length === 0) {
    return {
      count: tts.length,
      avgTT: 0,
      minTT: 0,
      maxTT: 0,
      hasData: true
    };
  }

  const sum = validTTs.reduce((acc, curr) => acc + curr, 0);
  return {
    count: tts.length,
    avgTT: Number((sum / validTTs.length).toFixed(2)),
    minTT: Number(Math.min(...validTTs).toFixed(2)),
    maxTT: Number(Math.max(...validTTs).toFixed(2)),
    hasData: true
  };
}

// -------------------------------------------------------------
// COMPUTE FULL MULTI-WEEK SIDE-BY-SIDE MATRIX (WED..TUE x W1..W5)
// -------------------------------------------------------------
export function computeMultiWeekDayMatrix(shipments: Shipment[]): MultiWeekMatrixSummary {
  // Filter for July shipments (W1..W5)
  const julyShipments = shipments.filter((s) => {
    const d = parsePickupDate(s.pickup);
    if (!d) return false;
    const wId = getWeekIdForDate(d);
    return wId !== 'W0';
  });

  const allTTs = julyShipments.map((s) => s.tt);
  const overall = calculateMetricsForTTs(allTTs);

  // Daily Week Column Totals (ALL COUNTRIES)
  const dailyWeekTotals: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>> = {} as any;
  DAYS_OF_WEEK.forEach((day) => {
    dailyWeekTotals[day] = {} as any;
    WEEKS_LIST.forEach((wId) => {
      const cellTTs: number[] = [];
      for (const s of julyShipments) {
        const d = parsePickupDate(s.pickup);
        if (d && getWeekIdForDate(d) === wId && getDayOfWeek(d) === day) {
          cellTTs.push(s.tt);
        }
      }
      dailyWeekTotals[day][wId] = calculateMetricsForTTs(cellTTs);
    });
  });

  // Group by Country
  const countryMap = new Map<string, Shipment[]>();
  for (const s of julyShipments) {
    const dest = (s.destination || 'UNKNOWN').toUpperCase().trim();
    if (!countryMap.has(dest)) {
      countryMap.set(dest, []);
    }
    countryMap.get(dest)!.push(s);
  }

  const countryRows: MultiWeekDayMatrixRow[] = [];

  countryMap.forEach((cShipments, country) => {
    const cTTs = cShipments.map((s) => s.tt);
    const cOverall = calculateMetricsForTTs(cTTs);

    const dayWeekMetrics: Record<DayOfWeek, Record<SingleWeekId, DayMetricCell>> = {} as any;
    DAYS_OF_WEEK.forEach((day) => {
      dayWeekMetrics[day] = {} as any;
      WEEKS_LIST.forEach((wId) => {
        const cellTTs: number[] = [];
        for (const s of cShipments) {
          const d = parsePickupDate(s.pickup);
          if (d && getWeekIdForDate(d) === wId && getDayOfWeek(d) === day) {
            cellTTs.push(s.tt);
          }
        }
        dayWeekMetrics[day][wId] = calculateMetricsForTTs(cellTTs);
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
    totalShipments: julyShipments.length,
    totalCountries: countryRows.length,
    overallAvgTT: overall.avgTT,
    overallMinTT: overall.minTT,
    overallMaxTT: overall.maxTT,
    dailyWeekTotals,
    countryRows
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
  // Format: [ "Country", "Total Volume", "Overall Avg TT", "Wednesday", "", "", "", "", "Thursday", ... ]
  const headerRow1: any[] = ['Country', 'Total Volume', 'Overall Avg TT (Days)'];
  DAYS_OF_WEEK.forEach((day) => {
    headerRow1.push(day.toUpperCase(), '', '', '', '');
  });
  sheetData.push(headerRow1);

  // Row 2: Header - Sub-columns: W1..W5 per Day
  // Format: [ "", "", "", "W1 Wed (07/01)", "W2 Wed (07/08)", ... ]
  const headerRow2: any[] = ['', '', ''];
  DAYS_OF_WEEK.forEach((day) => {
    WEEKS_LIST.forEach((wId) => {
      const wMeta = WEEKS_METADATA.find((w) => w.id === wId);
      const dateLabel = wMeta?.dayDates[day] || '';
      headerRow2.push(`${wId} ${day.slice(0, 3)} (${dateLabel})`);
    });
  });
  sheetData.push(headerRow2);

  // Row 3: ALL COUNTRIES (Summary Row)
  const summaryRow: any[] = [
    'ALL COUNTRIES (AVG)',
    matrixSummary.totalShipments,
    matrixSummary.overallAvgTT
  ];
  DAYS_OF_WEEK.forEach((day) => {
    WEEKS_LIST.forEach((wId) => {
      const cell = matrixSummary.dailyWeekTotals[day][wId];
      summaryRow.push(cell.hasData && cell.count > 0 ? cell.avgTT : '-');
    });
  });
  sheetData.push(summaryRow);

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
    ...Array(35).fill({ wch: 16 }) // 35 Day-Week columns
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
      header2.push(`"${wId} ${day.slice(0, 3)} (${dateLabel})"`);
    });
  });
  rows.push(header2.join(','));

  // Row 3 Summary
  const summary: string[] = [
    '"ALL COUNTRIES (AVG)"',
    String(matrixSummary.totalShipments),
    String(matrixSummary.overallAvgTT)
  ];
  DAYS_OF_WEEK.forEach((day) => {
    WEEKS_LIST.forEach((wId) => {
      const cell = matrixSummary.dailyWeekTotals[day][wId];
      summary.push(cell.hasData && cell.count > 0 ? String(cell.avgTT) : '"-"');
    });
  });
  rows.push(summary.join(','));

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
