import { Shipment } from '../types/logistics';
import * as XLSX from 'xlsx';

export type WeekId = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'ALL';

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

export interface CountryMatrixRow {
  country: string;
  totalCount: number;
  totalAvgTT: number;
  totalMinTT: number;
  totalMaxTT: number;
  dayMetrics: Record<DayOfWeek, DayMetricCell>;
}

export interface WeeklyMatrixSummary {
  weekId: WeekId;
  weekMetadata: WeekDefinition;
  totalShipments: number;
  totalCountries: number;
  overallAvgTT: number;
  overallMinTT: number;
  overallMaxTT: number;
  onTimeCount: number;
  onTimeRate: number;
  dailyTotals: Record<DayOfWeek, DayMetricCell>;
  countryRows: CountryMatrixRow[];
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

function calculateMetricsForTTs(tts: number[]): DayMetricCell {
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

export function computeWeeklyCountryMatrix(
  shipments: Shipment[],
  selectedWeek: WeekId
): WeeklyMatrixSummary {
  const weekDef = WEEKS_METADATA.find((w) => w.id === selectedWeek) || WEEKS_METADATA[0];

  // 1. Filter shipments matching week
  const weekShipments = shipments.filter((s) => {
    const d = parsePickupDate(s.pickup);
    if (!d) return false;
    const wId = getWeekIdForDate(d);
    if (selectedWeek === 'ALL') {
      return wId !== 'W0';
    }
    return wId === selectedWeek;
  });

  // 2. Aggregate overall metrics
  const allTTs = weekShipments.map((s) => s.tt);
  const onTimeCount = weekShipments.filter((s) => s.tt <= 5).length;
  const onTimeRate = weekShipments.length > 0 ? Number(((onTimeCount / weekShipments.length) * 100).toFixed(1)) : 0;

  const overallMetrics = calculateMetricsForTTs(allTTs);

  // 3. Compute Column Totals by Day of Week
  const dailyTotals: Record<DayOfWeek, DayMetricCell> = {} as any;
  DAYS_OF_WEEK.forEach((day) => {
    const dayTTs: number[] = [];
    for (const s of weekShipments) {
      const d = parsePickupDate(s.pickup);
      if (d && getDayOfWeek(d) === day) {
        dayTTs.push(s.tt);
      }
    }
    dailyTotals[day] = calculateMetricsForTTs(dayTTs);
  });

  // 4. Group by Destination Country
  const countryMap = new Map<string, Shipment[]>();
  for (const s of weekShipments) {
    const dest = (s.destination || 'UNKNOWN').toUpperCase().trim();
    if (!countryMap.has(dest)) {
      countryMap.set(dest, []);
    }
    countryMap.get(dest)!.push(s);
  }

  // 5. Compute Country Rows
  const countryRows: CountryMatrixRow[] = [];

  countryMap.forEach((cShipments, country) => {
    const cTTs = cShipments.map((s) => s.tt);
    const cOverall = calculateMetricsForTTs(cTTs);

    const dayMetrics: Record<DayOfWeek, DayMetricCell> = {} as any;
    DAYS_OF_WEEK.forEach((day) => {
      const dayTTs: number[] = [];
      for (const s of cShipments) {
        const d = parsePickupDate(s.pickup);
        if (d && getDayOfWeek(d) === day) {
          dayTTs.push(s.tt);
        }
      }
      dayMetrics[day] = calculateMetricsForTTs(dayTTs);
    });

    countryRows.push({
      country,
      totalCount: cOverall.count,
      totalAvgTT: cOverall.avgTT,
      totalMinTT: cOverall.minTT,
      totalMaxTT: cOverall.maxTT,
      dayMetrics
    });
  });

  // Default sort by total volume descending
  countryRows.sort((a, b) => b.totalCount - a.totalCount);

  return {
    weekId: selectedWeek,
    weekMetadata: weekDef,
    totalShipments: weekShipments.length,
    totalCountries: countryRows.length,
    overallAvgTT: overallMetrics.avgTT,
    overallMinTT: overallMetrics.minTT,
    overallMaxTT: overallMetrics.maxTT,
    onTimeCount,
    onTimeRate,
    dailyTotals,
    countryRows
  };
}

export function exportMatrixToExcel(
  matrixSummary: WeeklyMatrixSummary,
  filenamePrefix = 'Weekly_Country_TT_Matrix'
) {
  const weekLabel = matrixSummary.weekMetadata.label;
  const sheetData: any[][] = [];

  // Title & Metadata
  sheetData.push([`Weekly Day-by-Day Transit Time (TT) Matrix — ${weekLabel}`]);
  sheetData.push([`Date Range: ${matrixSummary.weekMetadata.dateRange}`]);
  sheetData.push([
    `Total Shipments: ${matrixSummary.totalShipments.toLocaleString()}`,
    `Total Destinations: ${matrixSummary.totalCountries}`,
    `Overall Avg TT: ${matrixSummary.overallAvgTT} days`,
    `Min TT: ${matrixSummary.overallMinTT}d`,
    `Max TT: ${matrixSummary.overallMaxTT}d`,
    `On-Time Rate: ${matrixSummary.onTimeRate}%`
  ]);
  sheetData.push([]); // blank row

  // Table Headers (Multi-row header)
  const headerRow1 = [
    'Destination Country',
    'Total Volume',
    'Week Avg TT (d)',
    'Week Min TT (d)',
    'Week Max TT (d)'
  ];

  DAYS_OF_WEEK.forEach((day) => {
    const dateLabel = matrixSummary.weekMetadata.dayDates[day];
    headerRow1.push(
      `${day} (${dateLabel}) - Volume`,
      `${day} (${dateLabel}) - Avg TT (d)`,
      `${day} (${dateLabel}) - Min TT (d)`,
      `${day} (${dateLabel}) - Max TT (d)`
    );
  });

  sheetData.push(headerRow1);

  // Daily Aggregate Summary Row
  const summaryRow = [
    'ALL COUNTRIES (TOTAL)',
    matrixSummary.totalShipments,
    matrixSummary.overallAvgTT,
    matrixSummary.overallMinTT,
    matrixSummary.overallMaxTT
  ];

  DAYS_OF_WEEK.forEach((day) => {
    const cell = matrixSummary.dailyTotals[day];
    summaryRow.push(
      cell.hasData ? cell.count : 0,
      cell.hasData ? cell.avgTT : '-',
      cell.hasData ? cell.minTT : '-',
      cell.hasData ? cell.maxTT : '-'
    );
  });

  sheetData.push(summaryRow);

  // Country Rows
  matrixSummary.countryRows.forEach((row) => {
    const r = [
      row.country,
      row.totalCount,
      row.totalAvgTT,
      row.totalMinTT,
      row.totalMaxTT
    ];

    DAYS_OF_WEEK.forEach((day) => {
      const cell = row.dayMetrics[day];
      r.push(
        cell.hasData ? cell.count : 0,
        cell.hasData ? cell.avgTT : '-',
        cell.hasData ? cell.minTT : '-',
        cell.hasData ? cell.maxTT : '-'
      );
    });

    sheetData.push(r);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, matrixSummary.weekId);

  const cleanFilename = `${filenamePrefix}_${matrixSummary.weekId}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}

export function exportMatrixToCSV(
  matrixSummary: WeeklyMatrixSummary,
  filenamePrefix = 'Weekly_Country_TT_Matrix'
) {
  const weekLabel = matrixSummary.weekMetadata.label;
  const rows: string[] = [];

  rows.push(`"Weekly Day-by-Day Transit Time (TT) Matrix - ${weekLabel}"`);
  rows.push(`"Date Range: ${matrixSummary.weekMetadata.dateRange}"`);
  rows.push(`"Total Shipments: ${matrixSummary.totalShipments}","Avg TT: ${matrixSummary.overallAvgTT}d","Min TT: ${matrixSummary.overallMinTT}d","Max TT: ${matrixSummary.overallMaxTT}d"`);
  rows.push('');

  const headers = [
    'Destination Country',
    'Total Volume',
    'Week Avg TT',
    'Week Min TT',
    'Week Max TT'
  ];

  DAYS_OF_WEEK.forEach((day) => {
    const dateLabel = matrixSummary.weekMetadata.dayDates[day];
    headers.push(
      `${day} (${dateLabel}) Count`,
      `${day} (${dateLabel}) Avg TT`,
      `${day} (${dateLabel}) Min TT`,
      `${day} (${dateLabel}) Max TT`
    );
  });

  rows.push(headers.map((h) => `"${h}"`).join(','));

  matrixSummary.countryRows.forEach((row) => {
    const cols = [
      `"${row.country}"`,
      row.totalCount,
      row.totalAvgTT,
      row.totalMinTT,
      row.totalMaxTT
    ];

    DAYS_OF_WEEK.forEach((day) => {
      const cell = row.dayMetrics[day];
      cols.push(
        cell.hasData ? cell.count : 0,
        cell.hasData ? cell.avgTT : '"-"',
        cell.hasData ? cell.minTT : '"-"',
        cell.hasData ? cell.maxTT : '"-"'
      );
    });

    rows.push(cols.join(','));
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${matrixSummary.weekId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
