import { Shipment } from '../types/logistics';
import { DatasetMeta } from './storage';

const API_BASE = '/api';

export interface ServerHealthResponse {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  dataset: {
    filename: string;
    rowCount: number;
    isCustom: boolean;
    uploadedAt: string;
  };
}

export async function checkServerHealth(): Promise<ServerHealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDatasetFromServer(): Promise<{ data: Shipment[]; meta: DatasetMeta } | null> {
  try {
    const res = await fetch(`${API_BASE}/dataset`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.shipments)) {
      return {
        data: json.shipments,
        meta: json.meta
      };
    }
    return null;
  } catch (err) {
    console.warn('[API Client] Server fetch failed:', err);
    return null;
  }
}

export async function uploadExcelToServer(file: File): Promise<{ data: Shipment[]; meta: DatasetMeta; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { data: [], meta: {} as any, error: json.error || 'Server failed to parse uploaded file.' };
    }

    return {
      data: json.shipments,
      meta: json.meta
    };
  } catch (err: any) {
    return { data: [], meta: {} as any, error: err?.message || 'Network error during upload.' };
  }
}

export async function syncDatasetToServer(shipments: Shipment[], filename: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipments, filename })
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
}

export async function resetServerDataset(): Promise<{ data: Shipment[]; meta: DatasetMeta } | null> {
  try {
    const res = await fetch(`${API_BASE}/dataset`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.shipments)) {
      return {
        data: json.shipments,
        meta: json.meta
      };
    }
    return null;
  } catch {
    return null;
  }
}
