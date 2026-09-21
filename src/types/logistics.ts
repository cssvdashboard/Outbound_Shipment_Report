export interface Shipment {
  awb: string;
  mawb?: string;
  destination: string;
  rampId?: string;
  destLocCd?: string;
  customer: string;
  shprName: string;
  recipient?: string;
  pkgCount?: number;
  weight?: number;
  city?: string;
  description?: string;
  pickup?: string | number;
  pod?: string | number;
  tt: number;
  ttRange: string; // "Day 1–4" | "Day 5" | "Day 6" | "Day 7" | "Day 8+" | "Undelivered"
  transitDelay?: string;
  clearanceDelay?: string;
  destinationDelay?: string;
  weekendDelay?: string;
  finalResolution: string; // "Delivered" | "RTS" | "NFBRK" etc.
  remarks?: string;
  shipmentType?: string; // 'PP' | 'CC' | 'IPD'
  isAgent?: boolean;     // true if customer has 'agent'
  sips?: string | number;
  commitDate?: string | number;
  dex01?: string | number;
  stat41?: string | number;
}

export type FilterMode = 'include' | 'exclude';

export type CategoryTypeFilter = 'ALL' | 'AGENT' | 'PP' | 'CC' | 'IPD';

export interface FilterState {
  searchTerm: string; // Autocomplete search keyword e.g. "Four", "Elite"
  selectedShippers: string[];
  filterMode: FilterMode; // 'include' or 'exclude'
  selectedCustomers: string[];
  selectedDestinations: string[];
  selectedFinalResolutions: string[];
  selectedTTRanges: string[];
  selectedTransitDelays: string[];
  selectedClearanceDelays: string[];
  selectedDestinationDelays: string[];
  selectedCategoryType?: CategoryTypeFilter; // Quick filter category for Agent, PP, CC
  selectedMonth?: string; // 'ALL' or 'YYYY-MM' format
  dateRange?: {
    start?: string;
    end?: string;
  };
}

export interface MetricSummary {
  totalCount: number;
  totalWeight: number;
  totalPkgs: number;
  avgTT: number;
  minTT: number;
  maxTT: number;
  onTimeCount: number;
  onTimePercentage: number;
  delayedTimelineCount: number;
  delayedTimelinePercentage: number;
  transitDelayCount: number;
  clearanceDelayCount: number;
  destinationDelayCount: number;
  weekendDelayCount: number;
}

export interface RatioBreakdown {
  name: string;
  count: number;
  percentage: number;
  avgTT?: number;
  color?: string;
}

export interface CountryPerformance {
  countryCode: string;
  awbCount: number;
  avgTT?: number;
  maxTT: number;
  minTT: number;
  onTimeCount: number;
  onTimePercentage: number;
  transitDelays?: number;
  clearanceDelays?: number;
  destinationDelays?: number;
  weekendDelays?: number;
  totalDelays?: number;
  totalWeight?: number;
  day1to4Count: number;
  day1to4Percentage: number;
  day5Count: number;
  day5Percentage: number;
  day6Count: number;
  day6Percentage: number;
  day7Count: number;
  day7Percentage: number;
  day8PlusCount: number;
  day8PlusPercentage: number;
  undeliveredCount: number;
  undeliveredPercentage: number;
}

export interface CustomerComparisonMetric {
  customer: string;
  awbCount: number;
  totalWeight: number;
  avgTT: number;
  minTT: number;
  maxTT: number;
  onTimeCount: number;
  onTimePercentage: number;
  delayCount: number;
  delayPercentage: number;
  transitDelays: number;
  clearanceDelays: number;
  destinationDelays: number;
}

export interface InsightsAWBRecord {
  awb: string;
  country: string;
  destLocCd: string;
  customer: string;
  shprName: string;
  finalResolution: string;
  commitDateRaw?: string | number;
  commitDateFormatted: string;
  podRaw?: string | number;
  podFormatted: string;
  sipsRaw?: string | number;
  sipsFormatted: string;
  dex01Raw?: string | number;
  dex01Formatted: string;
  stat41Raw?: string | number;
  stat41Formatted: string;
  primaryExceptionType: 'DEX 01' | 'STAT 41';
  primaryExceptionDateFormatted: string;
  daysToPod: number; // Order 5: Calendar days from DEX 01/STAT 41 date to POD
  exactDaysToPod: number; // Exact fractional days
  isSameDayPod: boolean;
  remarks?: string;
  pickupRaw?: string | number;
  pickupFormatted: string;
  weight?: number;
  pkgCount?: number;
}

export interface DestLocInsights {
  locId: string;
  awbCount: number;
  avgDaysToPod: number;
  records: InsightsAWBRecord[];
}

export interface CountryInsights {
  countryCode: string;
  awbCount: number;
  destLocs: DestLocInsights[];
  avgDaysToPod: number;
}

export interface InsightsFunnel {
  step1_delivered: number;
  step2_podWithinCommit: number;
  step3_hasDexOrStat: number;
  step4_dexStatGteSips: number; // The final qualifying set
}

export interface InsightsAnalysisResult {
  funnel: InsightsFunnel;
  totalInsightsAWBs: number;
  impactedCountriesCount: number;
  impactedDestLocCount: number;
  overallAvgDaysToPod: number;
  countries: CountryInsights[];
  allRecords: InsightsAWBRecord[];
  daysDistribution: {
    sameDay: number;
    oneDay: number;
    twoDays: number;
    threeToFourDays: number;
    fivePlusDays: number;
    negativeDays: number;
  };
}
