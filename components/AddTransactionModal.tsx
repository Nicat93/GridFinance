

import React, { useState, useEffect, useRef } from 'react';
import { Frequency, TransactionType, Transaction, RecurringPlan, CategoryDef, LanguageCode } from '../types';
import CalculatorSheet from './CalculatorSheet';
import { translations } from '../translations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Transaction | RecurringPlan | null;
  categories: CategoryDef[];
  language: LanguageCode;
}

const KNOWN_COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];

// Deterministic color picker based on string hash
const pickColorForString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % KNOWN_COLORS.length;
    return KNOWN_COLORS[index];
};

const AddTransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, categories, language }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // Tag Selection State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [isLoan, setIsLoan] = useState(false);
  const [planStartDate, setPlanStartDate] = useState(''); // Separate start date for loan repayment plans

  // Calculator State
  const [calcTarget, setCalcTarget] = useState<'amount' | 'maxOccurrences' | null>(null);

  // Tag Dropdown State
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  
  const t = translations[language];

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
        // Initialize Tags (fallback to empty if migration hasn't run yet on this specific object in memory)
        setSelectedTags(initialData.tags || []);
        
        if ('frequency' in initialData) {
            const plan = initialData as RecurringPlan;
            setDate(plan.startDate);
            setPlanStartDate(plan.startDate);
            setIsRecurring(true);
            setFrequency(plan.frequency);
            setMaxOccurrences(plan.maxOccurrences ? plan.maxOccurrences.toString() : '');
            setIsLoan(false); // Can't toggle loan on edit usually
        } else {
            const tx = initialData as Transaction;
            setDate(tx.date);
            setPlanStartDate(tx.date);
            setIsRecurring(false);
            setFrequency(Frequency.MONTHLY);
            setMaxOccurrences('');
            setIsLoan(false);
        }
      } else {
        setType('expense');
        setAmount('');
        setDescription('');
        setSelectedTags([]);
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setPlanStartDate(today);
        setIsRecurring(false);
        setFrequency(Frequency.MONTHLY);
        setMaxOccurrences('');
        setIsLoan(false);
      }
      setTagInput('');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseData = {
      description,
      amount: parseFloat(amount) || 0,
      type,
      tags: selectedTags,
      date, 
    };

    if (isRecurring) {
        onSave({
            ...baseData,
            kind: 'plan',
            frequency,
            maxOccurrences: maxOccurrences ? Math.round(parseFloat(maxOccurrences)) : undefined,
            isLoan: isLoan,
            planStartDate: isLoan ? planStartDate : undefined // Pass the separate start date if loan
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
          // If value is 0 (or empty), treat as infinite
          if (parseFloat(val) === 0 || val === '') {
              setMaxOccurrences('');
          } else {
              setMaxOccurrences(val);
          }
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

  // --- Tag Logic ---
  const addTag = (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !selectedTags.includes(trimmed)) {
          setSelectedTags([...selectedTags, trimmed]);
      }
      setTagInput('');
      setIsTagDropdownOpen(false);
  };

  const removeTag = (tag: string) => {
      setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          addTag(tagInput);
      }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(tagInput.toLowerCase()) &&
    !selectedTags.includes(c.name)
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
        <div 
            className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={onClose}
        >
        <div 
            className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 w-full max-w-sm rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-4 border-b border-gray-100 dark:border-gray-900 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <h2 className="text-gray-800 dark:text-gray-200 font-bold text-base uppercase tracking-wide">
                    {initialData ? (isRecurring ? t.editPlan : t.editEntry) : t.newEntry}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
            {/* Amount & Type Row */}
            <div className="flex gap-3 h-10">
                <div 
                    onClick={() => setCalcTarget('amount')}
                    className={`flex-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white px-3 py-2 rounded text-left font-mono text-lg flex items-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${!amount ? 'text-gray-400' : ''}`}
                >
                    {amount ? amount : '0.00'}
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-900 rounded p-1 border border-gray-200 dark:border-gray-800 shrink-0">
                    <button 
                    type="button"
                    onClick={() => setType('expense')}
                    className={`px-3 text-xs sm:text-sm font-bold rounded transition-colors flex items-center ${type === 'expense' ? 'bg-white dark:bg-rose-900 text-rose-600 dark:text-rose-200 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                    - {t.exp}
                    </button>
                    <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>
                    <button 
                    type="button"
                    onClick={() => setType('income')}
                    className={`px-3 text-xs sm:text-sm font-bold rounded transition-colors flex items-center ${type === 'income' ? 'bg-white dark:bg-emerald-900 text-emerald-600 dark:text-emerald-200 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                    + {t.inc}
                    </button>
                </div>
            </div>

            <div>
                <input 
                    type="text" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-300 px-3 py-2 rounded text-base font-bold focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder={t.descriptionPlaceholder}
                    autoComplete="off"
                />
            </div>

            {/* Tag Selection */}
            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    {/* Selected Tags Display */}
                    {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {selectedTags.map(tag => {
                                // Find color if exists
                                const def = categories.find(c => c.name.toLowerCase() === tag.toLowerCase());
                                const color = def ? def.color : pickColorForString(tag);
                                const style = getColorStyle(color);
                                return (
                                    <span 
                                        key={tag} 
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-white ${style.className || ''}`}
                                        style={style.style}
                                    >
                                        {tag}
                                        <button 
                                            type="button" 
                                            onClick={() => removeTag(tag)}
                                            className="hover:text-gray-200"
                                        >✕</button>
                                    </span>
                                )
                            })}
                        </div>
                    )}

                    <input 
                        type="text" 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onFocus={() => setIsTagDropdownOpen(true)}
                        onKeyDown={handleTagInputKeyDown}
                        onClick={(e) => { e.stopPropagation(); setIsTagDropdownOpen(true); }}
                        className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                        placeholder={t.categoryPlaceholder}
                        autoComplete="off"
                    />
                    
                    {isTagDropdownOpen && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {tagInput.trim() !== '' && !filteredCategories.find(c => c.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
                                <div 
                                    className="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 flex items-center gap-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addTag(tagInput);
                                    }}
                                >
                                    <span className="text-sm text-gray-600 dark:text-gray-300 font-bold">+ {t.create} "{tagInput}"</span>
                                </div>
                            )}
                            
                            {filteredCategories.length === 0 && !tagInput.trim() && (
                                <div className="p-2 text-xs text-gray-400 italic text-center">{t.typeToAdd}</div>
                            )}
                            
                            {filteredCategories.map(c => {
                                const style = getColorStyle(c.color);
                                return (
                                <div 
                                    key={c.id}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        addTag(c.name);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <div 
                                        className={`w-3 h-3 rounded-full ${style.className || ''}`}
                                        style={style.style}
                                    ></div>
                                    <span>{c.name}</span>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                <input 
                    type="date" 
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none transition-colors h-[38px] self-end"
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
                            {t.plannedRecurring}
                        </span>
                    </label>

                    {isRecurring && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded space-y-3 animate-in fade-in slide-in-from-top-2">
                            
                            {/* Frequency & Payments Row - Moved to Top */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-600 uppercase mb-1">{t.frequency}</label>
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
                                    <label className="block text-xs text-gray-500 dark:text-gray-600 uppercase mb-1">{t.totalPayments}</label>
                                    <div 
                                        onClick={() => frequency !== Frequency.ONE_TIME && setCalcTarget('maxOccurrences')}
                                        className={`w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 p-1.5 rounded text-sm font-mono truncate h-[34px] flex items-center ${frequency === Frequency.ONE_TIME ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                                    >
                                        {maxOccurrences ? maxOccurrences : <span className="text-gray-400">∞</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Loan Checkbox Row - Moved Below Frequency */}
                            {!initialData && (
                                <div className="pt-3 border-t border-gray-200 dark:border-gray-800/50 flex items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                                        <input 
                                            type="checkbox" 
                                            checked={isLoan} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setIsLoan(checked);
                                                if (checked && !maxOccurrences) setMaxOccurrences('1');
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {t.loanInstallment}
                                            </span>
                                            {!isLoan && (
                                                <span className="text-[9px] text-gray-400 dark:text-gray-600 hidden sm:inline">
                                                    {t.loanDesc}
                                                </span>
                                            )}
                                        </div>
                                    </label>

                                    {isLoan && (
                                        <div className="animate-in fade-in slide-in-from-right-2 flex-1 max-w-[50%]">
                                            <label className="block text-[9px] text-gray-500 dark:text-gray-600 uppercase mb-0.5 text-right">{t.repaymentStart}</label>
                                            <input 
                                                type="date" 
                                                required
                                                value={planStartDate}
                                                onChange={e => setPlanStartDate(e.target.value)}
                                                className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 p-1 rounded text-xs focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-base shadow-lg transition-all mt-4">
                {initialData ? t.update : (isRecurring ? t.createPlan : t.addTransaction)}
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