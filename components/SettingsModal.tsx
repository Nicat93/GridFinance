
import React, { useState, useEffect } from 'react';
import { SyncConfig } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  syncConfig: SyncConfig;
  onSaveSyncConfig: (cfg: SyncConfig) => void;
  onClearData: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  installPromptAvailable?: boolean;
  onInstallApp?: () => void;
}

const SettingsModal: React.FC<Props> = ({ 
    isOpen, onClose, isDarkMode, onToggleTheme, syncConfig, onSaveSyncConfig, onClearData,
    onExportData, onImportData, installPromptAvailable, onInstallApp
}) => {
  const [syncId, setSyncId] = useState(syncConfig.syncId || '');
  const [enabled, setEnabled] = useState(syncConfig.enabled);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isOpen) {
          setSyncId(syncConfig.syncId || '');
          setEnabled(syncConfig.enabled);
      }
  }, [isOpen, syncConfig]);

  const handleSaveSync = () => {
      onSaveSyncConfig({
          supabaseUrl: syncConfig.supabaseUrl, // Persist existing values from env/storage
          supabaseKey: syncConfig.supabaseKey, // Persist existing values from env/storage
          syncId: syncId.trim(),
          enabled: enabled,
          lastSyncedAt: 0
      });
      onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onImportData(e.target.files[0]);
      }
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isConfigured = !!(syncConfig.supabaseUrl && syncConfig.supabaseKey);
  // Valid if backend is configured AND (sync is disabled OR (sync is enabled AND key is provided))
  const canSave = isConfigured && (!enabled || syncId.trim().length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Settings</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">✕</button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh]">
            
            {/* Install App (Only if prompt available) */}
            {installPromptAvailable && onInstallApp && (
                <div className="space-y-3">
                     <button 
                        onClick={onInstallApp}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-500 transition-colors font-bold"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Install App
                    </button>
                    <p className="text-[10px] text-center text-gray-400">Install to home screen for offline access and better performance.</p>
                </div>
            )}

            {/* Appearance */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Appearance</h3>
                <button 
                    onClick={onToggleTheme}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {isDarkMode ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
                    </span>
                </button>
            </div>

            {/* Local Backup */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Local Backup</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={onExportData}
                        className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mb-1 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Download</span>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mb-1 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Restore</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileChange}
                    />
                </div>
                <p className="text-[9px] text-gray-400 leading-tight">
                    Download a JSON file to save to Google Drive or iCloud. Restoring will overwrite current data.
                </p>
            </div>

            {/* Cloud Sync */}
            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Supabase Sync</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">Enable</span>
                        <input 
                            type="checkbox" 
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            className="toggle-checkbox"
                            disabled={!isConfigured}
                        />
                    </div>
                </div>
                
                <div className={`space-y-3 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50'}`}>
                    
                    <div className={enabled ? '' : 'pointer-events-none'}>
                        <label className="block text-[10px] text-gray-500 mb-1">Secret Key {enabled && '*'}</label>
                        <input 
                            type="text" 
                            value={syncId}
                            onChange={e => setSyncId(e.target.value)}
                            placeholder="e.g. my-family-budget-2024"
                            className={`w-full bg-gray-50 dark:bg-gray-900 border rounded p-2 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none font-mono ${enabled && !syncId.trim() ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                        />
                        <p className="text-[9px] text-gray-400 mt-1">Unique key to identify and sync this device's data.</p>
                    </div>
                    
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900/30">
                        <p className="text-[9px] text-blue-600 dark:text-blue-300 leading-tight">
                            Use the same Secret Key on all devices you want to keep in sync.
                        </p>
                    </div>
                </div>
                <button 
                    onClick={handleSaveSync}
                    disabled={!canSave}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Sync
                </button>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <button 
                    onClick={onClearData}
                    className="w-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 py-2 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    Clear All Local Data
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
