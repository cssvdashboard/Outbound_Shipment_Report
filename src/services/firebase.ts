import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  limit,
  query
} from 'firebase/firestore';
import { get, set } from 'idb-keyval';
import { Shipment } from '../types/logistics';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export type CloudConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CloudSyncStatus {
  state: CloudConnectionState;
  projectId?: string;
  lastSyncedAt?: string;
  totalSyncedEdits: number;
  errorMessage?: string;
}

const STORAGE_KEY_FIREBASE_CONFIG = 'outbound_firebase_config_v1';
const STORAGE_KEY_TEAM_PIN = 'outbound_team_pin_v1';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let activeUnsubscribe: (() => void) | null = null;

let currentStatus: CloudSyncStatus = {
  state: 'disconnected',
  totalSyncedEdits: 0
};

const statusListeners = new Set<(status: CloudSyncStatus) => void>();

function updateStatus(patch: Partial<CloudSyncStatus>) {
  currentStatus = { ...currentStatus, ...patch };
  statusListeners.forEach((listener) => {
    try {
      listener(currentStatus);
    } catch (err) {
      console.error('[CloudSync] Status listener error:', err);
    }
  });
}

export function subscribeToCloudStatus(callback: (status: CloudSyncStatus) => void): () => void {
  callback(currentStatus);
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

/**
 * Retrieves saved Firebase configuration from browser IndexedDB,
 * with fallback to Vite environment variables.
 */
export async function getSavedFirebaseConfig(): Promise<FirebaseConfig | null> {
  try {
    const saved = await get<FirebaseConfig>(STORAGE_KEY_FIREBASE_CONFIG);
    if (saved && saved.apiKey && saved.projectId && saved.appId) {
      return saved;
    }
  } catch (err) {
    console.warn('[CloudSync] Failed to read from IndexedDB, trying localStorage:', err);
  }

  try {
    const ls = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (ls) {
      const parsed = JSON.parse(ls);
      if (parsed.apiKey && parsed.projectId && parsed.appId) {
        return parsed;
      }
    }
  } catch {}

  // Fallback to Vite build-time env variables if defined
  const metaEnv = (import.meta as any)?.env || {};
  const envKey = metaEnv.VITE_FIREBASE_API_KEY;
  const envProj = metaEnv.VITE_FIREBASE_PROJECT_ID;
  const envApp = metaEnv.VITE_FIREBASE_APP_ID;

  if (envKey && envProj && envApp) {
    return {
      apiKey: envKey,
      authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || `${envProj}.firebaseapp.com`,
      projectId: envProj,
      storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: envApp
    };
  }

  return null;
}

/**
 * Persists the Firebase configuration in browser storage.
 */
export async function saveFirebaseConfig(config: FirebaseConfig): Promise<void> {
  try {
    await set(STORAGE_KEY_FIREBASE_CONFIG, config);
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
  } catch {}
}

/**
 * Clears saved Firebase config and disconnects.
 */
export async function clearFirebaseConfig(): Promise<void> {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }
  firebaseApp = null;
  firestoreDb = null;
  try {
    await set(STORAGE_KEY_FIREBASE_CONFIG, null);
  } catch {}
  try {
    localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
  } catch {}
  updateStatus({
    state: 'disconnected',
    projectId: undefined,
    errorMessage: undefined,
    totalSyncedEdits: 0
  });
}

/**
 * Retrieves the configured Team PIN, if any.
 */
export async function getSavedTeamPin(): Promise<string> {
  try {
    const pin = await get<string>(STORAGE_KEY_TEAM_PIN);
    if (pin) return pin;
  } catch {}
  return localStorage.getItem(STORAGE_KEY_TEAM_PIN) || '';
}

/**
 * Saves or clears the Team PIN.
 */
export async function saveTeamPin(pin: string): Promise<void> {
  try {
    await set(STORAGE_KEY_TEAM_PIN, pin);
  } catch {}
  try {
    if (pin) {
      localStorage.setItem(STORAGE_KEY_TEAM_PIN, pin);
    } else {
      localStorage.removeItem(STORAGE_KEY_TEAM_PIN);
    }
  } catch {}
}

/**
 * Initializes the Firebase and Firestore instances.
 */
export async function initFirebase(providedConfig?: FirebaseConfig): Promise<Firestore | null> {
  const config = providedConfig || (await getSavedFirebaseConfig());
  if (!config || !config.apiKey || !config.projectId) {
    updateStatus({ state: 'disconnected' });
    return null;
  }

  try {
    updateStatus({ state: 'connecting', projectId: config.projectId, errorMessage: undefined });

    if (!firebaseApp) {
      const existingApps = getApps();
      firebaseApp = existingApps.length > 0 ? getApp() : initializeApp(config);
    }

    if (!firestoreDb) {
      firestoreDb = getFirestore(firebaseApp);
    }

    updateStatus({ state: 'connected', projectId: config.projectId });
    return firestoreDb;
  } catch (err: any) {
    console.error('[CloudSync] Firebase init failed:', err);
    updateStatus({ state: 'error', errorMessage: err?.message || 'Failed to initialize Firebase' });
    return null;
  }
}

/**
 * Tests connection to Firestore by running a lightweight query.
 */
export async function testFirebaseConnection(config: FirebaseConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const tempApp = initializeApp(config, `test-app-${Date.now()}`);
    const tempDb = getFirestore(tempApp);
    const editsRef = collection(tempDb, 'shipment_edits');
    const q = query(editsRef, limit(1));
    await getDocs(q);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not connect to Firestore' };
  }
}

/**
 * Subscribes to real-time changes in the 'shipment_edits' Firestore collection.
 * Triggers callback with map of AWB -> Partial<Shipment> whenever edits occur.
 */
export function subscribeToShipmentEdits(
  onEditsReceived: (edits: Record<string, Partial<Shipment>>) => void
): () => void {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  // Attempt to initialize if not yet connected
  initFirebase().then((db) => {
    if (!db) return;

    try {
      const editsRef = collection(db, 'shipment_edits');

      activeUnsubscribe = onSnapshot(
        editsRef,
        (snapshot) => {
          const editsMap: Record<string, Partial<Shipment>> = {};
          let count = 0;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const awb = docSnap.id;
            if (awb && data) {
              editsMap[awb] = {
                ...data,
                awb
              } as Partial<Shipment>;
              count++;
            }
          });

          updateStatus({
            state: 'connected',
            totalSyncedEdits: count,
            lastSyncedAt: new Date().toLocaleTimeString()
          });

          onEditsReceived(editsMap);
        },
        (error) => {
          console.error('[CloudSync] Firestore listener error:', error);
          updateStatus({ state: 'error', errorMessage: error.message });
        }
      );
    } catch (err: any) {
      console.error('[CloudSync] Failed to setup listener:', err);
      updateStatus({ state: 'error', errorMessage: err?.message });
    }
  });

  return () => {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
  };
}

/**
 * Saves an individual shipment edit/override to Firestore.
 * Automatically broadcasts to all connected collaborators in real-time.
 */
export async function saveShipmentEditToCloud(
  awb: string,
  patch: Partial<Shipment>,
  editor?: string
): Promise<{ success: boolean; error?: string }> {
  const db = firestoreDb || (await initFirebase());
  if (!db) {
    return { success: false, error: 'Cloud Database not connected' };
  }

  try {
    const cleanAwb = awb.trim();
    const docRef = doc(db, 'shipment_edits', cleanAwb);

    const payload = {
      ...patch,
      awb: cleanAwb,
      updatedAt: serverTimestamp(),
      lastEditor: editor || 'Anonymous Collaborator'
    };

    await setDoc(docRef, payload, { merge: true });
    updateStatus({ lastSyncedAt: new Date().toLocaleTimeString() });
    return { success: true };
  } catch (err: any) {
    console.error('[CloudSync] Save edit failed:', err);
    return { success: false, error: err?.message || 'Failed to save to Firestore' };
  }
}

/**
 * Removes an edit/override from Firestore.
 */
export async function deleteShipmentEditFromCloud(awb: string): Promise<{ success: boolean; error?: string }> {
  const db = firestoreDb || (await initFirebase());
  if (!db) {
    return { success: false, error: 'Cloud Database not connected' };
  }

  try {
    const cleanAwb = awb.trim();
    const docRef = doc(db, 'shipment_edits', cleanAwb);
    await deleteDoc(docRef);
    updateStatus({ lastSyncedAt: new Date().toLocaleTimeString() });
    return { success: true };
  } catch (err: any) {
    console.error('[CloudSync] Delete edit failed:', err);
    return { success: false, error: err?.message || 'Failed to delete from Firestore' };
  }
}
