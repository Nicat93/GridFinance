
import React, { useState, useEffect } from 'react';
import { SyncConfig, LanguageCode } from '../types';
import { translations } from '../translations';
import { logger, LogEntry } from '../services/logger';
import * as SupabaseService from '../services/supabaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  syncConfig: SyncConfig;
  syncAuthUserId: string | null;
  syncAuthEmail: string | null;
  syncAuthLoading: boolean;
  onSaveSyncConfig: (cfg: SyncConfig) => void;
  onClearData: () => void;
  onExportData: () => void;
  onImportData: (file: File) => void;
  onAddMockData: () => void;
  showDesignDebug?: boolean;
  onToggleDesignDebug?: () => void;
  onOpenCategoryManager: () => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

const SettingsModal: React.FC<Props> = ({ 
    isOpen, onClose, isDarkMode, onToggleTheme, syncConfig, syncAuthUserId, syncAuthEmail, syncAuthLoading, onSaveSyncConfig, onClearData,
    onExportData, onImportData, onAddMockData, showDesignDebug, onToggleDesignDebug, onOpenCategoryManager,
    language, onLanguageChange
}) => {
  const [syncId, setSyncId] = useState(syncConfig.syncId || '');
  const [enabled, setEnabled] = useState(syncConfig.enabled);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSyncId(syncConfig.syncId || '');
      setEnabled(syncConfig.enabled);
      // Subscribe to logger
      const unsubscribe = logger.subscribe((newLogs) => setLogs([...newLogs]));
      return unsubscribe;
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, syncConfig]);

  const handleSaveSync = () => {
      onSaveSyncConfig({
          supabaseUrl: syncConfig.supabaseUrl, 
          supabaseKey: syncConfig.supabaseKey, 
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
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isConfigured = !!(syncConfig.supabaseUrl && syncConfig.supabaseKey);
  const canSave = isConfigured && (!enabled || (syncId.trim().length > 0 && !!syncAuthUserId));

  const handleAuth = async (action: 'signIn' | 'signUp') => {
      setAuthBusy(true);
      setAuthMessage('');
      setAuthError(false);
      try {
          SupabaseService.initSupabase(syncConfig.supabaseUrl, syncConfig.supabaseKey);
          await SupabaseService[action](authEmail.trim(), authPassword);
          setAuthPassword('');
          setAuthMessage(action === 'signUp' ? 'Account created. Check your email if confirmation is required.' : 'Signed in.');
      } catch (error: any) {
          setAuthMessage(error?.message || 'Authentication failed.');
          setAuthError(true);
      } finally {
          setAuthBusy(false);
      }
  };

  const handleGoogleAuth = async () => {
      setAuthBusy(true);
      setAuthError(false);
      setAuthMessage('Redirecting to Google…');
      try {
          SupabaseService.initSupabase(syncConfig.supabaseUrl, syncConfig.supabaseKey);
          await SupabaseService.signInWithGoogle();
      } catch (error: any) {
          setAuthMessage(error?.message || 'Google sign-in failed.');
          setAuthError(true);
          setAuthBusy(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t.settings}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">✕</button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
            
            {/* General */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.general}</h3>
                
                <button 
                    onClick={onToggleTheme}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.theme}</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {isDarkMode ? 'Dark Mode 🌙' : 'Light Mode ☀️'}
                    </span>
                </button>

                <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.language}</span>
                    <select 
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                        className="bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none"
                    >
                        <option value="en">English</option>
                        <option value="az">Azərbaycan</option>
                        <option value="ru">Русский</option>
                        <option value="tr">Türkçe</option>
                    </select>
                </div>

                <button 
                    onClick={() => { onClose(); onOpenCategoryManager(); }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.manageCategories}</span>
                    <span className="text-gray-400 text-lg">›</span>
                </button>
            </div>

            {/* Local Backup */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.localBackup}</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={onExportData}
                        className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mb-1 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.download}</span>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mb-1 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.restore}</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json" 
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            {/* Cloud Sync */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cloud account</h3>
                {syncAuthLoading ? <p className="text-xs text-gray-500" role="status">Checking saved session…</p> : syncAuthUserId ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <span className="truncate" title={syncAuthEmail || syncAuthUserId}>Signed in as {syncAuthEmail || syncAuthUserId}</span>
                        <button disabled={authBusy} onClick={async () => { setAuthBusy(true); setAuthMessage(''); setAuthError(false); try { await SupabaseService.signOut(); setAuthMessage('Signed out.'); } catch (error: any) { setAuthMessage(error?.message || 'Sign out failed.'); setAuthError(true); } finally { setAuthBusy(false); } }} className="shrink-0 text-indigo-600 dark:text-indigo-400 disabled:opacity-50">Sign out</button>
                    </div>
                ) : <>
                    <input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-xs text-gray-800 dark:text-gray-200" />
                    <input type="password" autoComplete="current-password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-2 text-xs text-gray-800 dark:text-gray-200" />
                    <div className="grid grid-cols-2 gap-2">
                        <button disabled={!isConfigured || authBusy || !authEmail.trim() || !authPassword} onClick={() => handleAuth('signIn')} className="border border-gray-300 dark:border-gray-700 rounded py-2 text-xs disabled:opacity-50">Sign in</button>
                        <button disabled={!isConfigured || authBusy || !authEmail.trim() || !authPassword} onClick={() => handleAuth('signUp')} className="border border-gray-300 dark:border-gray-700 rounded py-2 text-xs disabled:opacity-50">Create account</button>
                    </div>
                    <button disabled={!isConfigured || authBusy} onClick={handleGoogleAuth} className="w-full border border-gray-300 dark:border-gray-700 rounded py-2 text-xs disabled:opacity-50">Continue with Google</button>
                </>}
                {authMessage && <p role={authError ? 'alert' : 'status'} className={`text-[10px] ${authError ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>{authMessage}</p>}
                <div className="flex justify-between items-end">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.cloudSync}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{t.enable}</span>
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
                            <label className="block text-[10px] text-gray-500 mb-1">Sync group ID (partition name, not a password) {enabled && '*'}</label>
                        <input 
                            type="text" 
                            value={syncId}
                            onChange={e => setSyncId(e.target.value)}
                            placeholder="e.g. my-family-budget-2024"
                            className={`w-full bg-gray-50 dark:bg-gray-900 border rounded p-2 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none font-mono ${enabled && !syncId.trim() ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                        />
                    </div>
                </div>
                <button 
                    onClick={handleSaveSync}
                    disabled={!canSave}
                    className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t.sync}
                </button>
            </div>

            {/* Debug & Danger Zone */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.debugDanger}</h3>

                {onToggleDesignDebug && (
                    <button
                        onClick={onToggleDesignDebug}
                        className="w-full border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 py-2 rounded text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                        {showDesignDebug ? t.hideDebug : t.showDebug}
                    </button>
                )}

                <button
                    onClick={onAddMockData}
                    className="w-full border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/10 py-2 rounded text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-900/30 transition-colors"
                >
                    {t.debugMock}
                </button>

                <button 
                    onClick={onClearData}
                    className="w-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 py-2 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                    {t.clearData}
                </button>

                {/* System Logs */}
                <div className="pt-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{t.systemLogs}</span>
                        <button onClick={() => logger.clear()} className="text-[10px] text-red-500 hover:underline">{t.clearLogs}</button>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] border border-gray-200 dark:border-gray-800">
                        {logs.length === 0 && <span className="text-gray-400 italic">{t.noLogs}</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-gray-200 dark:border-gray-800 pb-1 last:border-0 last:pb-0">
                                <span className="text-gray-400 mr-2 opacity-70">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={`${log.level === 'error' ? 'text-red-500 font-bold' : log.level === 'warn' ? 'text-orange-500 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {log.level.toUpperCase()}:
                                </span>
                                <span className="ml-1 text-gray-800 dark:text-gray-200 break-all leading-tight">
                                    {log.messages.join(' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
