import React, { useState } from 'react';
import { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

const TransactionGrid: React.FC<Props> = ({ transactions, onDelete, onEdit }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- Handlers ---
  
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(id);
  };
  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation(); onDelete(id); setConfirmDeleteId(null);
  };
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null);
  };
  const handleEdit = (e: React.MouseEvent, tx: Transaction) => {
      e.preventDefault(); e.stopPropagation(); onEdit(tx);
  };
  const toggleRow = (id: string) => {
      setExpandedId(prev => prev === id ? null : id); setConfirmDeleteId(null);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-sm w-full bg-white dark:bg-gray-950 transition-colors">
      <div className="w-full text-left text-xs border-collapse">
        
        {/* --- Header --- */}
        <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-mono uppercase tracking-wider text-[10px]">
          <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium flex-1">Desc</div>
          <div className="py-1 px-2 border-b border-gray-200 dark:border-gray-800 font-medium text-right w-24 sm:w-28">Amt</div>
        </div>

        {/* --- Body --- */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
          {sorted.length === 0 ? (
            <div className="p-4 text-center text-gray-400 dark:text-gray-600 italic text-[10px]">No transactions recorded.</div>
          ) : (
            sorted.map((tx) => {
              const isExpanded = expandedId === tx.id;
              const isDeleting = confirmDeleteId === tx.id;
              
              return (
                <div key={tx.id} className="group flex flex-col hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    
                    {/* Main Row */}
                    <div className="flex items-center cursor-pointer py-1" onClick={() => toggleRow(tx.id)}>
                        <div className="px-2 flex-1 min-w-0">
                            <div className="text-gray-700 dark:text-gray-300 font-medium truncate text-xs sm:text-sm">{tx.description}</div>
                        </div>
                        <div className={`px-2 text-right w-24 sm:w-28 whitespace-nowrap text-xs sm:text-sm tracking-tight ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {tx.type === 'expense' ? '-' : '+'}
                            {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Expanded Details Panel */}
                    {isExpanded && (
                        <div 
                            className="bg-gray-50 dark:bg-gray-900/50 px-2 py-2 text-[11px] text-gray-500 border-t border-gray-100 dark:border-gray-800/50 flex flex-col gap-2 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        >
                             <div className="flex justify-between items-center">
                                <span>{tx.date} • <span className="uppercase tracking-wide border border-gray-300 dark:border-gray-700 rounded px-1 text-[9px]">{tx.category}</span></span>
                             </div>
                             <div className="text-gray-600 dark:text-gray-400 italic break-words">{tx.description}</div>
                             
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
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionGrid;