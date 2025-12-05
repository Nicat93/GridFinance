

import React, { useState, useMemo } from 'react';
import { Transaction, SortOption, CategoryDef, LanguageCode } from '../types';
import { DesignConfig } from './DesignDebugger';
import { translations } from '../translations';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  filterText: string;
  sortOption: SortOption;
  designConfig?: DesignConfig;
  categories: CategoryDef[];
  startDate?: string;
  endDate?: string;
  language: LanguageCode;
}

const PAGE_SIZE = 50;
const KNOWN_COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

const TransactionGrid: React.FC<Props> = ({ 
    transactions, onDelete, onEdit, 
    filterText, sortOption, designConfig, categories,
    startDate, endDate, language
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);
  const t = translations[language];
  
  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Filter by Text
    if (filterText.trim()) {
        const lower = filterText.toLowerCase();
        result = result.filter(t => 
            t.description.toLowerCase().includes(lower) || 
            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lower)))
        );
    }

    // Filter by Date Range
    if (startDate) {
        result = result.filter(t => t.date >= startDate);
    }
    if (endDate) {
        result = result.filter(t => t.date <= endDate);
    }

    // Sort
    result.sort((a, b) => {
        switch (sortOption) {
            case 'date_asc':
                // For "Next Due" option, History should be Newest first (Descending)
                const dAscA = new Date(a.date).getTime();
                const dAscB = new Date(b.date).getTime();
                if (dAscA !== dAscB) return dAscB - dAscA;
                // Stable sort by creation time (Newer first)
                return (b.createdAt || 0) - (a.createdAt || 0);
            case 'description_asc':
                return a.description.localeCompare(b.description);
            case 'amount_desc':
                return b.amount - a.amount;
            case 'category':
                // Sort by first tag
                const tagA = a.tags && a.tags.length > 0 ? a.tags[0] : '';
                const tagB = b.tags && b.tags.length > 0 ? b.tags[0] : '';
                return tagA.localeCompare(tagB);
            case 'date_desc':
            default:
                // Date Desc + Stability
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                if (timeA !== timeB) return timeB - timeA;
                // Stable sort by creation time (Newer first)
                return (b.createdAt || 0) - (a.createdAt || 0);
        }
    });

    return result;
  }, [transactions, filterText, sortOption, startDate, endDate]);

  // Performance Optimization
  const visibleTransactions = useMemo(() => {
      return filteredAndSorted.slice(0, renderLimit);
  }, [filteredAndSorted, renderLimit]);

  // --- Helpers ---
  const formatShortDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      // Returns MM-DD, e.g. "11-25"
      return `${parts[1]}-${parts[2]}`;
  };

  const getTagStyle = (tagName: string): { className: string, style?: React.CSSProperties } => {
      const def = categories.find(c => c.name.toLowerCase() === tagName.toLowerCase());
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
        // Custom Color (Hex, etc.)
        return {
            className: 'border',
            style: {
                backgroundColor: color + '22', // Low opacity background
                color: color,
                borderColor: color + '44' // Med opacity border
            }
        };
      }
  };

  // --- Handlers ---
  const handleDeleteClick = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id); };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null); };
  const handleCancelDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); };
  const handleEdit = (e: React.MouseEvent, tx: Transaction) => { e.preventDefault(); e.stopPropagation(); onEdit(tx); };
  const toggleRow = (id: string) => { setExpandedId(prev => prev === id ? null : id); setConfirmDeleteId(null); };
  const handleShowMore = () => setRenderLimit(prev => prev + PAGE_SIZE);

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
            <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium">{t.details}</div>
            <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium text-right">{t.amount}</div>
            </div>

            {/* --- Body --- */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            {filteredAndSorted.length === 0 ? (
                <div className="p-4 text-center text-gray-400 dark:text-gray-600 italic text-[10px]">{t.noMatches}</div>
            ) : (
                <>
                    {visibleTransactions.map((tx) => {
                    const isExpanded = expandedId === tx.id;
                    const isDeleting = confirmDeleteId === tx.id;
                    
                    return (
                        <div key={tx.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            
                            {/* Main Row - Styled via Design Config */}
                            <div 
                                className={`flex items-center cursor-pointer ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/40 items-start' : ''}`} 
                                style={rowStyle}
                                onClick={() => toggleRow(tx.id)}
                            >
                                {/* Left: Description */}
                                <div className="px-2 flex-1 min-w-0">
                                    <div 
                                        className={`text-gray-700 dark:text-gray-200 leading-tight transition-all ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}
                                        style={descStyle}
                                    >
                                        {tx.description}
                                    </div>
                                </div>

                                {/* Right: Tags, Date, Amount */}
                                <div className="px-2 shrink-0 flex items-center justify-end gap-1.5 sm:gap-2 text-right">
                                    {/* Tag Pills */}
                                    {tx.tags && tx.tags.length > 0 && (
                                        <div className="flex gap-1 overflow-hidden max-w-[80px] sm:max-w-[120px]">
                                            {tx.tags.map((tag, idx) => {
                                                const style = getTagStyle(tag);
                                                return (
                                                    <span 
                                                        key={idx}
                                                        className={`px-1.5 py-0 h-4 flex items-center shrink-0 ${style.className || ''}`}
                                                        style={{ ...pillStyle, ...style.style }}
                                                    >
                                                        {tag}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    {/* Date Pill */}
                                    <span 
                                        className="px-1.5 py-0 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 whitespace-nowrap h-4 flex items-center"
                                        style={pillStyle}
                                    >
                                        {formatShortDate(tx.date)}
                                    </span>
                                    
                                    {/* Amount */}
                                    <span 
                                        className={`whitespace-nowrap min-w-[45px] ${tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}
                                        style={amountStyle}
                                    >
                                        {tx.type === 'expense' ? '-' : '+'}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded Details Panel (Actions Only) */}
                            {isExpanded && (
                                <div 
                                    className="bg-gray-50 dark:bg-gray-900/50 px-2 pb-2 text-[11px] text-gray-500 flex flex-col gap-2 cursor-default"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-gray-800/50 mt-1 relative z-10">
                                        {isDeleting ? (
                                            <>
                                                <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">{t.sure}</div>
                                                <button onClick={(e) => handleConfirmDelete(e, tx.id)} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-1.5 rounded text-[10px] sm:text-xs">{t.yes}</button>
                                                <button onClick={handleCancelDelete} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded text-[10px] sm:text-xs">{t.no}</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={(e) => handleEdit(e, tx)} className="flex-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 rounded text-[10px] sm:text-xs hover:bg-gray-300 dark:hover:bg-gray-700">{t.edit}</button>
                                                <button onClick={(e) => handleDeleteClick(e, tx.id)} className="flex-1 bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 py-1.5 rounded text-[10px] sm:text-xs hover:bg-red-100 dark:hover:bg-red-900/30">{t.delete}</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                    })}

                    {/* Load More Button */}
                    {filteredAndSorted.length > visibleTransactions.length && (
                        <div className="p-2 text-center">
                            <button 
                                onClick={handleShowMore}
                                className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 px-4 transition-colors"
                            >
                                {t.showOlder} ({filteredAndSorted.length - visibleTransactions.length} more)
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

export default TransactionGrid;