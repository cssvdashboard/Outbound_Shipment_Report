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
  ttRange: string; // "Within 4-5 Days" | "More Than 5 Days"
  transitDelay?: string;
  clearanceDelay?: string;
  destinationDelay?: string;
  weekendDelay?: string;
  finalResolution: string; // "Delivered" | "RTS" | "NFBRK" etc.
  remarks?: string;
  shipmentType?: string; // 'PP' | 'CC'
  isAgent?: boolean;     // true if customer has 'agent'
}

export type FilterMode = 'include' | 'exclude';

export type CategoryTypeFilter = 'ALL' | 'AGENT' | 'PP' | 'CC';

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
  avgTT: number;
  maxTT: number;
  minTT: number;
  onTimeCount: number;
  onTimePercentage: number;
  transitDelays: number;
  clearanceDelays: number;
  destinationDelays: number;
}

export interface CustomerComparisonMetric {
  customer: string;
  awbCount: number;
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
