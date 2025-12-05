
import React, { useEffect } from 'react';
import { RecurringPlan, LanguageCode } from '../types';
import { translations } from '../translations';

interface Props {
  isOpen: boolean;
  targetDate: Date;
  pendingPlans: { plan: RecurringPlan, due: Date }[];
  onResolve: (planId: string, action: 'move' | 'paid' | 'cancel') => void;
  onContinue: () => void;
  onCancel: () => void;
  language: LanguageCode;
}

const PeriodTransitionModal: React.FC<Props> = ({ 
    isOpen, 
    targetDate, 
    pendingPlans, 
    onResolve, 
    onContinue, 
    onCancel,
    language
}) => {
  const t = translations[language];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div 
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
    >
      <div 
        className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t.unresolvedItems}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.unresolvedDesc}
            </p>
        </div>

        {/* List */}
        <div className="p-0 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800">
            {pendingPlans.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-sm">
                    {t.allResolved}
                </div>
            ) : (
                pendingPlans.map(({ plan, due }) => (
                    <div key={plan.id} className="p-4 flex flex-col gap-3 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{plan.description}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                    {t.due}: {formatDate(due)} • {plan.tags.join(', ')}
                                </div>
                            </div>
                            <div className={`font-mono font-bold text-sm ${plan.type === 'expense' ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                                {plan.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => onResolve(plan.id, 'move')}
                                className="px-2 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-bold border border-indigo-100 dark:border-indigo-900/30 transition-colors flex flex-col items-center gap-1"
                            >
                                <span>{t.move} ➝</span>
                                <span className="text-[9px] font-normal opacity-70">{t.to} {formatDate(targetDate)}</span>
                            </button>
                            
                            <button 
                                onClick={() => onResolve(plan.id, 'paid')}
                                className="px-2 py-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-xs font-bold border border-emerald-100 dark:border-emerald-900/30 transition-colors flex flex-col items-center gap-1"
                            >
                                <span>{t.paid} ✓</span>
                                <span className="text-[9px] font-normal opacity-70">{t.on} {formatDate(due)}</span>
                            </button>

                            <button 
                                onClick={() => onResolve(plan.id, 'cancel')}
                                className="px-2 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-bold border border-gray-200 dark:border-gray-700 transition-colors flex flex-col items-center gap-1"
                            >
                                <span>{t.cancel} ✕</span>
                                <span className="text-[9px] font-normal opacity-70">{t.skip}</span>
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
             <button 
                onClick={onCancel}
                className="flex-1 py-2.5 rounded text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
                {t.cancelChange}
            </button>
            <button 
                onClick={onContinue}
                className="flex-1 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 py-2.5 rounded text-sm font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {pendingPlans.length === 0 ? t.finish : t.ignoreRemaining}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PeriodTransitionModal;
