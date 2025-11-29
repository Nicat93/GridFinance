import React, { useState, useEffect } from 'react';
import { Frequency, TransactionType, Transaction, RecurringPlan } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Transaction | RecurringPlan | null;
}

const AddTransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Unified logic
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.MONTHLY);
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);

  // Load initial data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setAmount(initialData.amount.toString());
        setDescription(initialData.description);
        setCategory(initialData.category);
        
        // Detect if it is a Plan
        if ('frequency' in initialData) {
            const plan = initialData as RecurringPlan;
            setDate(plan.startDate);
            setIsRecurring(true);
            setFrequency(plan.frequency);
            setMaxOccurrences(plan.maxOccurrences ? plan.maxOccurrences.toString() : '');
            setIsInstallment(plan.isInstallment);
        } else {
            // It is a Transaction
            const tx = initialData as Transaction;
            setDate(tx.date);
            setIsRecurring(false);
            setFrequency(Frequency.MONTHLY);
            setMaxOccurrences('');
            setIsInstallment(false);
        }
      } else {
        // Reset defaults for new entry
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory('General');
        setDate(new Date().toISOString().split('T')[0]);
        setIsRecurring(false);
        setFrequency(Frequency.MONTHLY);
        setMaxOccurrences('');
        setIsInstallment(false);
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseData = {
      description,
      amount: parseFloat(amount),
      type,
      category,
      date, 
    };

    if (isRecurring) {
        onSave({
            ...baseData,
            kind: 'plan',
            frequency,
            maxOccurrences: maxOccurrences ? parseInt(maxOccurrences) : undefined,
            isInstallment
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
          // If switching away from one-time, clear it if it was 1, or leave it
          if (maxOccurrences === '1') setMaxOccurrences('');
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-gray-950 border border-gray-800 w-full max-w-sm rounded shadow-2xl flex flex-col">
        <div className="p-4 border-b border-gray-900 flex justify-between items-center">
            <h2 className="text-gray-200 font-bold text-base uppercase tracking-wide">
                {initialData ? (isRecurring ? 'Edit Plan' : 'Edit Entry') : 'New Entry'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Top Row: Amount (First) and Type (Second) */}
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex-1 min-w-[120px]">
                <input 
                    type="number" 
                    step="0.01" 
                    required
                    autoFocus
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 text-white px-3 py-2 rounded text-left font-mono text-xl focus:border-indigo-500 focus:outline-none"
                    placeholder="0.00"
                />
             </div>

             <div className="flex bg-gray-900 rounded p-1 h-10 border border-gray-800 shrink-0">
                <button 
                  type="button"
                  onClick={() => setType('expense')}
                  className={`px-3 text-sm font-bold rounded transition-colors ${type === 'expense' ? 'bg-rose-900 text-rose-200' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  - Exp
                </button>
                <div className="w-px bg-gray-800 mx-1"></div>
                <button 
                  type="button"
                  onClick={() => setType('income')}
                  className={`px-3 text-sm font-bold rounded transition-colors ${type === 'income' ? 'bg-emerald-900 text-emerald-200' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  + Inc
                </button>
             </div>
          </div>

          <input 
            type="text" 
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 text-gray-300 px-3 py-2 rounded text-base focus:border-indigo-500 focus:outline-none"
            placeholder="Description (e.g. Rent)"
          />

          <div className="grid grid-cols-2 gap-3">
            <input 
                type="text" 
                list="categories"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Category"
            />
            <input 
                type="date" 
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-gray-400 px-3 py-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          
          <datalist id="categories">
            <option value="Food" />
            <option value="Housing" />
            <option value="Transport" />
            <option value="Salary" />
          </datalist>

          {/* Recurrence Section - Allow toggling if not editing a single transaction, or enable modifying if already a plan */}
          <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={isRecurring} 
                        // Only allow toggling if we are creating new, or if it is already a plan.
                        // We prevent converting a single transaction to a plan in edit mode for simplicity.
                        disabled={!!initialData && !('frequency' in initialData)} 
                        onChange={e => setIsRecurring(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className={`text-sm select-none ${!!initialData && !('frequency' in initialData) ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-300'}`}>
                        Planned
                    </span>
                </label>

                {isRecurring && (
                    <div className="mt-3 p-3 bg-gray-900/50 border border-gray-800 rounded space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-600 uppercase mb-1">Frequency</label>
                                <select 
                                    value={frequency}
                                    onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
                                    className="w-full bg-gray-950 border border-gray-700 text-gray-300 p-1.5 rounded text-sm focus:outline-none"
                                >
                                    <option value={Frequency.ONE_TIME}>One-time</option>
                                    <option value={Frequency.WEEKLY}>Weekly</option>
                                    <option value={Frequency.MONTHLY}>Monthly</option>
                                    <option value={Frequency.YEARLY}>Yearly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 uppercase mb-1">Total Payments</label>
                                <input 
                                    type="number" 
                                    placeholder="∞"
                                    value={maxOccurrences}
                                    onChange={e => setMaxOccurrences(e.target.value)}
                                    disabled={frequency === Frequency.ONE_TIME}
                                    className="w-full bg-gray-950 border border-gray-700 text-gray-300 p-1.5 rounded text-sm font-mono focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={isInstallment} 
                                onChange={e => setIsInstallment(e.target.checked)}
                                className="w-3 h-3 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-0"
                            />
                            <span className="text-xs text-gray-500 select-none">Tag as Installment/Loan</span>
                        </label>
                    </div>
                )}
            </div>

          <button type="submit" className="w-full bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 font-bold py-2.5 rounded text-base shadow-lg transition-all border border-indigo-700/50 mt-4">
             {initialData ? 'Update' : (isRecurring ? 'Create Plan' : 'Add Transaction')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;