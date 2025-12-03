
import React, { useState, useMemo } from 'react';
import { RecurringPlan, Frequency } from '../types';

interface Props {
  plans: RecurringPlan[];
  onDelete: (id: string) => void;
  onApplyNow: (planId: string) => void;
  onEdit: (plan: RecurringPlan) => void;
  currentPeriodEnd: Date;
}

const PAGE_SIZE = 50;
type SortOption = 'next_date' | 'description_asc' | 'amount_desc' | 'category';

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
const PlanList: React.FC<Props> = ({ plans, onDelete, onApplyNow, onEdit, currentPeriodEnd }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);

  // Filter & Sort State
  const [filterText, setFilterText] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('next_date');

  const filteredAndSorted = useMemo(() => {
    let result = [...plans];

    // Filter
    if (filterText.trim()) {
        const lower = filterText.toLowerCase();
        result = result.filter(p => 
            p.description.toLowerCase().includes(lower) || 
            (p.category && p.category.toLowerCase().includes(lower))
        );
    }

    // Sort
    result.sort((a, b) => {
        // Status Pre-sort (Always keep maxed items at bottom)
        const isMaxedA = a.maxOccurrences && a.occurrencesGenerated >= a.maxOccurrences;
        const isMaxedB = b.maxOccurrences && b.occurrencesGenerated >= b.maxOccurrences;
        if (isMaxedA && !isMaxedB) return 1;
        if (!isMaxedA && isMaxedB) return -1;

        switch (sortOption) {
            case 'description_asc':
                return a.description.localeCompare(b.description);
            case 'amount_desc':
                return b.amount - a.amount;
            case 'category':
                return a.category.localeCompare(b.category);
            case 'next_date':
            default:
                const dateA = addTimeLocal(a.startDate, a.frequency, a.occurrencesGenerated);
                const dateB = addTimeLocal(b.startDate, b.frequency, b.occurrencesGenerated);
                const dateDiff = dateA.getTime() - dateB.getTime();
                if (dateDiff !== 0) return dateDiff;
                return (b.lastModified || 0) - (a.lastModified || 0);
        }
    });

    return result;
  }, [plans, filterText, sortOption]);

  const visiblePlans = useMemo(() => {
      return filteredAndSorted.slice(0, renderLimit);
  }, [filteredAndSorted, renderLimit]);

  if (plans.length === 0) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const periodEnd = new Date(currentPeriodEnd); periodEnd.setHours(23,59,59,999);

  // --- Handlers ---
  const handleDeleteClick = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id); };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null); };
  const handleCancelDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); };
  const handleApply = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onApplyNow(id); };
  const handleEdit = (e: React.MouseEvent, plan: RecurringPlan) => { e.preventDefault(); e.stopPropagation(); onEdit(plan); };
  const toggleRow = (id: string) => { setExpandedId(prev => prev === id ? null : id); setConfirmDeleteId(null); };
  const handleShowMore = () => setRenderLimit(prev => prev + PAGE_SIZE);

  const formatShortDate = (date: Date) => {
      return `${date.getMonth() + 1}-${date.getDate()}`;
  };

  return (
    <div className="w-full">
      {/* Filter Bar */}
      <div className="mb-2 flex gap-2">
          <input 
              type="text" 
              placeholder="Filter Description/Category..." 
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-1.5 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500"
          />
          <select 
              value={sortOption}
              onChange={e => setSortOption(e.target.value as SortOption)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-gray-800 dark:text-gray-200 focus:outline-none"
          >
              <option value="next_date">Next Due</option>
              <option value="description_asc">Desc A-Z</option>
              <option value="amount_desc">Amount High</option>
              <option value="category">Category</option>
          </select>
      </div>

      <div className="border border-gray-200 dark:border-gray-800 rounded-sm w-full bg-white dark:bg-gray-950 transition-colors">
        <div className="w-full text-left text-xs border-collapse">
            
            {/* --- Header --- */}
            <div className="flex justify-between bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium">Details</div>
                <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium text-right">Amount</div>
            </div>

            {/* --- Body --- */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {visiblePlans.map(plan => {
                    const isExpanded = expandedId === plan.id;
                    const isDeleting = confirmDeleteId === plan.id;
                    const nextDate = addTimeLocal(plan.startDate, plan.frequency, plan.occurrencesGenerated);
                    nextDate.setHours(0,0,0,0);
                    const isFuture = nextDate >= today;
                    const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;
                    const canApply = !isMaxed;
                    
                    // Status Logic
                    const isLate = nextDate < today;
                    const isUpcomingInPeriod = nextDate >= today && nextDate <= periodEnd;
                    // If it's maxed or in next cycle, we don't show a mark
                    const showMark = !isMaxed && (isLate || isUpcomingInPeriod);

                    let markColor = 'bg-transparent';
                    if (isLate) markColor = 'bg-rose-500'; // Late (Red)
                    else if (isUpcomingInPeriod) markColor = 'bg-orange-500'; // Upcoming in this period (Orange)

                    const progressPercent = plan.maxOccurrences 
                        ? Math.min((plan.occurrencesGenerated / plan.maxOccurrences) * 100, 100) 
                        : 0;

                    return (
                        <div key={plan.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            
                            {/* Main Row */}
                            <div 
                                className={`flex items-center cursor-pointer py-2 ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/40 items-start' : ''}`} 
                                onClick={() => toggleRow(plan.id)}
                            >
                                {/* Left: Indicator & Description */}
                                <div className="px-2 flex-1 min-w-0 flex items-center gap-2 self-start">
                                    {/* Status Indicator */}
                                    <div className={`w-1 h-3 rounded-full shrink-0 mt-1 transition-colors ${showMark ? markColor : 'bg-transparent'}`}></div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-gray-700 dark:text-gray-200 font-medium text-xs sm:text-sm transition-all ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}>
                                            {plan.description}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Category, Date, Amount (Single Line) */}
                                <div className="px-2 shrink-0 flex items-center justify-end gap-1.5 sm:gap-2 text-right">
                                    {/* Category Pill */}
                                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 ${isExpanded ? '' : 'truncate max-w-[60px]'}`}>
                                        {plan.category}
                                    </span>

                                    {/* Date Pill */}
                                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                        isLate && !isMaxed
                                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-500 font-bold'
                                        : (!isFuture && !isMaxed) 
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-500 font-bold' 
                                        : 'bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                    }`}>
                                        {isMaxed ? 'Done' : formatShortDate(nextDate)}
                                    </span>
                                    
                                    {/* Amount */}
                                    <span className={`text-[11px] sm:text-sm tracking-tighter font-bold whitespace-nowrap min-w-[50px] ${plan.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {plan.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
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
                                        <div className="flex items-center gap-2 text-[9px] sm:text-[10px]">
                                            <span className="font-mono">
                                                Progress: {plan.occurrencesGenerated} / {plan.maxOccurrences}
                                            </span>
                                            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded overflow-hidden max-w-[100px]">
                                                <div className="h-full bg-indigo-600" style={{ width: `${progressPercent}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-800/50 mt-1 relative z-10">
                                        {isDeleting ? (
                                            <>
                                                <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">Sure?</div>
                                                <button onClick={(e) => handleConfirmDelete(e, plan.id)} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-1.5 rounded text-xs">Yes</button>
                                                <button onClick={handleCancelDelete} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded text-xs">No</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={(e) => handleApply(e, plan.id)} disabled={!canApply} className={`flex-1 py-1.5 rounded text-xs font-bold ${canApply ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}>{isMaxed ? 'Completed' : 'Apply Now'}</button>
                                                <button onClick={(e) => handleEdit(e, plan)} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-700">Edit</button>
                                                <button onClick={(e) => handleDeleteClick(e, plan.id)} className="px-4 bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 py-1.5 rounded text-xs hover:bg-red-100 dark:hover:bg-red-900/30">Del</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                 {/* Load More Button */}
                 {filteredAndSorted.length > visiblePlans.length && (
                    <div className="p-2 text-center">
                        <button 
                            onClick={handleShowMore}
                            className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-4 transition-colors"
                        >
                            Show More Plans ({filteredAndSorted.length - visiblePlans.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
export default PlanList;
