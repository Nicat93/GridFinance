
import React from 'react';
import { SortOption } from '../types';

interface Props {
  filterText: string;
  onFilterChange: (text: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  onOpenDateFilter: () => void;
  hasDateFilter: boolean;
}

const FilterBar: React.FC<Props> = ({ 
    filterText, onFilterChange, 
    sortOption, onSortChange,
    onOpenDateFilter, hasDateFilter
}) => {
  return (
    <div className="flex gap-2 mb-2 bg-gray-50 dark:bg-black sticky top-[80px] z-20 pt-2 pb-1 items-center transition-all">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
            <input 
                type="text" 
                placeholder="Search..." 
                value={filterText}
                onChange={e => onFilterChange(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 pl-7 text-[11px] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors h-[28px]"
            />
            <svg className="w-3 h-3 absolute left-2.5 top-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {filterText && (
                <button 
                    onClick={() => onFilterChange('')}
                    className="absolute right-1 top-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
        
        {/* Date Filter Button */}
        <button
            onClick={onOpenDateFilter}
            className={`h-[28px] w-[28px] flex items-center justify-center rounded border transition-colors relative ${hasDateFilter 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' 
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {hasDateFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full border border-white dark:border-gray-950"></span>
            )}
        </button>

        {/* Sort */}
        <div className="relative shrink-0">
             <select 
                value={sortOption}
                onChange={e => onSortChange(e.target.value as SortOption)}
                className="appearance-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded pl-2 pr-6 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer h-[28px] font-medium"
            >
                <option value="date_desc">Newest</option>
                <option value="date_asc">Next Due</option>
                <option value="description_asc">A-Z</option>
                <option value="amount_desc">Amount High</option>
                <option value="category">Category</option>
            </select>
            <div className="absolute right-1.5 top-2 pointer-events-none text-gray-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>
    </div>
  );
};

export default FilterBar;
