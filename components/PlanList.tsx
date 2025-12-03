
import React, { useState, useMemo } from 'react';
import { RecurringPlan, Frequency } from '../types';

interface Props {
  plans: RecurringPlan[];
  onDelete: (id: string) => void;
  onApplyNow: (planId: string) => void;
  onEdit: (plan: RecurringPlan) => void;
}

// --- Date Helpers ---
const parseLocalDate = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const addTimeLocal = (date: string | Date, freq: Frequency, count: number): Date => {
    let d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    if (isNaN(d.getTime())) d = new Date();
    const startDay = d.getDate();
    if (freq === Frequency.ONE_TIME) return d;
    if (freq === Frequency.WEEKLY) d.setDate(d.getDate() + (7 * count));
    if (freq === Frequency.MONTHLY) { d.setMonth(d.getMonth() + count); if (d.getDate() !== startDay) d.setDate(0); }
    if (freq === Frequency.YEARLY) { d.setFullYear(d.getFullYear() + count); if (d.getDate() !== startDay) d.setDate(0); }
    return d;
};

// --- Component ---
const PlanList: React.FC<Props> = ({ plans, onDelete, onApplyNow, onEdit }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sorting: Active plans first, then by date, then by lastModified (stability)
  const sortedPlans = useMemo(() => {
      return [...plans].sort((a, b) => {
          const isMaxedA = a.maxOccurrences && a.occurrencesGenerated >= a.maxOccurrences;
          const isMaxedB = b.maxOccurrences && b.occurrencesGenerated >= b.maxOccurrences;
          
          if (isMaxedA && !isMaxedB) return 1;
          if (!isMaxedA && isMaxedB) return -1;
          
          const dateA = addTimeLocal(a.startDate, a.frequency, a.occurrencesGenerated);
          const dateB = addTimeLocal(b.startDate, b.frequency, b.occurrencesGenerated);
          
          const dateDiff = dateA.getTime() - dateB.getTime();
          if (dateDiff !== 0) return dateDiff;

          // Secondary stable sort
          return (b.lastModified || 0) - (a.lastModified || 0);
      });
  }, [plans]);

  if (plans.length === 0) return null;
  const today = new Date(); today.setHours(0,0,0,0);

  // --- Handlers ---
  const handleDeleteClick = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id); };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null); };
  const handleCancelDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); };
  const handleApply = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onApplyNow(id); };
  const handleEdit = (e: React.MouseEvent, plan: RecurringPlan) => { e.preventDefault(); e.stopPropagation(); onEdit(plan); };
  const toggleRow = (id: string) => { setExpandedId(prev => prev === id ? null : id); setConfirmDeleteId(null); };

  const formatShortDate = (date: Date) => {
      return `${date.getMonth() + 1}-${date.getDate()}`;
  };

  return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-sm w-full bg-white dark:bg-gray-950 transition-colors">
        <div className="w-full text-left text-xs border-collapse">
            
            {/* --- Header --- */}
            <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                <div className="py-1 px-1.5 border-b border-gray-200 dark:border-gray-800 font-medium flex-1">Details</div>
                <div className="py-1 px-1.5 border-b border-gray-200 dark:border-gray-800 font-medium text-right w-[100px] sm:w-32">Amount</div>
            </div>

            {/* --- Body --- */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {sortedPlans.map(plan => {
                    const isExpanded = expandedId === plan.id;
                    const isDeleting = confirmDeleteId === plan.id;
                    const nextDate = addTimeLocal(plan.startDate, plan.frequency, plan.occurrencesGenerated);
                    nextDate.setHours(0,0,0,0);
                    const isFuture = nextDate > today;
                    const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;
                    const canApply = !isMaxed;

                    return (
                        <div key={plan.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            
                            {/* Main Row */}
                            <div 
                                className={`flex items-start cursor-pointer py-1.5 ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/40' : ''}`} 
                                onClick={() => toggleRow(plan.id)}
                            >
                                {/* Left: Indicator & Description */}
                                <div className="px-1.5 flex-1 min-w-0 flex items-start gap-2">
                                    <div className={`w-1 h-3.5 mt-0.5 rounded-sm shrink-0 ${plan.type === 'income' ? 'bg-emerald-600 dark:bg-emerald-800' : 'bg-rose-600 dark:bg-rose-800'}`}></div>
                                    <div className={`text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}>
                                        {plan.description}
                                        {plan.isInstallment && <span className="ml-1 text-[9px] text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-900/20 px-1 rounded align-middle">LOAN</span>}
                                    </div>
                                </div>

                                {/* Right: Amount & Metadata */}
                                <div className="px-1.5 text-right w-[100px] sm:w-32 shrink-0 flex flex-col items-end gap-0.5">
                                    <div className={`text-[11px] sm:text-sm tracking-tighter ${plan.type === 'income' ? 'text-emerald-600 dark:text-emerald-400/80' : 'text-rose-600 dark:text-rose-400/80'}`}>
                                        {plan.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 justify-end truncate w-full">
                                        <span className="truncate max-w-[60px]">{plan.category}</span>
                                        <span className="opacity-50">•</span>
                                        <span className={isFuture ? '' : 'text-indigo-500 dark:text-indigo-400 font-bold'}>{formatShortDate(nextDate)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details Panel */}
                            {isExpanded && (
                                <div 
                                    className="bg-gray-50 dark:bg-gray-900/50 px-2 pb-2 text-[11px] text-gray-500 flex flex-col gap-2 cursor-default" 
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    
                                    {/* Additional Info (Progress) */}
                                    {plan.maxOccurrences && plan.frequency !== Frequency.ONE_TIME && (
                                        <div className="flex items-center gap-2 text-[9px] sm:text-[10px] mt-1">
                                            <span>Progress: {plan.occurrencesGenerated} / {plan.maxOccurrences}</span>
                                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden">
                                                <div className="h-full bg-indigo-600" style={{ width: `${Math.min((plan.occurrencesGenerated / plan.maxOccurrences) * 100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-800/50 mt-1 relative z-10">
                                        {isDeleting ? (
                                            <>
                                                <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400 font-bold uppercase">Sure?</div>
                                                <button onClick={(e) => handleConfirmDelete(e, plan.id)} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-1.5 rounded text-xs">Yes</button>
                                                <button onClick={handleCancelDelete} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded text-xs">No</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={(e) => handleApply(e, plan.id)} disabled={!canApply} className={`flex-1 py-1.5 rounded text-xs font-bold ${canApply ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}>{isMaxed ? 'Completed' : 'Apply Now'}</button>
                                                <button onClick={(e) => handleEdit(e, plan)} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 rounded text-xs">Edit</button>
                                                <button onClick={(e) => handleDeleteClick(e, plan.id)} className="px-4 bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 py-1.5 rounded text-xs">Del</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
  );
};
export default PlanList;
