
import React, { useRef } from 'react';
import { FinancialSnapshot, SyncStatus, LanguageCode } from '../types';
import { translations } from '../translations';

interface Props {
  snapshot: FinancialSnapshot;
  onUpdateDate: (date: Date) => void;
  syncStatus: SyncStatus;
  language: LanguageCode;
}

const SummaryBar: React.FC<Props> = ({ snapshot, onUpdateDate, syncStatus, language }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  const formatMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  const handleContainerClick = () => {
    try {
        const input = dateInputRef.current;
        if (!input) return;

        // Explicitly open the picker (works in Chrome/Edge/Firefox/Safari 16+)
        // We use a local variable 'input' so TypeScript can correctly narrow the type
        if (typeof (input as any).showPicker === 'function') {
            (input as any).showPicker();
        } else {
             input.focus();
        }
    } catch (e) {
        console.warn("Could not open date picker:", e);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] shadow-lg transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between relative">
        
        {/* Current */}
        <div className="flex flex-col shrink-0 min-w-0 max-w-[35%]">
            <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest font-bold truncate">{t.current}</span>
            <span className={`text-xs xs:text-[13px] sm:text-xl font-mono font-bold leading-none tracking-tighter truncate ${snapshot.currentBalance >= 0 ? 'text-gray-900 dark:text-gray-200' : 'text-rose-600 dark:text-rose-500'}`}>
                {formatMoney(snapshot.currentBalance)}
            </span>
        </div>

        {/* Separator / Cycle Info */}
        <div className="flex-1 px-1 sm:px-4 flex flex-col items-center justify-center min-w-0">
            <div 
                className="relative group cursor-pointer flex flex-col items-center max-w-full"
                onClick={handleContainerClick}
            >
                {/* Visual Label */}
                <div 
                    className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 bg-gray-100 dark:bg-gray-900/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-900 border border-gray-200 dark:border-gray-800/50 group-hover:border-gray-300 dark:group-hover:border-gray-700 px-2 py-0.5 rounded transition-all mb-1 truncate max-w-[100px] sm:max-w-[140px] text-center"
                >
                    {formatDate(snapshot.periodStart)} — {formatDate(snapshot.periodEnd)}
                </div>

                {/* 
                   Hidden Date Input
                   - pointer-events-none ensures the click goes to the parent DIV which calls showPicker() 
                   - opacity-0 keeps it invisible but accessible via refs
                */}
                <input 
                    ref={dateInputRef}
                    type="date" 
                    value={toInputDate(snapshot.periodStart)}
                    onChange={handleDateChange}
                    className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                    tabIndex={-1}
                />
            </div>
            
            <div className="flex items-center w-full opacity-30">
                 <div className="h-px bg-gray-300 dark:bg-gray-700 w-full"></div>
                 <span className="text-gray-400 dark:text-gray-500 text-[10px] px-1">→</span>
                 <div className="h-px bg-gray-300 dark:bg-gray-700 w-full"></div>
            </div>
        </div>

        {/* Projected */}
        <div className="flex flex-col items-end shrink-0 min-w-0 max-w-[35%]">
            <span className="text-[9px] sm:text-[10px] text-indigo-500 dark:text-indigo-400 uppercase tracking-widest font-bold truncate">{t.endPeriod}</span>
            <span className={`text-xs xs:text-[13px] sm:text-xl font-mono font-bold leading-none tracking-tighter truncate ${snapshot.projectedBalance >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-500 dark:text-rose-400'}`}>
                {formatMoney(snapshot.projectedBalance)}
            </span>
        </div>

      </div>
      
      {/* Mini Stats Line */}
      <div className="max-w-4xl mx-auto flex justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-gray-200 dark:border-gray-900 text-[9px] sm:text-xs font-mono text-gray-500 dark:text-gray-600">
         <span>{t.inc}: <span className="text-emerald-600 dark:text-emerald-500">+{formatMoney(snapshot.upcomingIncome)}</span></span>
         <span>{t.exp}: <span className="text-rose-600 dark:text-rose-500">-{formatMoney(snapshot.upcomingExpenses)}</span></span>
      </div>
    </div>
  );
};

export default SummaryBar;