
import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onApply: (start: string, end: string) => void;
}

const DateRangeModal: React.FC<Props> = ({ isOpen, startDate, endDate, onClose, onApply }) => {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setLocalStart(startDate);
      setLocalEnd(endDate);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, startDate, endDate]);

  if (!isOpen) return null;

  const handleClear = () => {
    setLocalStart('');
    setLocalEnd('');
  };

  const handleApply = () => {
    onApply(localStart, localEnd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-xs flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Filter Dates</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">✕</button>
        </div>

        <div className="p-5 space-y-4">
            <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Start Date</label>
                <input 
                    type="date" 
                    value={localStart}
                    onChange={(e) => setLocalStart(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500"
                />
            </div>
            
            <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">End Date</label>
                <input 
                    type="date" 
                    value={localEnd}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500"
                />
            </div>

            <div className="pt-2 flex gap-3">
                <button 
                    onClick={handleClear}
                    className="flex-1 py-2 rounded text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    Clear Filter
                </button>
                <button 
                    onClick={handleApply}
                    className="flex-1 py-2 rounded text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors"
                >
                    Apply
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default DateRangeModal;
