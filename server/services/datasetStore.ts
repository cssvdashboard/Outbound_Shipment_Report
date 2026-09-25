import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseExcelBuffer, ServerShipment } from '../utils/excelParser.js';
import { syncShipmentToSourceExcel } from './excelSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatasetMeta {
  filename: string;
  uploadedAt: string;
  rowCount: number;
  isCustom: boolean;
  sizeBytes?: number;
}

export interface DatasetStats {
  totalShipments: number;
  uniqueCustomers: number;
  uniqueShippers: number;
  uniqueDestinations: number;
  avgTransitTime: number;
  onTimeCount: number;
  onTimeRate: number;
  totalWeightKg: number;
  totalPackages: number;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const ACTIVE_DATASET_FILE = path.join(DATA_DIR, 'active_dataset.json');
const DEFAULT_JSON_PATH = path.resolve(__dirname, '../../public/defaultData.json');
const DEFAULT_EXCEL_PATH = path.resolve(__dirname, '../../July Final Draft.xlsx');
const AUG_EXCEL_PATH = path.resolve(__dirname, '../../August Final Draft.xlsx');
const SEPT_EXCEL_PATH = path.resolve(__dirname, '../../September Final Draft.xlsx');

class DatasetStore {
  private shipments: ServerShipment[] = [];
  private meta: DatasetMeta = {
    filename: 'July & August Final Draft (Default)',
    uploadedAt: new Date().toISOString(),
    rowCount: 0,
    isCustom: false
  };
  private isInitialized = false;
  private masterFilePaths = [DEFAULT_EXCEL_PATH, AUG_EXCEL_PATH, SEPT_EXCEL_PATH];
  private lastKnownMtimes: Record<string, number> = {};

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public recordMasterMtimes(): void {
    for (const p of this.masterFilePaths) {
      if (fs.existsSync(p)) {
        try {
          this.lastKnownMtimes[p] = fs.statSync(p).mtimeMs;
        } catch {}
      }
    }
  }

  public updateRecordedMtime(filePath: string): void {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      try {
        this.lastKnownMtimes[resolved] = fs.statSync(resolved).mtimeMs;
      } catch {}
    }
  }

  public hasExternalExcelModifications(): boolean {
    for (const p of this.masterFilePaths) {
      if (fs.existsSync(p)) {
        try {
          const currentMtime = fs.statSync(p).mtimeMs;
          const recorded = this.lastKnownMtimes[p] || 0;
          if (currentMtime > recorded + 2000) {
            return true;
          }
        } catch {}
      }
    }
    return false;
  }

