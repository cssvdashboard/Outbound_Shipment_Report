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
  Lock,
  Unlock,
  Trash2,
  HelpCircle,
  Server
} from 'lucide-react';
import {
  FirebaseConfig,
  CloudSyncStatus,
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  testFirebaseConnection,
  initFirebase,
  getSavedTeamPin,
  saveTeamPin
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

  const [teamPin, setTeamPin] = useState('');
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

    getSavedTeamPin().then((pin) => {
      setTeamPin(pin || '');
    });

    setTestResult(null);
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-parse if user pastes raw JS/JSON firebaseConfig
  const handleJsonPaste = (text: string) => {
    setJsonConfigInput(text);
    try {
      // Clean JS variable assignments if user pasted `const firebaseConfig = { ... }`
      const jsonStr = text
        .replace(/const\s+firebaseConfig\s*=\s*/, '')
        .replace(/;/g, '')
        .trim();

      // Extract properties via regex or JSON.parse
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
    await saveTeamPin(teamPin.trim());
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
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl relative bg-slate-950 border border-slate-700 p-5 sm:p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-black text-white">
                  Cloud Database &amp; Collaboration
                </h3>
                {status.state === 'connected' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Online
                  </span>
                ) : status.state === 'connecting' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    Local Cache Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Connect Google Firebase Firestore so team edits and spreadsheet updates synchronize live for all users on GitHub Pages.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          
          {/* Active Status Overview Card */}
          {status.state === 'connected' && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">
                    Connected to Project: <span className="font-mono text-emerald-300">{status.projectId}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {status.totalSyncedEdits} active collaborative overrides synced • Last heartbeat: {status.lastSyncedAt || 'Just now'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          )}

          {/* Setup Guide Toggle */}
          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center justify-between w-full text-left font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                Need help getting your Firebase credentials? (3 easy steps)
              </span>
              <span className="text-[11px] text-slate-400">{showGuide ? 'Hide Guide ▲' : 'Show Guide ▼'}</span>
            </button>

            {showGuide && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-slate-300 text-xs">
                <p>1. Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-sky-400 underline font-semibold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a> and click <strong>Create a project</strong>.</p>
                <p>2. In your project menu, click <strong>Firestore Database</strong> → <strong>Create database</strong> → Choose <strong>Start in test mode</strong>.</p>
                <p>3. Go to <strong>Project Settings (gear icon)</strong> → <strong>General</strong> → Scroll down to <strong>Your apps</strong> → Click the <strong>Web (&lt;/&gt;)</strong> icon → Copy the <code>firebaseConfig</code> code snippet and paste it in the box below!</p>
              </div>
            )}
          </div>

          {/* Quick Paste JSON / Config Snippet */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Quick Paste (Full firebaseConfig snippet)</span>
              <span className="text-[11px] text-slate-500 font-normal">Auto-populates fields below</span>
            </label>
            <textarea
              rows={3}
              value={jsonConfigInput}
              onChange={(e) => handleJsonPaste(e.target.value)}
              placeholder="Paste `const firebaseConfig = { apiKey: '...', projectId: '...' };` here..."
              className="w-full p-2.5 text-xs font-mono rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Individual Configuration Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">
                API Key <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">
                Project ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="my-logistics-app-123"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">
                App ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1:123456789:web:abcdef..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">
                Auth Domain <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={authDomain}
                onChange={(e) => setAuthDomain(e.target.value)}
                placeholder="my-project.firebaseapp.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Optional Team PIN */}
          <div className="pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Optional Team Edit PIN</span>
              <span className="text-[11px] text-slate-500 font-normal">— Leave blank for open editing</span>
            </label>
            <input
              type="password"
              value={teamPin}
              onChange={(e) => setTeamPin(e.target.value)}
              placeholder="e.g. 1234 (Protects shipment edits and uploads)"
              className="w-full sm:w-64 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
          </div>

          {/* Diagnostic Test Result Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>
                {testResult.success
                  ? 'Connection Successful! Firebase Firestore is online and ready for collaborative syncing.'
                  : `Connection Failed: ${testResult.error || 'Please check your API key and permissions.'}`}
              </span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey || !projectId}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 text-sky-400" />}
            <span>Test Connection</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={isTesting || !apiKey || !projectId}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition-all disabled:opacity-40 cursor-pointer"
            >
              Save &amp; Connect Online
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
