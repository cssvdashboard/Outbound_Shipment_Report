import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shipment,
  FilterState,
  MetricSummary,
  RatioBreakdown,
  CountryPerformance
} from '../types/logistics';
import {
  filterShipments,
  computeSummaryMetrics,
  computeDeliveryTimeline,
  computeFinalResolutions,
  computeDelayBreakdown,
  computeCountryPerformance
} from '../utils/analytics';
import { loadSavedDataset, saveDataset, clearSavedDataset, DatasetMeta } from '../services/storage';
import {
  checkServerHealth,
  fetchDatasetFromServer,
  syncDatasetToServer,
  resetServerDataset
} from '../services/api';

export const initialFilterState: FilterState = {
  searchTerm: '',
  selectedShippers: [],
  filterMode: 'include',
  selectedCustomers: [],
  selectedDestinations: [],
  selectedFinalResolutions: [],
  selectedTTRanges: [],
  selectedTransitDelays: [],
  selectedClearanceDelays: [],
  selectedDestinationDelays: []
};

export function useLogisticsData() {
  const [rawShipments, setRawShipments] = useState<Shipment[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta>({
    filename: 'July Final Draft.xlsx (Default)',
    uploadedAt: 'Preloaded Dataset',
    rowCount: 27978,
    isCustom: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  // Load initial data: prefer backend server, fallback to IndexedDB or local JSON
  useEffect(() => {
    async function initData() {
      setIsLoading(true);
      try {
        // 1. Check if backend server is online
        const serverHealth = await checkServerHealth();
        if (serverHealth) {
          setIsServerConnected(true);
          const serverData = await fetchDatasetFromServer();
          if (serverData && serverData.data.length > 0) {
            setRawShipments(serverData.data);
            setDatasetMeta(serverData.meta);
            // Cache in IndexedDB for offline resilience
            saveDataset(serverData.data, serverData.meta.filename);
            setIsLoading(false);
            return;
          }
        } else {
          setIsServerConnected(false);
        }

        // 2. Fallback to IndexedDB
        const { data, meta } = await loadSavedDataset();
        if (data && data.length > 0 && meta) {
          setRawShipments(data);
          setDatasetMeta(meta);
        } else {
          // 3. Fallback to static public JSON
          const response = await fetch('./defaultData.json');
          if (!response.ok) throw new Error('Failed to fetch defaultData.json');
          const defaultData: Shipment[] = await response.json();
          setRawShipments(defaultData);
          setDatasetMeta({
            filename: 'July Final Draft.xlsx (Default)',
            uploadedAt: 'Preloaded July Data',
            rowCount: defaultData.length,
            isCustom: false
          });
        }
      } catch (err) {
        console.error('Failed initializing data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, []);

  // Handler for uploading a new weekly dataset
  const handleDatasetUpdate = useCallback(async (newShipments: Shipment[], filename: string) => {
    setIsLoading(true);
    try {
      const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
      
      // Update local storage
      await saveDataset(newShipments, filename);
      
      // Try to sync with server in background
      if (isServerConnected) {
        syncDatasetToServer(newShipments, filename).catch(err => console.warn('Server sync error:', err));
      }

      setRawShipments(newShipments);
      setDatasetMeta({
        filename,
        uploadedAt: formattedTime,
        rowCount: newShipments.length,
        isCustom: true
      });
      // Reset active filters on new dataset upload
      setFilters(initialFilterState);
    } catch (err) {
      console.error('Failed saving new dataset:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isServerConnected]);

  // Handler to reset back to default July dataset
  const handleResetToDefault = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearSavedDataset();
      
      if (isServerConnected) {
        const serverReset = await resetServerDataset();
        if (serverReset && serverReset.data.length > 0) {
          setRawShipments(serverReset.data);
          setDatasetMeta(serverReset.meta);
          setFilters(initialFilterState);
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('./defaultData.json');
      const defaultData: Shipment[] = await response.json();
      setRawShipments(defaultData);
      setDatasetMeta({
        filename: 'July Final Draft.xlsx (Default)',
        uploadedAt: 'Preloaded July Data',
        rowCount: defaultData.length,
        isCustom: false
      });
      setFilters(initialFilterState);
    } catch (err) {
      console.error('Failed resetting dataset:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isServerConnected]);

  // Filter setters
  const setFilterMode = useCallback((mode: 'include' | 'exclude') => {
    setFilters((prev) => ({ ...prev, filterMode: mode }));
  }, []);

  const addShipperFilter = useCallback((shipper: string) => {
    setFilters((prev) => {
      if (prev.selectedShippers.includes(shipper)) return prev;
      return { ...prev, selectedShippers: [...prev.selectedShippers, shipper] };
    });
  }, []);

  const removeShipperFilter = useCallback((shipper: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedShippers: prev.selectedShippers.filter((s) => s !== shipper)
    }));
  }, []);

  const addCustomerFilter = useCallback((customer: string) => {
    setFilters((prev) => {
      if (prev.selectedCustomers.includes(customer)) return prev;
      return { ...prev, selectedCustomers: [...prev.selectedCustomers, customer] };
    });
  }, []);

  const removeCustomerFilter = useCallback((customer: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedCustomers: prev.selectedCustomers.filter((c) => c !== customer)
    }));
  }, []);

  const setDestinationFilter = useCallback((dest: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedDestinations: dest === 'ALL' || !dest ? [] : [dest]
    }));
  }, []);

  const setFinalResolutionFilter = useCallback((resolution: string | null) => {
    setFilters((prev) => {
      if (!resolution) return { ...prev, selectedFinalResolutions: [] };
      const exists = prev.selectedFinalResolutions.includes(resolution);
      return {
        ...prev,
        selectedFinalResolutions: exists ? [] : [resolution]
      };
    });
  }, []);

  const setTTRangeFilter = useCallback((range: string | null) => {
    setFilters((prev) => {
      if (!range) return { ...prev, selectedTTRanges: [] };
      const exists = prev.selectedTTRanges.includes(range);
      return {
        ...prev,
        selectedTTRanges: exists ? [] : [range]
      };
    });
  }, []);

  const setDelayFilter = useCallback((category: 'transit' | 'clearance' | 'destination', reason: string | null) => {
    setFilters((prev) => {
      if (!reason) {
        return {
          ...prev,
          selectedTransitDelays: category === 'transit' ? [] : prev.selectedTransitDelays,
          selectedClearanceDelays: category === 'clearance' ? [] : prev.selectedClearanceDelays,
          selectedDestinationDelays: category === 'destination' ? [] : prev.selectedDestinationDelays
        };
      }
      if (category === 'transit') return { ...prev, selectedTransitDelays: [reason] };
      if (category === 'clearance') return { ...prev, selectedClearanceDelays: [reason] };
      return { ...prev, selectedDestinationDelays: [reason] };
    });
  }, []);

  const resetAllFilters = useCallback(() => {
    setFilters(initialFilterState);
  }, []);

  // Filtered dataset memo
  const filteredShipments = useMemo(() => {
    return filterShipments(rawShipments, filters);
  }, [rawShipments, filters]);

  // Analytical outputs memoized for sub-second reactive performance
  const summaryMetrics: MetricSummary = useMemo(() => {
    return computeSummaryMetrics(filteredShipments);
  }, [filteredShipments]);

  const deliveryTimeline: RatioBreakdown[] = useMemo(() => {
    return computeDeliveryTimeline(filteredShipments);
  }, [filteredShipments]);

  const finalResolutions: RatioBreakdown[] = useMemo(() => {
    return computeFinalResolutions(filteredShipments);
  }, [filteredShipments]);

  const transitDelaysBreakdown: RatioBreakdown[] = useMemo(() => {
    return computeDelayBreakdown(filteredShipments, 'transitDelay');
  }, [filteredShipments]);

  const clearanceDelaysBreakdown: RatioBreakdown[] = useMemo(() => {
    return computeDelayBreakdown(filteredShipments, 'clearanceDelay');
  }, [filteredShipments]);

  const destinationDelaysBreakdown: RatioBreakdown[] = useMemo(() => {
    return computeDelayBreakdown(filteredShipments, 'destinationDelay');
  }, [filteredShipments]);

  const countryPerformance: CountryPerformance[] = useMemo(() => {
    return computeCountryPerformance(filteredShipments);
  }, [filteredShipments]);

  // Unique lists for dropdowns
  const allDestinations = useMemo(() => {
    const set = new Set<string>();
    for (const s of rawShipments) {
      if (s.destination) set.add(s.destination.toUpperCase());
    }
    return Array.from(set).sort();
  }, [rawShipments]);

  const allCustomers = useMemo(() => {
    const set = new Set<string>();
    for (const s of rawShipments) {
      if (s.customer) set.add(s.customer);
    }
    return Array.from(set).sort();
  }, [rawShipments]);

  return {
    rawShipments,
    filteredShipments,
    datasetMeta,
    isLoading,
    isServerConnected,
    filters,
    setFilters,
    setFilterMode,
    addShipperFilter,
    removeShipperFilter,
    addCustomerFilter,
    removeCustomerFilter,
    setDestinationFilter,
    setFinalResolutionFilter,
    setTTRangeFilter,
    setDelayFilter,
    resetAllFilters,
    handleDatasetUpdate,
    handleResetToDefault,
    summaryMetrics,
    deliveryTimeline,
    finalResolutions,
    transitDelaysBreakdown,
    clearanceDelaysBreakdown,
    destinationDelaysBreakdown,
    countryPerformance,
    allDestinations,
    allCustomers
  };
}
