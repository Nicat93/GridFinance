
import React from 'react';
import { SortOption } from '../types';

interface Props {
  filterText: string;
  onFilterChange: (text: string) => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

const FilterBar: React.FC<Props> = ({ filterText, onFilterChange, sortOption, onSortChange }) => {
  return (
    <div className="flex gap-2 mb-4 bg-gray-50 dark:bg-black sticky top-[85px] z-20 pt-2 pb-1">
        <div className="relative flex-1 min-w-0">
            <input 
                type="text" 
                placeholder="Search..." 
                value={filterText}
                onChange={e => onFilterChange(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-1.5 pl-8 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {filterText && (
                <button 
                    onClick={() => onFilterChange('')}
                    className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
        
        <select 
            value={sortOption}
            onChange={e => onSortChange(e.target.value as SortOption)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-2 py-1.5 text-xs text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
        >
            <option value="date_desc">Newest</option>
            <option value="date_asc">Next Due</option>
            <option value="description_asc">A-Z</option>
            <option value="amount_desc">Amount High</option>
            <option value="category">Category</option>
        </select>
    </div>
  );
};

export default FilterBar;
