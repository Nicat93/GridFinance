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

  // Sorting: Active plans first, then by date
  const sortedPlans = useMemo(() => {
      return [...plans].sort((a, b) => {
          const isMaxedA = a.maxOccurrences && a.occurrencesGenerated >= a.maxOccurrences;
          const isMaxedB = b.maxOccurrences && b.occurrencesGenerated >= b.maxOccurrences;
          
          if (isMaxedA && !isMaxedB) return 1;
          if (!isMaxedA && isMaxedB) return -1;
          
          const dateA = addTimeLocal(a.startDate, a.frequency, a.occurrencesGenerated);
          const dateB = addTimeLocal(b.startDate, b.frequency, b.occurrencesGenerated);
          return dateA.getTime() - dateB.getTime();
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

  return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-sm w-full bg-white dark:bg-gray-950 transition-colors">
        <div className="w-full text-left text-xs border-collapse">
            
            {/* --- Header --- */}
            <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                <div className="py-1 px-1.5 border-b border-gray-200 dark:border-gray-800 font-medium flex-1">Desc</div>
                <div className="py-1 px-1.5 border-b border-gray-200 dark:border-gray-800 font-medium text-right w-[85px] sm:w-28">Amt</div>
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
                            <div className="flex items-center cursor-pointer py-1" onClick={() => toggleRow(plan.id)}>
                                <div className="px-1.5 flex-1 min-w-0 flex items-center gap-2">
                                    <div className={`w-1 h-4 rounded-sm ${plan.type === 'income' ? 'bg-emerald-600 dark:bg-emerald-800' : 'bg-rose-600 dark:bg-rose-800'}`}></div>
                                    <div className="text-gray-700 dark:text-gray-300 font-medium truncate text-xs sm:text-sm">{plan.description}</div>
                                    {plan.isInstallment && <span className="text-[9px] text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-900/20 px-1 rounded">LOAN</span>}
                                </div>
                                <div className={`px-1.5 text-right w-[85px] sm:w-28 whitespace-nowrap text-[11px] sm:text-sm tracking-tighter ${plan.type === 'income' ? 'text-emerald-600 dark:text-emerald-400/80' : 'text-rose-600 dark:text-rose-400/80'}`}>
                                    {plan.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>

                            {/* Expanded Details Panel */}
                            {isExpanded && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 px-2 py-2 text-[11px] text-gray-500 border-t border-gray-100 dark:border-gray-800/50 flex flex-col gap-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex justify-between items-center">
                                        <span>Due: <span className={isFuture ? 'text-indigo-600 dark:text-indigo-300' : 'text-emerald-600 dark:text-emerald-300'}>{nextDate.toLocaleDateString()}</span></span>
                                        <span className="uppercase text-[9px] border border-gray-300 dark:border-gray-700 rounded px-1">{plan.frequency}</span>
                                    </div>
                                    
                                    {/* Progress Bar for Loans */}
                                    {plan.maxOccurrences && (
                                        <div className="flex items-center gap-2 text-[9px] sm:text-[10px]">
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