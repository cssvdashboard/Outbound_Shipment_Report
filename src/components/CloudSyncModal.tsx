import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  Database,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  RefreshCw,
  ExternalLink,
  Trash2,
  HelpCircle,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  FirebaseConfig,
  CloudSyncStatus,
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  testFirebaseConnection,
  initFirebase
} from '../services/firebase';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CloudSyncStatus;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  status
}) => {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [appId, setAppId] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [jsonConfigInput, setJsonConfigInput] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Load existing saved configuration on open
  useEffect(() => {
    if (!isOpen) return;

    getSavedFirebaseConfig().then((cfg) => {
      if (cfg) {
        setApiKey(cfg.apiKey || '');
        setProjectId(cfg.projectId || '');
        setAppId(cfg.appId || '');
        setAuthDomain(cfg.authDomain || '');
        setStorageBucket(cfg.storageBucket || '');
        setMessagingSenderId(cfg.messagingSenderId || '');
      }
    });

    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-parse if user pastes raw JS/JSON firebaseConfig
  const handleJsonPaste = (text: string) => {
    setJsonConfigInput(text);
    try {
      const jsonStr = text
        .replace(/const\s+firebaseConfig\s*=\s*/, '')
        .replace(/;/g, '')
        .trim();

      const extractField = (fieldName: string): string => {
        const regex = new RegExp(`["']?${fieldName}["']?\\s*:\\s*["']([^"']+)["']`);
        const match = jsonStr.match(regex);
        return match ? match[1] : '';
      };

      const extractedKey = extractField('apiKey');
      const extractedProj = extractField('projectId');
      const extractedApp = extractField('appId');
      const extractedAuth = extractField('authDomain');
      const extractedStorage = extractField('storageBucket');
      const extractedSender = extractField('messagingSenderId');

      if (extractedKey) setApiKey(extractedKey);
      if (extractedProj) setProjectId(extractedProj);
      if (extractedApp) setAppId(extractedApp);
      if (extractedAuth) setAuthDomain(extractedAuth);
      if (extractedStorage) setStorageBucket(extractedStorage);
      if (extractedSender) setMessagingSenderId(extractedSender);

      if (extractedKey && extractedProj) {
        setTestResult(null);
      }
    } catch {
      // Ignore parse failure, user can fill manually
    }
  };

  const getEffectiveConfig = (): FirebaseConfig | null => {
    if (!apiKey.trim() || !projectId.trim() || !appId.trim()) return null;
    return {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      appId: appId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
      messagingSenderId: messagingSenderId.trim() || undefined
    };
  };

  const handleTestConnection = async () => {
    const config = getEffectiveConfig();
    if (!config) {
      setTestResult({ success: false, error: 'Please enter API Key, Project ID, and App ID.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const res = await testFirebaseConnection(config);
    setIsTesting(false);
    setTestResult(res);
  };

  const handleSaveAndConnect = async () => {
    const config = getEffectiveConfig();
    if (!config) {
      setTestResult({ success: false, error: 'Please enter API Key, Project ID, and App ID.' });
      return;
    }

    setIsTesting(true);
    await saveFirebaseConfig(config);
    await initFirebase(config);
    setIsTesting(false);
    onClose();
  };

  const handleDisconnect = async () => {
    await clearFirebaseConfig();
    setApiKey('');
    setProjectId('');
    setAppId('');
    setAuthDomain('');
    setStorageBucket('');
    setMessagingSenderId('');
    setJsonConfigInput('');
    setTestResult(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl relative bg-slate-900 border border-slate-700 p-5 sm:p-6 overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Cloud Database &amp; Collaboration
                </h3>
                {status.state === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Online
                  </span>
                ) : status.state === 'connecting' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-400 border border-slate-600">
                    Offline / Local Storage
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sync delay reasons and remarks in real time across all team members' browsers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* Status Banner */}
          {status.state === 'connected' && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Connected to project <strong className="text-emerald-200">{status.projectId}</strong>.
                  {status.totalSyncedEdits > 0 && ` (${status.totalSyncedEdits} shared edit${status.totalSyncedEdits === 1 ? '' : 's'} live)`}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          )}

          {status.state === 'error' && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>Connection Error:</strong> {status.errorMessage || 'Failed to connect to Firebase.'}
              </div>
            </div>
          )}

          {/* Quick Paste Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Quick Paste (Firebase Web SDK Config)</span>
              <span className="text-[11px] text-slate-400">Pastes &amp; auto-fills all fields</span>
            </label>
            <textarea
              value={jsonConfigInput}
              onChange={(e) => handleJsonPaste(e.target.value)}
              placeholder="Paste `const firebaseConfig = { ... }` or JSON from Firebase Console here..."
              rows={3}
              className="w-full text-xs font-mono bg-slate-950/70 border border-slate-700 rounded-xl p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Individual Config Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                API Key <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full font-mono bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Project ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="outbound-shipment-..."
                className="w-full font-mono bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                App ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456789:web:..."
                className="w-full font-mono bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Auth Domain (Optional)
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="project-id.firebaseapp.com"
                className="w-full font-mono bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Connection successful! Firestore collection `shipment_edits` is reachable.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Connection failed: {testResult.error}</span>
                </>
              )}
            </div>
          )}

          {/* Expandable Step-by-Step Setup Guide */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                How to set up a free Firebase project (3-minute guide)
              </span>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showGuide && (
              <div className="p-4 pt-1 border-t border-slate-800 text-xs text-slate-300 space-y-2.5">
                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.firebase.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 underline inline-flex items-center gap-1 font-semibold"
                    >
                      console.firebase.google.com <ExternalLink className="w-3 h-3 inline" />
                    </a>{' '}
                    and click <strong>Add project</strong>.
                  </li>
                  <li>Enter a name (e.g. <code>outbound-shipment-report</code>) and finish the wizard (Google Analytics can be disabled).</li>
                  <li>
                    In the left menu under <strong>Build</strong>, click <strong>Firestore Database</strong> &rarr; click <strong>Create database</strong>.
                  </li>
                  <li>Choose your location (e.g. <code>asia-south1</code> or nearest) &rarr; Select <strong>Start in test mode</strong> (or allow read/write in Rules).</li>
                  <li>
                    In Project Overview (click the gear icon ⚙️ &rarr; <strong>Project settings</strong>), scroll down to <strong>Your apps</strong> and click the <strong>Web (&lt;/&gt;)</strong> icon.
                  </li>
                  <li>Register the app, copy the <code>firebaseConfig</code> snippet, and paste it into the quick paste box above!</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isTesting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Test Connection
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={isTesting || !apiKey || !projectId}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Cloud className="w-3.5 h-3.5" />
              Save &amp; Connect Live
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
