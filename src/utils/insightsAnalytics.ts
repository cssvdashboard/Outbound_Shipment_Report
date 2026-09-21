import { Shipment, InsightsAWBRecord, InsightsAnalysisResult, CountryInsights, DestLocInsights } from '../types/logistics';

/**
 * Converts Excel serial numbers or standard date strings into a JavaScript Date.
 * Uses UTC epoch so hours/minutes match Excel clock time regardless of client timezone.
 */
export function parseDateSafe(val: any): Date | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    // Excel base epoch is Dec 30, 1899 UTC
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const str = String(val).trim();
  if (!str) return null;

  // If it's a numeric string (e.g. "46265.5194")
  const num = Number(str);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    return new Date(Math.round((num - 25569) * 86400 * 1000));
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns UTC calendar day timestamp at 00:00:00 to compare dates ignoring time (Order 4).
 */
export function getCalendarDayTimestamp(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Formats a Date object into a clean readable string (e.g., "YYYY-MM-DD HH:mm") matching Excel clock time.
 */
export function formatDateTimeDisplay(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '-';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Formats a Date object into date only string (e.g., "YYYY-MM-DD").
 */
export function formatDateOnlyDisplay(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '-';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Processes shipments through the strict 5-order pipeline:
 * Order 1: Final Resolution is "Delivered"
 * Order 2: POD date cannot exceed Commit Date (podDate <= commitDate)
 * Order 3: Select only AWBs which have Dex 01 or Stat 41 date
 * Order 4: Dex 01 or Stat 41 date >= Sips date (ignoring time, calendar date only)
 * Order 5: Calculate days to POD from Dex 01 or Stat 41 date (must be >= 0, exception prior to/on delivery)
 */
export function calculateInsights(shipments: Shipment[]): InsightsAnalysisResult {
  let step1Delivered = 0;
  let step2PodWithinCommit = 0;
  let step3HasDexOrStat = 0;
  let step4DexStatGteSips = 0;

  const qualifyingRecords: InsightsAWBRecord[] = [];

  for (const s of shipments) {
    // Order 1: Final Resolution === 'Delivered'
    const finalRes = (s.finalResolution || '').trim().toLowerCase();
    if (finalRes !== 'delivered') continue;
    step1Delivered++;

    // Order 2: POD date cannot exceed Commit Date
    const podDate = parseDateSafe(s.pod);
    const commitDate = parseDateSafe(s.commitDate);

    if (!podDate || !commitDate) continue;
    if (podDate.getTime() > commitDate.getTime()) continue;
    step2PodWithinCommit++;

    // Order 3: Must have DEX 01 or STAT 41 date
    const dex01Date = parseDateSafe(s.dex01);
    const stat41Date = parseDateSafe(s.stat41);

    if (!dex01Date && !stat41Date) continue;
    step3HasDexOrStat++;

    // Order 4: DEX 01 or STAT 41 date should be as Sips date or later dates of sips (ignore time)
    const sipsDate = parseDateSafe(s.sips);
    if (!sipsDate) continue;

    const sipsCalDay = getCalendarDayTimestamp(sipsDate);
    const podCalDay = getCalendarDayTimestamp(podDate);

    // Determine primary exception event that satisfies >= SIPS date AND occurred on or before delivery
    let selectedEventDate: Date | null = null;
    let selectedType: 'DEX 01' | 'STAT 41' = 'DEX 01';

    if (dex01Date && getCalendarDayTimestamp(dex01Date) >= sipsCalDay && getCalendarDayTimestamp(dex01Date) <= podCalDay) {
      selectedEventDate = dex01Date;
      selectedType = 'DEX 01';
    } else if (stat41Date && getCalendarDayTimestamp(stat41Date) >= sipsCalDay && getCalendarDayTimestamp(stat41Date) <= podCalDay) {
      selectedEventDate = stat41Date;
      selectedType = 'STAT 41';
    }

    if (!selectedEventDate) continue;
    step4DexStatGteSips++;

    // Order 5: Calculate days to POD from DEX 01 or STAT 41 date (>= 0)
    const eventCalDay = getCalendarDayTimestamp(selectedEventDate);
    const daysToPod = Math.max(0, Math.round((podCalDay - eventCalDay) / (86400 * 1000)));
    const exactDaysToPod = Number(Math.max(0, (podDate.getTime() - selectedEventDate.getTime()) / (86400 * 1000)).toFixed(1));

    const pickupDate = parseDateSafe(s.pickup);

    qualifyingRecords.push({
      awb: s.awb || 'Unknown',
      country: (s.destination || 'UNKNOWN').trim().toUpperCase(),
      destLocCd: (s.destLocCd || 'UNKNOWN').trim().toUpperCase(),
      customer: s.customer || '-',
      shprName: s.shprName || '-',
      finalResolution: s.finalResolution || 'Delivered',
      commitDateRaw: s.commitDate,
      commitDateFormatted: formatDateTimeDisplay(commitDate),
      podRaw: s.pod,
      podFormatted: formatDateTimeDisplay(podDate),
      sipsRaw: s.sips,
      sipsFormatted: formatDateTimeDisplay(sipsDate),
      dex01Raw: s.dex01,
      dex01Formatted: formatDateTimeDisplay(dex01Date),
      stat41Raw: s.stat41,
      stat41Formatted: formatDateTimeDisplay(stat41Date),
      primaryExceptionType: selectedType,
      primaryExceptionDateFormatted: formatDateTimeDisplay(selectedEventDate),
      daysToPod,
      exactDaysToPod,
      isSameDayPod: daysToPod === 0,
      remarks: s.remarks,
      pickupRaw: s.pickup,
      pickupFormatted: formatDateTimeDisplay(pickupDate),
      weight: s.weight,
      pkgCount: s.pkgCount
    });
  }

  // Days to POD distribution
  const daysDistribution = {
    sameDay: 0,
    oneDay: 0,
    twoDays: 0,
    threeToFourDays: 0,
    fivePlusDays: 0,
    negativeDays: 0
  };

  let totalDaysSum = 0;
  let positiveRecordsCount = 0;

  for (const r of qualifyingRecords) {
    if (r.daysToPod < 0) {
      daysDistribution.negativeDays++;
    } else {
      totalDaysSum += r.daysToPod;
      positiveRecordsCount++;
      if (r.daysToPod === 0) daysDistribution.sameDay++;
      else if (r.daysToPod === 1) daysDistribution.oneDay++;
      else if (r.daysToPod === 2) daysDistribution.twoDays++;
      else if (r.daysToPod >= 3 && r.daysToPod <= 4) daysDistribution.threeToFourDays++;
      else daysDistribution.fivePlusDays++;
    }
  }

  const overallAvgDaysToPod = positiveRecordsCount > 0 ? Number((totalDaysSum / positiveRecordsCount).toFixed(1)) : 0;

  // Group by Country -> Dest Loc ID based on AWB counts
  const countryMap = new Map<string, Map<string, InsightsAWBRecord[]>>();

  for (const r of qualifyingRecords) {
    if (!countryMap.has(r.country)) {
      countryMap.set(r.country, new Map<string, InsightsAWBRecord[]>());
    }
    const locMap = countryMap.get(r.country)!;
    if (!locMap.has(r.destLocCd)) {
      locMap.set(r.destLocCd, []);
    }
    locMap.get(r.destLocCd)!.push(r);
  }

  const countries: CountryInsights[] = [];
  const uniqueDestLocSet = new Set<string>();

  for (const [countryCode, locMap] of countryMap.entries()) {
    const destLocs: DestLocInsights[] = [];
    let countryDaysSum = 0;
    let countryPosCount = 0;
    let countryAwbCount = 0;

    for (const [locId, records] of locMap.entries()) {
      uniqueDestLocSet.add(`${countryCode}_${locId}`);
      countryAwbCount += records.length;

      let locDaysSum = 0;
      let locPosCount = 0;
      for (const rec of records) {
        if (rec.daysToPod >= 0) {
          locDaysSum += rec.daysToPod;
          locPosCount++;
        }
      }
      const avgDaysToPod = locPosCount > 0 ? Number((locDaysSum / locPosCount).toFixed(1)) : 0;
      countryDaysSum += locDaysSum;
      countryPosCount += locPosCount;

      destLocs.push({
        locId,
        awbCount: records.length,
        avgDaysToPod,
        records
      });
    }

    // Sort Dest Loc IDs by AWB counts descending
    destLocs.sort((a, b) => b.awbCount - a.awbCount);

    const countryAvgDays = countryPosCount > 0 ? Number((countryDaysSum / countryPosCount).toFixed(1)) : 0;

    countries.push({
      countryCode,
      awbCount: countryAwbCount,
      destLocs,
      avgDaysToPod: countryAvgDays
    });
  }

  // Sort countries by total AWB counts descending
  countries.sort((a, b) => b.awbCount - a.awbCount);

  return {
    funnel: {
      step1_delivered: step1Delivered,
      step2_podWithinCommit: step2PodWithinCommit,
      step3_hasDexOrStat: step3HasDexOrStat,
      step4_dexStatGteSips: step4DexStatGteSips
    },
    totalInsightsAWBs: qualifyingRecords.length,
    impactedCountriesCount: countries.length,
    impactedDestLocCount: uniqueDestLocSet.size,
    overallAvgDaysToPod,
    countries,
    allRecords: qualifyingRecords,
    daysDistribution
  };
}
