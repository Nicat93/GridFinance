
import React, { useState, useMemo } from 'react';
import { RecurringPlan, Frequency, SortOption, CategoryDef } from '../types';
import { DesignConfig } from './DesignDebugger';

interface Props {
  plans: RecurringPlan[];
  onDelete: (id: string) => void;
  onApplyNow: (planId: string) => void;
  onEdit: (plan: RecurringPlan) => void;
  currentPeriodEnd: Date;
  filterText: string;
  sortOption: SortOption;
  designConfig?: DesignConfig;
  categories: CategoryDef[];
}

const PAGE_SIZE = 50;
const KNOWN_COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];


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
const PlanList: React.FC<Props> = ({ plans, onDelete, onApplyNow, onEdit, currentPeriodEnd, filterText, sortOption, designConfig, categories }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);

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
            case 'date_asc':
            case 'date_desc': 
            default:
                const dateA = addTimeLocal(a.startDate, a.frequency, a.occurrencesGenerated);
                const dateB = addTimeLocal(b.startDate, b.frequency, b.occurrencesGenerated);
                
                if (sortOption === 'date_desc') {
                    const dateDiff = dateB.getTime() - dateA.getTime();
                    if (dateDiff !== 0) return dateDiff;
                } else {
                    const dateDiff = dateA.getTime() - dateB.getTime();
                    if (dateDiff !== 0) return dateDiff;
                }
                
                return (b.lastModified || 0) - (a.lastModified || 0);
        }
    });

    return result;
  }, [plans, filterText, sortOption]);

  const visiblePlans = useMemo(() => {
      return filteredAndSorted.slice(0, renderLimit);
  }, [filteredAndSorted, renderLimit]);

  if (plans.length === 0 && !filterText) return null;
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

  const getCategoryStyle = (catName: string): { className: string, style?: React.CSSProperties } => {
      const def = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      const color = def ? def.color : 'gray';
      
      if (KNOWN_COLORS.includes(color)) {
          switch(color) {
            case 'slate': return { className: 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400' };
            case 'red': return { className: 'bg-red-100 dark:bg-red-900/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' };
            case 'orange': return { className: 'bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400' };
            case 'amber': return { className: 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' };
            case 'yellow': return { className: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400' };
            case 'lime': return { className: 'bg-lime-100 dark:bg-lime-900/40 border-lime-200 dark:border-lime-800 text-lime-600 dark:text-lime-400' };
            case 'green': return { className: 'bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400' };
            case 'emerald': return { className: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' };
            case 'teal': return { className: 'bg-teal-100 dark:bg-teal-900/40 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400' };
            case 'cyan': return { className: 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400' };
            case 'sky': return { className: 'bg-sky-100 dark:bg-sky-900/40 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400' };
            case 'blue': return { className: 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' };
            case 'indigo': return { className: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' };
            case 'violet': return { className: 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400' };
            case 'purple': return { className: 'bg-purple-100 dark:bg-purple-900/40 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400' };
            case 'fuchsia': return { className: 'bg-fuchsia-100 dark:bg-fuchsia-900/40 border-fuchsia-200 dark:border-fuchsia-800 text-fuchsia-600 dark:text-fuchsia-400' };
            case 'pink': return { className: 'bg-pink-100 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400' };
            case 'rose': return { className: 'bg-rose-100 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400' };
            default: return { className: 'bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400' };
        }
      } else {
          return {
            className: 'border',
            style: {
                backgroundColor: color + '22',
                color: color,
                borderColor: color + '44'
            }
        };
      }
  };

  // Dynamic Styles from Design Config
  const rowStyle = designConfig ? {
      paddingTop: `${designConfig.paddingY}rem`,
      paddingBottom: `${designConfig.paddingY}rem`,
  } : {};
  
  const descStyle = designConfig ? { 
      fontSize: `${designConfig.fontSize}px`,
      fontWeight: designConfig.fontWeightDesc
  } : {};
  const amountStyle = designConfig ? { 
      fontSize: `${Math.max(10, designConfig.fontSize - 1)}px`,
      fontWeight: designConfig.fontWeightAmount,
      letterSpacing: `${designConfig.tracking}em`
  } : {};
  const pillStyle = designConfig ? { 
      fontSize: `${Math.max(9, designConfig.fontSize - 2)}px`,
      borderRadius: `${designConfig.pillRadius}px`
  } : {};

  return (
    <div className="w-full">
      <div className="border border-gray-200 dark:border-gray-800 rounded-sm w-full bg-white dark:bg-gray-950 transition-colors">
        <div className="w-full text-left text-xs border-collapse">
            
            {/* --- Header --- */}
            <div className="flex justify-between bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider text-[10px]">
                <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium">Details</div>
                <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium text-right">Amount</div>
            </div>

            {/* --- Body --- */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {visiblePlans.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 dark:text-gray-600 italic text-[10px]">No matches found.</div>
                ) : (
                    <>
                    {visiblePlans.map(plan => {
                        const isExpanded = expandedId === plan.id;
                        const isDeleting = confirmDeleteId === plan.id;
                        const nextDate = addTimeLocal(plan.startDate, plan.frequency, plan.occurrencesGenerated);
                        nextDate.setHours(0,0,0,0);
                        const isFuture = nextDate >= today;
                        const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;
                        const canApply = !isMaxed;
                        const catStyle = getCategoryStyle(plan.category);

                        // Status Logic
                        const isLate = nextDate < today;
                        const isUpcomingInPeriod = nextDate >= today && nextDate <= periodEnd;
                        const showMark = !isMaxed && (isLate || isUpcomingInPeriod);

                        let markColor = 'bg-transparent';
                        if (isLate) markColor = 'bg-rose-500'; 
                        else if (isUpcomingInPeriod) markColor = 'bg-orange-500';

                        const progressPercent = plan.maxOccurrences 
                            ? Math.min((plan.occurrencesGenerated / plan.maxOccurrences) * 100, 100) 
                            : 0;

                        return (
                            <div key={plan.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                
                                {/* Main Row */}
                                <div 
                                    className={`flex items-center cursor-pointer ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/40 items-start' : ''}`}
                                    style={rowStyle}
                                    onClick={() => toggleRow(plan.id)}
                                >
                                    {/* Left: Indicator & Description */}
                                    <div className="px-2 flex-1 min-w-0 flex items-center gap-2 self-start">
                                        <div className={`w-1 h-3 rounded-full shrink-0 mt-0.5 transition-colors ${showMark ? markColor : 'bg-transparent'}`}></div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div 
                                                className={`text-gray-700 dark:text-gray-200 leading-tight transition-all ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}
                                                style={descStyle}
                                            >
                                                {plan.description}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Category, Date, Amount */}
                                    <div className="px-2 shrink-0 flex items-center justify-end gap-1.5 sm:gap-2 text-right">
                                        {/* Category Pill - Conditional */}
                                        {plan.category && (
                                            <span 
                                                className={`px-1.5 py-0 h-4 flex items-center ${catStyle.className || ''} ${isExpanded ? '' : 'truncate max-w-[60px]'}`}
                                                style={{ ...pillStyle, ...catStyle.style }}
                                            >
                                                {plan.category}
                                            </span>
                                        )}

                                        {/* Date Pill */}
                                        <span 
                                            className={`px-1.5 py-0 border whitespace-nowrap h-4 flex items-center ${
                                            isLate && !isMaxed
                                            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-500 font-bold'
                                            : (!isFuture && !isMaxed) 
                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-500 font-bold' 
                                            : 'bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}
                                            style={pillStyle}
                                        >
                                            {isMaxed ? 'Done' : formatShortDate(nextDate)}
                                        </span>
                                        
                                        {/* Amount */}
                                        <span 
                                            className={`whitespace-nowrap min-w-[45px] ${plan.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                                            style={amountStyle}
                                        >
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

                                        <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-800/50 mt-1 relative z-10">
                                            {isDeleting ? (
                                                <>
                                                    <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">Sure?</div>
                                                    <button onClick={(e) => handleConfirmDelete(e, plan.id)} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-1.5 rounded text-[10px] sm:text-xs">Yes</button>
                                                    <button onClick={handleCancelDelete} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded text-[10px] sm:text-xs">No</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={(e) => handleApply(e, plan.id)} disabled={!canApply} className={`flex-1 py-1.5 rounded text-[10px] sm:text-xs font-bold ${canApply ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}>{isMaxed ? 'Completed' : 'Apply Now'}</button>
                                                    <button onClick={(e) => handleEdit(e, plan)} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 rounded text-[10px] sm:text-xs hover:bg-gray-300 dark:hover:bg-gray-700">Edit</button>
                                                    <button onClick={(e) => handleDeleteClick(e, plan.id)} className="px-4 bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 py-1.5 rounded text-[10px] sm:text-xs hover:bg-red-100 dark:hover:bg-red-900/30">Del</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
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
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
export default PlanList;
