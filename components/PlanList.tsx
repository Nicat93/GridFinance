import React, { useState, useMemo } from 'react';
import { RecurringPlan, Frequency } from '../types';

interface Props {
  plans: RecurringPlan[];
  onDelete: (id: string) => void;
  onApplyNow: (planId: string) => void;
  onEdit: (plan: RecurringPlan) => void;
}

// Helper to handle YYYY-MM-DD string as local date without timezone offset issues
const parseLocalDate = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const addTimeLocal = (date: string | Date, freq: Frequency, count: number): Date => {
    let d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    if (isNaN(d.getTime())) d = new Date();
    
    const startDay = d.getDate();

    if (freq === Frequency.ONE_TIME) {
        return d;
    }

    if (freq === Frequency.WEEKLY) {
        d.setDate(d.getDate() + (7 * count));
    }
    if (freq === Frequency.MONTHLY) {
        d.setMonth(d.getMonth() + count);
        // Overflow check (e.g. Jan 31 -> Feb 28)
        if (d.getDate() !== startDay) {
            d.setDate(0);
        }
    }
    if (freq === Frequency.YEARLY) {
        d.setFullYear(d.getFullYear() + count);
        if (d.getDate() !== startDay) {
            d.setDate(0);
        }
    }
    return d;
};

const PlanList: React.FC<Props> = ({ plans, onDelete, onApplyNow, onEdit }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sort plans: Earliest due date first. Maxed out/Completed plans go to bottom.
  const sortedPlans = useMemo(() => {
      return [...plans].sort((a, b) => {
          // Check completion status
          const isMaxedA = a.maxOccurrences && a.occurrencesGenerated >= a.maxOccurrences;
          const isMaxedB = b.maxOccurrences && b.occurrencesGenerated >= b.maxOccurrences;

          if (isMaxedA && !isMaxedB) return 1;
          if (!isMaxedA && isMaxedB) return -1;

          // Check dates
          const dateA = addTimeLocal(a.startDate, a.frequency, a.occurrencesGenerated);
          const dateB = addTimeLocal(b.startDate, b.frequency, b.occurrencesGenerated);
          
          return dateA.getTime() - dateB.getTime();
      });
  }, [plans]);

  if (plans.length === 0) return null;

  const today = new Date();
  today.setHours(0,0,0,0);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(id);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleApply = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      onApplyNow(id);
  };

  const handleEdit = (e: React.MouseEvent, plan: RecurringPlan) => {
      e.preventDefault();
      e.stopPropagation();
      onEdit(plan);
  };

  const toggleRow = (id: string) => {
      setExpandedId(prev => prev === id ? null : id);
      setConfirmDeleteId(null);
  };

  return (
      <div className="border border-gray-800 rounded-sm w-full bg-gray-950">
        <div className="w-full text-left text-xs border-collapse">
            {/* Header */}
            <div className="flex bg-gray-900 text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                <div className="py-1 px-2 border-b border-gray-800 font-medium flex-1">Desc</div>
                <div className="py-1 px-2 border-b border-gray-800 font-medium text-right w-28">Amt</div>
            </div>

            <div className="divide-y divide-gray-800 font-mono">
                {sortedPlans.map(plan => {
                    const isExpanded = expandedId === plan.id;
                    const isDeleting = confirmDeleteId === plan.id;
                    const nextDate = addTimeLocal(plan.startDate, plan.frequency, plan.occurrencesGenerated);
                    nextDate.setHours(0,0,0,0);
                    const isFuture = nextDate > today;
                    const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;
                    const canApply = !isMaxed;

                    return (
                        <div key={plan.id} className="group flex flex-col hover:bg-gray-900/30 transition-colors">
                            {/* Main Row */}
                            <div 
                                className="flex items-center cursor-pointer py-1"
                                onClick={() => toggleRow(plan.id)}
                            >
                                <div className="px-2 flex-1 min-w-0 flex items-center gap-2">
                                    <div className={`w-1 h-4 rounded-sm ${plan.type === 'income' ? 'bg-emerald-800' : 'bg-rose-800'}`}></div>
                                    <div className="text-gray-300 font-medium truncate text-sm">{plan.description}</div>
                                    {plan.isInstallment && <span className="text-[9px] text-blue-500 bg-blue-900/20 px-1 rounded">LOAN</span>}
                                </div>
                                <div className={`px-2 text-right w-28 whitespace-nowrap text-sm ${plan.type === 'income' ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                                    {plan.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div 
                                    className="bg-gray-900/50 px-2 py-2 text-[11px] text-gray-500 border-t border-gray-800/50 flex flex-col gap-2 cursor-default"
                                    onClick={(e) => e.stopPropagation()} // Stop expanded area clicks from toggling row
                                >
                                    <div className="flex justify-between items-center">
                                        <span>Due: <span className={isFuture ? 'text-indigo-300' : 'text-emerald-300'}>{nextDate.toLocaleDateString()}</span></span>
                                        <span className="uppercase text-[9px] border border-gray-700 rounded px-1">{plan.frequency}</span>
                                    </div>
                                    
                                    {plan.maxOccurrences && (
                                        <div className="flex items-center gap-2 text-[10px]">
                                            <span>Progress: {plan.occurrencesGenerated} / {plan.maxOccurrences}</span>
                                            <div className="flex-1 h-1.5 bg-gray-800 rounded overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-600" 
                                                    style={{ width: `${Math.min((plan.occurrencesGenerated / plan.maxOccurrences) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions Bar */}
                                    <div className="flex gap-2 pt-1 border-t border-gray-800/50 mt-1 relative z-10">
                                        {isDeleting ? (
                                            <>
                                                <div className="flex-1 flex items-center justify-center text-red-400 font-bold uppercase tracking-wider text-[10px]">Sure?</div>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleConfirmDelete(e, plan.id)}
                                                    className="bg-red-900/50 hover:bg-red-900/80 text-red-200 px-4 py-1.5 rounded text-xs transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={handleCancelDelete}
                                                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-1.5 rounded text-xs transition-colors"
                                                >
                                                    No
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleApply(e, plan.id)}
                                                    disabled={!canApply}
                                                    className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${canApply ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                                                >
                                                    {isMaxed ? 'Completed' : 'Apply Now'}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleEdit(e, plan)}
                                                    className="px-4 bg-gray-800 hover:bg-indigo-900/50 text-gray-300 py-1.5 rounded text-xs transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteClick(e, plan.id)}
                                                    className="px-4 bg-gray-800 hover:bg-red-900/30 text-red-400 py-1.5 rounded text-xs transition-colors"
                                                >
                                                    Del
                                                </button>
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