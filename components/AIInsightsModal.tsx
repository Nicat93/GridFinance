import React, { useState, useEffect } from 'react';
import { generateInsights } from '../services/geminiService';
import { Transaction, RecurringPlan, FinancialSnapshot } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  plans: RecurringPlan[];
  snapshot: FinancialSnapshot;
}

const AIInsightsModal: React.FC<Props> = ({ isOpen, onClose, transactions, plans, snapshot }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      handleGenerate();
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    setLoading(true);
    setInsight('');
    const result = await generateInsights(transactions, plans, snapshot);
    setInsight(result);
    setLoading(false);
    setHasLoaded(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div 
            className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
                <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <span className="text-xl">✨</span> AI Insights
                </h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">✕</button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 opacity-70">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 animate-pulse">Analyzing financial data...</p>
                    </div>
                ) : (
                    <div className="prose dark:prose-invert prose-sm max-w-none leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {insight}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
                <button 
                    onClick={handleGenerate} 
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                >
                    Regenerate
                </button>
            </div>
        </div>
    </div>
  );
};

export default AIInsightsModal;
