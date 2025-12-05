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
  const [planStartDate, setPlanStartDate] = useState(''); 

  // Calculator State
  const [calcTarget, setCalcTarget] = useState<'amount' | 'maxOccurrences' | null>(null);

  // Tag Dropdown State
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagContainerRef = useRef<HTMLDivElement>(null);
  
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

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagContainerRef.current && !tagContainerRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    if (isTagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setAmount(initialData.amount.toString());
        setDescription(initialData.description || '');
        setSelectedTags(initialData.tags || []);
        
        if ('frequency' in initialData) {
            const plan = initialData as RecurringPlan;
            setDate(plan.startDate);
            setPlanStartDate(plan.startDate);
            setIsRecurring(true);
            setFrequency(plan.frequency);
            setMaxOccurrences(plan.maxOccurrences ? plan.maxOccurrences.toString() : '');
            setIsLoan(false); 
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
            planStartDate: isLoan ? planStartDate : undefined 
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
          if (tagInput.trim()) {
            addTag(tagInput);
          }
      }
  };

  // Sort: Matches first, then alphabetical
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(tagInput.toLowerCase()) &&
    !selectedTags.includes(c.name)
  ).sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(tagInput.toLowerCase());
      const bStarts = b.name.toLowerCase().startsWith(tagInput.toLowerCase());
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
  });

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative" ref={tagContainerRef}>
                    {selectedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {selectedTags.map(tag => {
                                const def = categories.find(c => c.name.toLowerCase() === tag.toLowerCase());
                                const color = def ? def.color : pickColorForString(tag);
                                const style = getColorStyle(color);
                                return (
                                    <span key={tag} className={`px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1 ${style.className}`} style={style.style}>
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-black/50">×</button>
                                    </span>
                                )
                            })}
                        </div>
                    )}
                    
                    <div>
                         <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => { setTagInput(e.target.value); setIsTagDropdownOpen(true); }}
                            onKeyDown={handleTagInputKeyDown}
                            onFocus={() => setIsTagDropdownOpen(true)}
                            placeholder={t.categoryPlaceholder}
                            className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                         />
                    </div>

                    {isTagDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mt-1 rounded shadow-lg max-h-40 overflow-y-auto">
                            {filteredCategories.map(cat => (
                                <div 
                                    key={cat.id} 
                                    onClick={() => addTag(cat.name)}
                                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm flex items-center gap-2"
                                >
                                    <div className={`w-2 h-2 rounded-full ${getColorStyle(cat.color).className}`} style={getColorStyle(cat.color).style}></div>
                                    <span className="text-gray-800 dark:text-gray-200">{cat.name}</span>
                                </div>
                            ))}

                            {/* Show "Add new" if user is typing something that doesn't perfectly match an existing category */}
                            {tagInput && !filteredCategories.some(c => c.name.toLowerCase() === tagInput.toLowerCase()) && (
                                <div 
                                    onClick={() => addTag(tagInput)}
                                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm text-indigo-600 dark:text-indigo-400 font-bold border-t border-gray-100 dark:border-gray-800"
                                >
                                    + {t.add} "{tagInput}"
                                </div>
                            )}

                            {filteredCategories.length === 0 && !tagInput && (
                                <div className="px-3 py-2 text-xs text-gray-400 italic">
                                    {t.noTags}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <input 
                        type="date" 
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-300 px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg space-y-3 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{t.plannedRecurring}</span>
                    <input 
                        type="checkbox" 
                        checked={isRecurring}
                        onChange={e => setIsRecurring(e.target.checked)}
                        className="w-5 h-5 accent-indigo-600"
                    />
                </div>

                {isRecurring && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 pt-2">
                        <div>
                             <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t.frequency}</label>
                             <div className="flex rounded-md shadow-sm">
                                {[Frequency.WEEKLY, Frequency.MONTHLY, Frequency.YEARLY, Frequency.ONE_TIME].map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => handleFrequencyChange(f)}
                                        className={`flex-1 px-2 py-1.5 text-[10px] sm:text-xs font-medium border border-gray-200 dark:border-gray-700 first:rounded-l-md last:rounded-r-md 
                                            ${frequency === f 
                                                ? 'bg-indigo-600 text-white border-indigo-600 z-10' 
                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                             </div>
                        </div>

                        {frequency !== Frequency.ONE_TIME && (
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t.totalPayments} (Optional)</label>
                                    <input 
                                        type="number" 
                                        value={maxOccurrences}
                                        onChange={e => setMaxOccurrences(e.target.value)}
                                        onClick={() => setCalcTarget('maxOccurrences')}
                                        placeholder="∞"
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <input 
                                    type="checkbox" 
                                    id="isLoan"
                                    checked={isLoan}
                                    onChange={e => setIsLoan(e.target.checked)}
                                    className="accent-indigo-600"
                                />
                                <label htmlFor="isLoan" className="text-sm text-gray-700 dark:text-gray-300 font-medium cursor-pointer">{t.loanInstallment}</label>
                            </div>
                            {isLoan && (
                                <div className="pl-6 space-y-2">
                                    <p className="text-[10px] text-gray-500 italic">
                                        {t.loanDesc}
                                    </p>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t.repaymentStart}</label>
                                        <input 
                                            type="date" 
                                            value={planStartDate}
                                            onChange={e => setPlanStartDate(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-2">
                <button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold text-lg shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                    {initialData ? t.update : (isRecurring ? t.createPlan : t.addTransaction)}
                </button>
            </div>

            </form>
        </div>
        </div>

        <CalculatorSheet 
            isOpen={calcTarget !== null} 
            initialValue={calcTarget === 'amount' ? amount : maxOccurrences}
            onClose={() => setCalcTarget(null)} 
            onApply={handleCalculatorApply} 
        />
    </>
  );
};

export default AddTransactionModal;