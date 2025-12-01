import React from 'react';
import { FinancialSnapshot, SyncStatus } from '../types';

interface Props {
  snapshot: FinancialSnapshot;
  onUpdateDate: (date: Date) => void;
  syncStatus: SyncStatus;
}

const SummaryBar: React.FC<Props> = ({ snapshot, onUpdateDate, syncStatus }) => {
  const formatMoney = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  
  const toInputDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseInputDate = (s: string) => {
    const parts = s.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) return;
      const d = parseInputDate(val);
      if (!isNaN(d.getTime())) {
          onUpdateDate(d);
      }
  };

  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-4 py-3 shadow-lg transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between relative">
        
        {/* Current */}
        <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-widest font-bold">Current</span>
            <span className={`text-xl font-mono font-bold leading-none ${snapshot.currentBalance >= 0 ? 'text-gray-900 dark:text-gray-200' : 'text-rose-600 dark:text-rose-500'}`}>
                {formatMoney(snapshot.currentBalance)}
            </span>
        </div>

        {/* Separator / Cycle Info */}
        <div className="flex-1 px-4 flex flex-col items-center justify-center">
            <div className="relative group cursor-pointer flex flex-col items-center">
                {/* Visual Label */}
                <div 
                    className="text-[10px] text-gray-500 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 bg-gray-100 dark:bg-gray-900/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-900 border border-gray-200 dark:border-gray-800/50 group-hover:border-gray-300 dark:group-hover:border-gray-700 px-3 py-0.5 rounded transition-all mb-1 truncate max-w-[140px] text-center"
                >
                    {formatDate(snapshot.periodStart)} — {formatDate(snapshot.periodEnd)}
                </div>

                {/* Sync Dot */}
                {syncStatus !== 'offline' && (
                    <div className="flex items-center gap-1.5 absolute -top-1.5 -right-6" title={`Sync Status: ${syncStatus}`}>
                         <div className={`w-2 h-2 rounded-full ${
                             syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 
                             syncStatus === 'syncing' ? 'bg-indigo-500 animate-pulse' : 
                             'bg-rose-500'
                         }`}></div>
                         {syncStatus === 'synced' && <span className="text-[9px] text-gray-400 dark:text-gray-600 font-bold hidden sm:block">SYNCED</span>}
                    </div>
                )}
                
                <input 
                    type="date" 
                    value={toInputDate(snapshot.periodStart)}
                    onChange={handleDateChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
            
            <div className="flex items-center w-full opacity-30">
                 <div className="h-px bg-gray-300 dark:bg-gray-700 w-full"></div>
                 <span className="text-gray-400 dark:text-gray-500 text-xs px-1">→</span>
                 <div className="h-px bg-gray-300 dark:bg-gray-700 w-full"></div>
            </div>
        </div>

        {/* Projected */}
        <div className="flex flex-col items-end">
            <span className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-widest font-bold">End Period</span>
            <span className={`text-xl font-mono font-bold leading-none ${snapshot.projectedBalance >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-500 dark:text-rose-400'}`}>
                {formatMoney(snapshot.projectedBalance)}
            </span>
        </div>

      </div>
      
      {/* Mini Stats Line */}
      <div className="max-w-4xl mx-auto flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-900 text-xs font-mono text-gray-500 dark:text-gray-600">
         <span>Inc: <span className="text-emerald-600 dark:text-emerald-500">+{formatMoney(snapshot.upcomingIncome)}</span></span>
         <span>Exp: <span className="text-rose-600 dark:text-rose-500">-{formatMoney(snapshot.upcomingExpenses)}</span></span>
      </div>
    </div>
  );
};

export default SummaryBar;