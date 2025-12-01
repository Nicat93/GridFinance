import React, { useState, useEffect } from 'react';
import { BackupData } from '../types';
import * as BackupService from '../services/backupService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dataToBackup: BackupData;
  onImport: (data: BackupData) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, dataToBackup, onImport }) => {
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem('native_auto_backup') === 'true');
  const [statusMsg, setStatusMsg] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    localStorage.setItem('native_auto_backup', String(autoBackup));
  }, [autoBackup]);

  // Handle Native Share (GDrive, WhatsApp, etc)
  const handleShare = async () => {
    setIsBusy(true);
    setStatusMsg("Preparing share...");
    try {
        await BackupService.shareBackup(dataToBackup);
        setStatusMsg("Share menu opened.");
    } catch (e) {
        setStatusMsg("Share failed. " + e);
    } finally {
        setIsBusy(false);
    }
  };

  // Force Save to Documents
  const handleForceSave = async () => {
    setIsBusy(true);
    try {
        const path = await BackupService.saveToDevice(dataToBackup);
        setStatusMsg(`Success: ${path}`);
    } catch (e) {
        setStatusMsg("Save failed. Check Permissions.");
    } finally {
        setIsBusy(false);
    }
  };

  // Restore from Documents
  const handleRestore = async () => {
    if (!window.confirm("This will overwrite your current data with the backup found in Documents/GridFinance. Continue?")) return;
    setIsBusy(true);
    try {
        const data = await BackupService.loadFromDevice();
        onImport(data);
        setStatusMsg("Restored successfully.");
        onClose();
    } catch (e) {
        setStatusMsg("Restore failed: " + e);
    } finally {
        setIsBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-6">
        
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-200">Data Management</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Auto Backup Toggle */}
        <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
             <label className="flex items-center gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={autoBackup} 
                    onChange={(e) => setAutoBackup(e.target.checked)}
                    className="w-5 h-5 rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-0"
                />
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-200">Auto-Backup to Device</span>
                    <span className="text-xs text-gray-500">
                        Automatically saves <span className="font-mono">GridFinance/backup.json</span> to your Documents folder on change.
                    </span>
                </div>
            </label>
        </div>

        {/* Manual Actions */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-1">Manual Actions</h3>
            
            <button 
                onClick={handleShare}
                disabled={isBusy}
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-indigo-100 py-3 rounded text-sm font-medium border border-indigo-700/50 transition-colors flex items-center justify-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share / Save to Drive
            </button>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={handleForceSave}
                    disabled={isBusy}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-xs transition-colors border border-gray-700"
                >
                    Force Save Local
                </button>
                <button 
                    onClick={handleRestore}
                    disabled={isBusy}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded text-xs transition-colors border border-gray-700"
                >
                    Restore Local
                </button>
            </div>
        </div>

        <div className="text-[10px] text-gray-600 leading-tight">
            <strong>Note:</strong> On Android, "Auto-Backup" requires Storage Permissions. The file is saved to your public Documents folder so you can access it anytime.
        </div>

        {/* Status Message */}
        {statusMsg && (
            <div className="text-xs text-center text-indigo-400 font-mono pt-2 border-t border-gray-900">
                {statusMsg}
            </div>
        )}

      </div>
    </div>
  );
};

export default SettingsModal;