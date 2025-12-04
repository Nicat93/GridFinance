
import React, { useState, useEffect, useRef } from 'react';
import { Frequency, TransactionType, Transaction, RecurringPlan, CategoryDef } from '../types';
import CalculatorSheet from './CalculatorSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Transaction | RecurringPlan | null;
  categories: CategoryDef[];
}

const KNOWN_COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

const AddTransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, categories }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
  const [maxOccurrences, setMaxOccurrences] = useState('');

  // Calculator State
  const [calcTarget, setCalcTarget] = useState<'amount' | 'maxOccurrences' | null>(null);

  // Category Dropdown State
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when modal is open
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

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setAmount(initialData.amount.toString());
        setDescription(initialData.description || '');
        setCategory(initialData.category || '');
        
        if ('frequency' in initialData) {
            const plan = initialData as RecurringPlan;
            setDate(plan.startDate);
            setIsRecurring(true);
            setFrequency(plan.frequency);
            setMaxOccurrences(plan.maxOccurrences ? plan.maxOccurrences.toString() : '');
        } else {
            const tx = initialData as Transaction;
            setDate(tx.date);
            setIsRecurring(false);
            setFrequency(Frequency.MONTHLY);
            setMaxOccurrences('');
        }
      } else {
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('');
        setDate(new Date().toISOString().split('T')[0]);
        setIsRecurring(false);
        setFrequency(Frequency.MONTHLY);
        setMaxOccurrences('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseData = {
      description,
      amount: parseFloat(amount) || 0,
      type,
      category,
      date, 
    };

    if (isRecurring) {
        onSave({
            ...baseData,
            kind: 'plan',
            frequency,
            maxOccurrences: maxOccurrences ? Math.round(parseFloat(maxOccurrences)) : undefined, // Ensure integer
        });
    } else {
        onSave({ ...baseData, kind: 'single' });
    }
    
    onClose();
  };

  const handleFrequencyChange = (val: Frequency) => {
      setFrequency(val);
      if (val === Frequency.ONE_TIME) {
          setMaxOccurrences('1');
      } else {
          if (maxOccurrences === '1') setMaxOccurrences('');
      }
  }

  const handleCalculatorApply = (val: string) => {
      if (calcTarget === 'amount') {
          setAmount(val);
      } else if (calcTarget === 'maxOccurrences') {
          setMaxOccurrences(val);
      }
  };

  const getColorStyle = (color: string) => {
    if (KNOWN_COLORS.includes(color)) {
        switch(color) {
            case 'slate': return { className: 'bg-slate-500' };
            case 'gray': return { className: 'bg-gray-500' };
            case 'red': return { className: 'bg-red-500' };
            case 'orange': return { className: 'bg-orange-500' };
            case 'amber': return { className: 'bg-amber-500' };
            case 'yellow': return { className: 'bg-yellow-500' };
            case 'lime': return { className: 'bg-lime-500' };
            case 'green': return { className: 'bg-green-500' };
            case 'emerald': return { className: 'bg-emerald-500' };
            case 'teal': return { className: 'bg-teal-500' };
            case 'cyan': return { className: 'bg-cyan-500' };
            case 'sky': return { className: 'bg-sky-500' };
            case 'blue': return { className: 'bg-blue-500' };
            case 'indigo': return { className: 'bg-indigo-500' };
            case 'violet': return { className: 'bg-violet-500' };
            case 'purple': return { className: 'bg-purple-500' };
            case 'fuchsia': return { className: 'bg-fuchsia-500' };
            case 'pink': return { className: 'bg-pink-500' };
            case 'rose': return { className: 'bg-rose-500' };
            default: return { className: 'bg-gray-500' };
        }
    } else {
        return { style: { backgroundColor: color } };
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(category.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div 
            className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 w-full max-w-sm rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={() => setIsCatDropdownOpen(false)}
        >
            <div className="p-4 border-b border-gray-100 dark:border-gray-900 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <h2 className="text-gray-800 dark:text-gray-200 font-bold text-base uppercase tracking-wide">
                    {initialData ? (isRecurring ? 'Edit Plan' : 'Edit Entry') : 'New Entry'}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[120px]">
                    <div 
                        onClick={() => setCalcTarget('amount')}
                        className={`w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white px-3 py-2 rounded text-left font-mono text-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${!amount ? 'text-gray-400' : ''}`}
                    >
                        {amount ? amount : '0.00'}
                    </div>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-900 rounded p-1 h-10 border border-gray-200 dark:border-gray-800 shrink-0">
                    <button 
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-3 text-sm font-bold rounded transition-colors ${type === 'expense' ? 'bg-white dark:bg-rose-900 text-rose-600 dark:text-rose-200 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                    - Exp
                    </button>
                    <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>
                    <button 
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-3 text-sm font-bold rounded transition-colors ${type === 'income' ? 'bg-white dark:bg-emerald-900 text-emerald-600 dark:text-emerald-200 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                    + Inc
                    </button>
                </div>
            </div>

            <div>
                <input 
                    type="text" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-300 px-3 py-2 rounded text-base font-bold focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder="Description (e.g. Walmart)"
                    autoComplete="off"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <input 
                        ref={catInputRef}
                        type="text" 
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        onFocus={() => setIsCatDropdownOpen(true)}
                        onClick={(e) => { e.stopPropagation(); setIsCatDropdownOpen(true); }}
                        className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                        placeholder="Category"
                        autoComplete="off"
                    />
                    {/* Dropdown Chevron */}
                    <div className="absolute right-2 top-2.5 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    {isCatDropdownOpen && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {filteredCategories.length === 0 ? (
                                <div className="p-2 text-xs text-gray-400 italic text-center">Type to add new</div>
                            ) : (
                                filteredCategories.map(c => {
                                    const style = getColorStyle(c.color);
                                    return (
                                    <div 
                                        key={c.id}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setCategory(c.name); 
                                            setIsCatDropdownOpen(false); 
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
                                    >
                                        <div 
                                            className={`w-3 h-3 rounded-full ${style.className || ''}`}
                                            style={style.style}
                                        ></div>
                                        <span>{c.name}</span>
                                    </div>
                                )})
                            )}
                        </div>
                    )}
                </div>

                <input 
                    type="date" 
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                />
            </div>

            <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={isRecurring} 
                            disabled={!!initialData && !('frequency' in initialData)} 
                            onChange={e => setIsRecurring(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className={`text-sm select-none ${!!initialData && !('frequency' in initialData) ? 'text-gray-400 dark:text-gray-600' : 'text-gray-600 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-300'}`}>
                            Planned
                        </span>
                    </label>

                    {isRecurring && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-600 uppercase mb-1">Frequency</label>
                                    <select 
                                        value={frequency}
                                        onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
                                        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 p-1.5 rounded text-sm focus:outline-none"
                                    >
                                        <option value={Frequency.ONE_TIME}>One-time</option>
                                        <option value={Frequency.WEEKLY}>Weekly</option>
                                        <option value={Frequency.MONTHLY}>Monthly</option>
                                        <option value={Frequency.YEARLY}>Yearly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-600 uppercase mb-1">Total Payments</label>
                                    <div 
                                        onClick={() => frequency !== Frequency.ONE_TIME && setCalcTarget('maxOccurrences')}
                                        className={`w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 p-1.5 rounded text-sm font-mono truncate h-[34px] flex items-center ${frequency === Frequency.ONE_TIME ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                                    >
                                        {maxOccurrences ? maxOccurrences : <span className="text-gray-400">∞</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-base shadow-lg transition-all mt-4">
                {initialData ? 'Update' : (isRecurring ? 'Create Plan' : 'Add Transaction')}
            </button>
            </form>
        </div>
        </div>

        <CalculatorSheet 
            isOpen={!!calcTarget}
            initialValue={calcTarget === 'amount' ? amount : maxOccurrences}
            onClose={() => setCalcTarget(null)}
            onApply={handleCalculatorApply}
        />
    </>
  );
};

export default AddTransactionModal;
