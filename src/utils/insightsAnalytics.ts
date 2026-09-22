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
 * Order 3: Exclude all DEX 01 AWBs and select only AWBs which have Stat 41 date
 * Order 4: Stat 41 date >= Sips date and <= POD date (ignoring time, calendar date only)
 * Order 5: Calculate days to POD from difference between POD Date - SIPS (must be >= 0)
 */
export function calculateInsights(shipments: Shipment[]): InsightsAnalysisResult {
  let step1Delivered = 0;
  let step2PodWithinCommit = 0;
  let step3HasStat = 0;
  let step4StatGteSips = 0;

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

    // Exclude all DEX 01 AWBs
    const dex01Date = parseDateSafe(s.dex01);
    if (dex01Date || s.dex01) continue;

    // Order 3: Must have STAT 41 date
    const stat41Date = parseDateSafe(s.stat41);
    if (!stat41Date) continue;
    step3HasStat++;

    // Order 4: STAT 41 date should be as Sips date or later dates of sips, and on or before delivery (ignore time)
    const sipsDate = parseDateSafe(s.sips);
    if (!sipsDate) continue;

    const sipsCalDay = getCalendarDayTimestamp(sipsDate);
    const podCalDay = getCalendarDayTimestamp(podDate);
    const statCalDay = getCalendarDayTimestamp(stat41Date);

    // Order 5: Calculate days to POD from difference between POD Date - SIPS (keep only 2+ days, exclude 0d and 1d)
    const daysToPod = Math.max(0, Math.round((podCalDay - sipsCalDay) / (86400 * 1000)));
    const exactDaysToPod = Number(Math.max(0, (podDate.getTime() - sipsDate.getTime()) / (86400 * 1000)).toFixed(1));

    if (daysToPod < 2) continue;
    step4StatGteSips++;

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
      dex01Formatted: '-',
      stat41Raw: s.stat41,
      stat41Formatted: formatDateTimeDisplay(stat41Date),
      primaryExceptionType: 'STAT 41',
      primaryExceptionDateFormatted: formatDateTimeDisplay(stat41Date),
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
      step3_hasDexOrStat: step3HasStat,
      step4_dexStatGteSips: step4StatGteSips
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
