import { get, set, del } from 'idb-keyval';
import { Shipment } from '../types/logistics';

const STORAGE_KEY_DATA = 'transitpulse_weekly_data';
const STORAGE_KEY_META = 'transitpulse_dataset_meta';
const STORAGE_KEY_THEME = 'transitpulse_theme';

export interface DatasetMeta {
  filename: string;
  uploadedAt: string;
  rowCount: number;
  isCustom: boolean;
}

export async function saveDataset(shipments: Shipment[], filename: string): Promise<void> {
  try {
    await set(STORAGE_KEY_DATA, shipments);
    const meta: DatasetMeta = {
      filename,
      uploadedAt: new Date().toISOString(),
      rowCount: shipments.length,
      isCustom: true
    };
    await set(STORAGE_KEY_META, meta);
  } catch (error) {
    console.error('Failed to save dataset to IndexedDB:', error);
  }
}

export async function loadSavedDataset(): Promise<{ data: Shipment[] | null; meta: DatasetMeta | null }> {
  try {
    const data = (await get<Shipment[]>(STORAGE_KEY_DATA)) || null;
    const meta = (await get<DatasetMeta>(STORAGE_KEY_META)) || null;
    return { data, meta };
  } catch (error) {
    console.error('Failed to load dataset from IndexedDB:', error);
    return { data: null, meta: null };
  }
}

export async function clearSavedDataset(): Promise<void> {
  try {
    await del(STORAGE_KEY_DATA);
    await del(STORAGE_KEY_META);
  } catch (error) {
    console.error('Failed to reset dataset in IndexedDB:', error);
  }
}

export async function updateShipmentInStorage(awb: string, updates: Partial<Shipment>): Promise<void> {
  try {
    const list = (await get<Shipment[]>(STORAGE_KEY_DATA)) || [];
    const cleanAwb = String(awb).trim();
    const idx = list.findIndex(s => String(s.awb).trim() === cleanAwb);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      await set(STORAGE_KEY_DATA, list);
    }
  } catch (error) {
    console.error('Failed to update single shipment in IndexedDB:', error);
  }
}

const STORAGE_KEY_MODE = 'transitpulse_display_mode';

export type ThemeType = 'dark' | 'light' | 'midnight' | 'teal';
export type DisplayMode = 'standard' | 'compact' | 'tv' | 'incident';

export function getStoredTheme(): ThemeType {
  const stored = localStorage.getItem(STORAGE_KEY_THEME);
  if (stored === 'light' || stored === 'dark' || stored === 'midnight' || stored === 'teal') {
    return stored;
  }
  return 'dark'; // Dark mode is default
}

export function setStoredTheme(theme: ThemeType): void {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

export function getStoredDisplayMode(): DisplayMode {
  const stored = localStorage.getItem(STORAGE_KEY_MODE);
  if (stored === 'standard' || stored === 'compact' || stored === 'tv' || stored === 'incident') {
    return stored;
  }
  return 'standard';
}

export function setStoredDisplayMode(mode: DisplayMode): void {
  localStorage.setItem(STORAGE_KEY_MODE, mode);
}