  public async reloadFromMasterExcelFiles(): Promise<DatasetMeta> {
    console.log('[DatasetStore] 🔄 Parsing master Excel files on disk (July, August, September)...');
    const combinedShipments: ServerShipment[] = [];
    if (fs.existsSync(DEFAULT_EXCEL_PATH)) {
      try {
        console.log('[DatasetStore] Parsing root July Final Draft.xlsx...');
        const buffer = fs.readFileSync(DEFAULT_EXCEL_PATH);
        const { shipments } = parseExcelBuffer(buffer);
        if (shipments && shipments.length > 0) combinedShipments.push(...shipments);
      } catch (e) {
        console.error('[DatasetStore] Error reading July Excel:', e);
      }
    }
    if (fs.existsSync(AUG_EXCEL_PATH)) {
      try {
        console.log('[DatasetStore] Parsing root August Final Draft.xlsx...');
        const buffer = fs.readFileSync(AUG_EXCEL_PATH);
        const { shipments } = parseExcelBuffer(buffer);
        if (shipments && shipments.length > 0) combinedShipments.push(...shipments);
      } catch (e) {
        console.error('[DatasetStore] Error reading August Excel:', e);
      }
    }
    if (fs.existsSync(SEPT_EXCEL_PATH)) {
      try {
        console.log('[DatasetStore] Parsing root September Final Draft.xlsx...');
        const buffer = fs.readFileSync(SEPT_EXCEL_PATH);
        const { shipments } = parseExcelBuffer(buffer);
        if (shipments && shipments.length > 0) combinedShipments.push(...shipments);
      } catch (e) {
        console.error('[DatasetStore] Error reading September Excel:', e);
      }
    }

    if (combinedShipments.length > 0) {
      const hasSept = fs.existsSync(SEPT_EXCEL_PATH);
      this.shipments = combinedShipments;
      this.meta = {
        filename: hasSept ? 'July, August & September Final Draft (Default)' : 'July & August Final Draft (Default)',
        uploadedAt: new Date().toISOString(),
        rowCount: combinedShipments.length,
        isCustom: false
      };
      this.ensureDataDirectory();
      try {
        fs.writeFileSync(ACTIVE_DATASET_FILE, JSON.stringify({ meta: this.meta, shipments: this.shipments }), 'utf-8');
      } catch (err) {
        console.error('[DatasetStore] Error writing active_dataset.json after Excel reload:', err);
      }
      if (fs.existsSync(DEFAULT_JSON_PATH)) {
        try {
          fs.writeFileSync(DEFAULT_JSON_PATH, JSON.stringify(this.shipments), 'utf-8');
        } catch {}
      }
      this.recordMasterMtimes();
      console.log(`[DatasetStore] ✅ Successfully reloaded ${combinedShipments.length} records from master Excel files.`);
    }

    return this.meta;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.ensureDataDirectory();

    // 1. Try to load existing persisted custom dataset
    if (fs.existsSync(ACTIVE_DATASET_FILE)) {
      try {
        const rawContent = fs.readFileSync(ACTIVE_DATASET_FILE, 'utf-8');
        const parsed = JSON.parse(rawContent);
        if (parsed && Array.isArray(parsed.shipments) && parsed.shipments.length > 0) {
          this.shipments = parsed.shipments;
          this.meta = parsed.meta || {
            filename: 'Persisted Dataset',
            uploadedAt: new Date().toISOString(),
            rowCount: parsed.shipments.length,
            isCustom: true
          };
          this.isInitialized = true;
          this.recordMasterMtimes();

          // Check if any root Excel file was modified externally after the active_dataset was saved
          const fileStat = fs.statSync(ACTIVE_DATASET_FILE);
          const datasetSavedTime = fileStat.mtimeMs;
          const anyNewerExcel = this.masterFilePaths.some(p => fs.existsSync(p) && fs.statSync(p).mtimeMs > datasetSavedTime + 2000);
          if (anyNewerExcel) {
            console.log('[DatasetStore] 🔔 Detected master Excel files modified externally since last save. Reloading...');
            await this.reloadFromMasterExcelFiles();
          } else {
            console.log(`[DatasetStore] Loaded ${this.shipments.length} records from persisted storage (${this.meta.filename})`);
          }
          return;
        }
      } catch (err) {
        console.error('[DatasetStore] Failed to read active_dataset.json, falling back to default:', err);
      }
    }

    // 2. Try to load from public/defaultData.json
    if (fs.existsSync(DEFAULT_JSON_PATH)) {
      try {
        console.log('[DatasetStore] Loading default data from public/defaultData.json...');
        const raw = fs.readFileSync(DEFAULT_JSON_PATH, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          this.shipments = list;
          this.meta = {
            filename: 'July & August Final Draft (Default)',
            uploadedAt: 'Preloaded Dataset',
            rowCount: list.length,
            isCustom: false
          };
          this.isInitialized = true;
          console.log(`[DatasetStore] Successfully loaded default dataset: ${this.shipments.length} records`);
          return;
        }
      } catch (err) {
        console.error('[DatasetStore] Failed to load defaultData.json:', err);
      }
    }

    // 3. Try to parse from root July, August, and September Excel files
    if (fs.existsSync(DEFAULT_EXCEL_PATH) || fs.existsSync(AUG_EXCEL_PATH) || fs.existsSync(SEPT_EXCEL_PATH)) {
      try {
        const combinedShipments: ServerShipment[] = [];
        if (fs.existsSync(DEFAULT_EXCEL_PATH)) {
          console.log('[DatasetStore] Parsing root July Final Draft.xlsx...');
          const buffer = fs.readFileSync(DEFAULT_EXCEL_PATH);
          const { shipments } = parseExcelBuffer(buffer);
          if (shipments && shipments.length > 0) {
            combinedShipments.push(...shipments);
          }
        }
        if (fs.existsSync(AUG_EXCEL_PATH)) {
          console.log('[DatasetStore] Parsing root August Final Draft.xlsx...');
          const buffer = fs.readFileSync(AUG_EXCEL_PATH);
          const { shipments } = parseExcelBuffer(buffer);
          if (shipments && shipments.length > 0) {
            combinedShipments.push(...shipments);
          }
        }
        if (fs.existsSync(SEPT_EXCEL_PATH)) {
          console.log('[DatasetStore] Parsing root September Final Draft.xlsx...');
          const buffer = fs.readFileSync(SEPT_EXCEL_PATH);
          const { shipments } = parseExcelBuffer(buffer);
          if (shipments && shipments.length > 0) {
            combinedShipments.push(...shipments);
          }
        }

        if (combinedShipments.length > 0) {
          const hasSept = fs.existsSync(SEPT_EXCEL_PATH);
          this.shipments = combinedShipments;
          this.meta = {
            filename: hasSept ? 'July, August & September Final Draft (Default)' : 'July & August Final Draft (Default)',
            uploadedAt: 'Parsed from Root Excel',
            rowCount: combinedShipments.length,
            isCustom: false
          };
          this.isInitialized = true;
          console.log(`[DatasetStore] Successfully parsed ${this.shipments.length} records from root Excel files`);
          return;
        }
      } catch (err) {
        console.error('[DatasetStore] Failed parsing root Excel files:', err);
      }
    }

    this.shipments = [];
    this.meta = {
      filename: 'Empty Dataset',
      uploadedAt: new Date().toISOString(),
      rowCount: 0,
      isCustom: false
    };
    this.isInitialized = true;
    console.warn('[DatasetStore] No initial dataset found. Initialized with empty dataset.');
  }

