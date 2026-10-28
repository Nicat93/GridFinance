
import React, { useRef } from 'react';
import { FinancialSnapshot, SyncStatus, LanguageCode } from '../types';
import { translations } from '../translations';
import { formatExpenseAmount, formatMoney, getCycleSwipeDirection } from '../services/presentation';

interface Props {
  snapshot: FinancialSnapshot;
  onUpdateDate: (date: Date) => void;
  onSwipeCycle: (direction: 'previous' | 'next') => void;
  syncStatus: SyncStatus;
  language: LanguageCode;
}

const SummaryBar: React.FC<Props> = ({ snapshot, onUpdateDate, onSwipeCycle, syncStatus, language }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const t = translations[language];

  const hasProjectedRange = snapshot.projectedBalanceMin !== undefined && snapshot.projectedBalanceMax !== undefined && snapshot.projectedBalanceMin !== snapshot.projectedBalanceMax;
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

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const direction = getCycleSwipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (direction) onSwipeCycle(direction);
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
      <div className="max-w-4xl mx-auto flex items-center justify-between relative touch-pan-y" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        
        {/* Current */}
        <div className="flex flex-col shrink-0 min-w-0 max-w-[35%]">
            <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-500 uppercase tracking-widest font-bold truncate">{t.current}</span>
            <span className={`max-w-full text-[clamp(9px,3.5vw,20px)] sm:text-xl font-mono font-bold leading-tight tracking-tight break-all ${snapshot.currentBalance >= 0 ? 'text-gray-900 dark:text-gray-200' : 'text-rose-600 dark:text-rose-500'}`}>
                {formatMoney(snapshot.currentBalance)}
            </span>
        </div>

        {/* Separator / Cycle Info */}
        <div className="flex-1 px-1 sm:px-4 flex flex-col items-center justify-center min-w-0">
            <div className="flex items-center gap-0.5 max-w-full">
                <button
                    type="button"
                    onClick={() => onSwipeCycle('previous')}
                    aria-label={t.previousCycle}
                    className="shrink-0 px-1.5 py-1 text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
                >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div
                    className="relative group cursor-pointer flex flex-col items-center min-w-0"
                    onClick={handleContainerClick}
                >
                    {/* Visual Label */}
                    <div
                        className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 bg-gray-100 dark:bg-gray-900/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-900 border border-gray-200 dark:border-gray-800/50 group-hover:border-gray-300 dark:group-hover:border-gray-700 px-2 py-0.5 rounded transition-all truncate max-w-full text-center whitespace-nowrap"
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
                <button
                    type="button"
                    onClick={() => onSwipeCycle('next')}
                    aria-label={t.nextCycle}
                    className="shrink-0 px-1.5 py-1 text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 rounded"
                >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
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
            <span className={`max-w-full text-[clamp(9px,3.5vw,20px)] sm:text-xl font-mono font-bold leading-tight tracking-tight text-right ${snapshot.projectedBalance >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-500 dark:text-rose-400'}`}>
                {hasProjectedRange ? (
                    <span className="flex flex-wrap justify-end gap-x-1">
                        <span className="whitespace-nowrap">{formatMoney(snapshot.projectedBalanceMin!)}</span>
                        <span aria-hidden="true">–</span>
                        <span className="whitespace-nowrap">{formatMoney(snapshot.projectedBalanceMax!)}</span>
                    </span>
                ) : <span className="break-all">{formatMoney(snapshot.projectedBalance)}</span>}
            </span>
        </div>

      </div>
      
      {/* Mini Stats Line */}
      <div className="max-w-4xl mx-auto flex justify-between mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-gray-200 dark:border-gray-900 text-[9px] sm:text-xs font-mono text-gray-500 dark:text-gray-600">
         <span>{t.inc}: <span className="text-emerald-600 dark:text-emerald-500">+{formatMoney(snapshot.upcomingIncome)}</span></span>
         <span>{t.exp}: <span className="text-rose-600 dark:text-rose-500">{formatExpenseAmount(snapshot.upcomingExpenses, snapshot.upcomingExpensesMax)}</span></span>
      </div>
    </div>
  );
};

export default SummaryBar;
