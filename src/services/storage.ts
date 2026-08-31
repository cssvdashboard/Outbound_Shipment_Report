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

export function getStoredTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem(STORAGE_KEY_THEME);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark'; // Dark mode is default
}

export function setStoredTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}
