
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

const PAGE_SIZE = 50;

type SortOption = 'date_desc' | 'date_asc' | 'description_asc' | 'amount_desc' | 'category';

const TransactionGrid: React.FC<Props> = ({ transactions, onDelete, onEdit }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);
  
  // Filter & Sort State
  const [filterText, setFilterText] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Filter
    if (filterText.trim()) {
        const lower = filterText.toLowerCase();
        result = result.filter(t => 
            t.description.toLowerCase().includes(lower) || 
            (t.category && t.category.toLowerCase().includes(lower))
        );
    }

    // Sort
    result.sort((a, b) => {
        switch (sortOption) {
            case 'date_asc':
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            case 'description_asc':
                return a.description.localeCompare(b.description);
            case 'amount_desc':
                return b.amount - a.amount;
            case 'category':
                return a.category.localeCompare(b.category);
            case 'date_desc':
            default:
                // Date Desc + Stability
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                if (timeA !== timeB) return timeB - timeA;
                return (b.lastModified || 0) - (a.lastModified || 0);
        }
    });

    return result;
  }, [transactions, filterText, sortOption]);

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

  // --- Handlers ---
  const handleDeleteClick = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id); };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => { e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null); };
  const handleCancelDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); };
  const handleEdit = (e: React.MouseEvent, tx: Transaction) => { e.preventDefault(); e.stopPropagation(); onEdit(tx); };
  const toggleRow = (id: string) => { setExpandedId(prev => prev === id ? null : id); setConfirmDeleteId(null); };
  const handleShowMore = () => setRenderLimit(prev => prev + PAGE_SIZE);

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
              <option value="date_desc">Newest</option>
              <option value="date_asc">Oldest</option>
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
            {filteredAndSorted.length === 0 ? (
                <div className="p-4 text-center text-gray-400 dark:text-gray-600 italic text-[10px]">No matches found.</div>
            ) : (
                <>
                    {visibleTransactions.map((tx) => {
                    const isExpanded = expandedId === tx.id;
                    const isDeleting = confirmDeleteId === tx.id;
                    
                    return (
                        <div key={tx.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            
                            {/* Main Row */}
                            <div 
                                className={`flex items-center cursor-pointer py-2 ${isExpanded ? 'bg-gray-50 dark:bg-gray-900/40 items-start' : ''}`} 
                                onClick={() => toggleRow(tx.id)}
                            >
                                {/* Left: Description */}
                                <div className="px-2 flex-1 min-w-0">
                                    <div className={`text-gray-700 dark:text-gray-200 font-medium text-xs sm:text-sm transition-all ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}>
                                        {tx.description}
                                    </div>
                                </div>

                                {/* Right: Category, Date, Amount (Single Line) */}
                                <div className="px-2 shrink-0 flex items-center justify-end gap-1.5 sm:gap-2 text-right">
                                    {/* Category Pill */}
                                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 ${isExpanded ? '' : 'truncate max-w-[60px]'}`}>
                                        {tx.category}
                                    </span>
                                    
                                    {/* Date Pill */}
                                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatShortDate(tx.date)}
                                    </span>
                                    
                                    {/* Amount */}
                                    <span className={`text-[11px] sm:text-sm tracking-tighter font-bold whitespace-nowrap min-w-[50px] ${tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
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
                                                <div className="flex-1 flex items-center justify-center text-red-500 dark:text-red-400 font-bold uppercase tracking-wider text-[10px]">Sure?</div>
                                                <button onClick={(e) => handleConfirmDelete(e, tx.id)} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-4 py-1.5 rounded text-xs">Yes</button>
                                                <button onClick={handleCancelDelete} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded text-xs">No</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={(e) => handleEdit(e, tx)} className="flex-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-1.5 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-700">Edit</button>
                                                <button onClick={(e) => handleDeleteClick(e, tx.id)} className="flex-1 bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400 py-1.5 rounded text-xs hover:bg-red-100 dark:hover:bg-red-900/30">Delete</button>
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
                                Show Older Entries ({filteredAndSorted.length - visibleTransactions.length} more)
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
