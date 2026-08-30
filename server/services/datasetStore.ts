import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseExcelBuffer, ServerShipment } from '../utils/excelParser.js';

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

class DatasetStore {
  private shipments: ServerShipment[] = [];
  private meta: DatasetMeta = {
    filename: 'July Final Draft.xlsx (Default)',
    uploadedAt: new Date().toISOString(),
    rowCount: 0,
    isCustom: false
  };
  private isInitialized = false;

  constructor() {
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
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
          console.log(`[DatasetStore] Loaded ${this.shipments.length} records from persisted storage (${this.meta.filename})`);
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
            filename: 'July Final Draft.xlsx (Default)',
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

    // 3. Try to parse from root July Final Draft.xlsx
    if (fs.existsSync(DEFAULT_EXCEL_PATH)) {
      try {
        console.log('[DatasetStore] Parsing root July Final Draft.xlsx...');
        const buffer = fs.readFileSync(DEFAULT_EXCEL_PATH);
        const { shipments, error } = parseExcelBuffer(buffer);
        if (shipments && shipments.length > 0) {
          this.shipments = shipments;
          this.meta = {
            filename: 'July Final Draft.xlsx (Default)',
            uploadedAt: 'Parsed from Root Excel',
            rowCount: shipments.length,
            isCustom: false
          };
          this.isInitialized = true;
          console.log(`[DatasetStore] Successfully parsed ${this.shipments.length} records from root Excel`);
          return;
        }
        if (error) {
          console.error('[DatasetStore] Error parsing root Excel:', error);
        }
      } catch (err) {
        console.error('[DatasetStore] Failed parsing root Excel file:', err);
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