  public getDataset(): { shipments: ServerShipment[]; meta: DatasetMeta } {
    return {
      shipments: this.shipments,
      meta: this.meta
    };
  }

  public async setDataset(shipments: ServerShipment[], filename: string, isCustom = true): Promise<DatasetMeta> {
    this.shipments = shipments;
    this.meta = {
      filename,
      uploadedAt: new Date().toISOString(),
      rowCount: shipments.length,
      isCustom
    };

    this.ensureDataDirectory();
    try {
      const payload = JSON.stringify({ meta: this.meta, shipments: this.shipments });
      fs.writeFileSync(ACTIVE_DATASET_FILE, payload, 'utf-8');
      console.log(`[DatasetStore] Persisted ${shipments.length} records to ${ACTIVE_DATASET_FILE}`);
    } catch (err) {
      console.error('[DatasetStore] Error writing active_dataset.json:', err);
    }

    return this.meta;
  }

  public async updateShipment(awb: string, updates: Partial<ServerShipment>): Promise<ServerShipment | null> {
    const cleanAwb = String(awb).trim();
    const idx = this.shipments.findIndex(s => String(s.awb).trim() === cleanAwb);
    if (idx === -1) {
      return null;
    }

    const current = this.shipments[idx];
    const updated: ServerShipment = {
      ...current,
      ...updates,
      awb: current.awb // Preserve primary AWB key
    };

    this.shipments[idx] = updated;

    this.ensureDataDirectory();
    try {
      const payload = JSON.stringify({ meta: this.meta, shipments: this.shipments });
      fs.writeFileSync(ACTIVE_DATASET_FILE, payload, 'utf-8');
      console.log(`[DatasetStore] Updated shipment AWB ${cleanAwb} and persisted to active_dataset.json`);
    } catch (err) {
      console.error('[DatasetStore] Error saving updated shipment to active_dataset.json:', err);
    }

    // Keep public/defaultData.json in sync for offline/client fallback
    if (fs.existsSync(DEFAULT_JSON_PATH)) {
      try {
        fs.writeFileSync(DEFAULT_JSON_PATH, JSON.stringify(this.shipments), 'utf-8');
      } catch {
        // Non-blocking
      }
    }

    // Automatically update the original source Excel file (July, August, or September)
    syncShipmentToSourceExcel(cleanAwb, updates).then(res => {
      if (res.success) {
        console.log(`[DatasetStore] Master Excel file ${res.filename} updated for AWB ${cleanAwb}`);
        this.recordMasterMtimes();
      } else {
        console.warn(`[DatasetStore] Master Excel sync note: ${res.error}`);
      }
    }).catch(err => {
      console.error('[DatasetStore] Master Excel sync error:', err);
    });

    return updated;
  }

  public async resetToDefault(): Promise<{ shipments: ServerShipment[]; meta: DatasetMeta }> {
    try {
      if (fs.existsSync(ACTIVE_DATASET_FILE)) {
        fs.unlinkSync(ACTIVE_DATASET_FILE);
      }
    } catch (err) {
      console.error('[DatasetStore] Failed to remove active_dataset.json:', err);
    }

    this.isInitialized = false;
    await this.initialize();
    return this.getDataset();
  }

  public getStats(): DatasetStats {
    const total = this.shipments.length;
    if (total === 0) {
      return {
        totalShipments: 0,
        uniqueCustomers: 0,
        uniqueShippers: 0,
        uniqueDestinations: 0,
        avgTransitTime: 0,
        onTimeCount: 0,
        onTimeRate: 0,
        totalWeightKg: 0,
        totalPackages: 0
      };
    }

    const customers = new Set<string>();
    const shippers = new Set<string>();
    const destinations = new Set<string>();
    let sumTT = 0;
    let onTimeCount = 0;
    let totalWeight = 0;
    let totalPkgs = 0;

    for (const s of this.shipments) {
      if (s.customer) customers.add(s.customer);
      if (s.shprName) shippers.add(s.shprName);
      if (s.destination) destinations.add(s.destination.toUpperCase());
      sumTT += s.tt || 0;
      if ((s.tt || 0) <= 5) onTimeCount++;
      totalWeight += s.weight || 0;
      totalPkgs += s.pkgCount || 0;
    }

    return {
      totalShipments: total,
      uniqueCustomers: customers.size,
      uniqueShippers: shippers.size,
      uniqueDestinations: destinations.size,
      avgTransitTime: Number((sumTT / total).toFixed(2)),
      onTimeCount,
      onTimeRate: Number(((onTimeCount / total) * 100).toFixed(1)),
      totalWeightKg: Math.round(totalWeight),
      totalPackages: totalPkgs
    };
  }
}

export const datasetStore = new DatasetStore();
