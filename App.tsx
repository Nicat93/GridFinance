import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, RecurringPlan, Frequency, FinancialSnapshot } from './types';
import TransactionGrid from './components/TransactionGrid';
import SummaryBar from './components/SummaryBar';
import AddTransactionModal from './components/AddTransactionModal';
import PlanList from './components/PlanList';
import ConfirmModal from './components/ConfirmModal';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Robust date parsing to avoid timezone issues (YYYY-MM-DD -> Local 00:00)
const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    // Month is 0-indexed in JS Date
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const addTime = (date: string | Date, freq: Frequency, count: number): Date => {
    let d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    // Ensure we start with a clean date object
    if (isNaN(d.getTime())) d = new Date();
    
    // Capture original day to detect overflow
    const startDay = d.getDate();

    if (freq === Frequency.ONE_TIME) {
        return d;
    }

    if (freq === Frequency.WEEKLY) {
        d.setDate(d.getDate() + (7 * count));
    }
    if (freq === Frequency.MONTHLY) {
        d.setMonth(d.getMonth() + count);
        // Check for overflow
        if (d.getDate() !== startDay) {
            d.setDate(0);
        }
    }
    if (freq === Frequency.YEARLY) {
        d.setFullYear(d.getFullYear() + count);
        if (d.getDate() !== startDay) {
             d.setDate(0);
        }
    }
    return d;
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [plans, setPlans] = useState<RecurringPlan[]>(() => {
    const saved = localStorage.getItem('plans');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [cycleStartDay, setCycleStartDay] = useState<number>(() => {
      const saved = localStorage.getItem('cycleStartDay');
      return saved ? parseInt(saved, 10) : 1;
  });

  // Controls the 'anchor' date for the current view.
  const [viewDate, setViewDate] = useState<Date>(() => new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | RecurringPlan | null>(null);

  // Collapsible states
  const [showPlanned, setShowPlanned] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  // State for cycle shift confirmation
  const [shiftCycleDialog, setShiftCycleDialog] = useState<{ isOpen: boolean, planId: string, newDate: Date } | null>(null);

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('plans', JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
      localStorage.setItem('cycleStartDay', cycleStartDay.toString());
  }, [cycleStartDay]);

  const snapshot: FinancialSnapshot = useMemo(() => {
    const currentBalance = transactions.reduce((acc, t) => {
        return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const anchor = new Date(viewDate);
    anchor.setHours(0,0,0,0);
    
    let periodStart = new Date(anchor.getFullYear(), anchor.getMonth(), cycleStartDay);
    
    if (anchor.getDate() < cycleStartDay) {
        periodStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, cycleStartDay);
        if (periodStart.getDate() !== cycleStartDay) {
             periodStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1 + 1, 0);
        }
    } else {
         if (periodStart.getDate() !== cycleStartDay) {
            periodStart = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
         }
    }
    
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    periodEnd.setHours(23, 59, 59, 999);

    let projectedBalance = currentBalance;
    let upcomingIncome = 0;
    let upcomingExpenses = 0;

    plans.forEach(plan => {
        let simDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated);
        let simCount = plan.occurrencesGenerated;
        
        let safety = 0;
        while (safety < 100) {
            safety++;
            const currentDate = new Date(simDate);
            currentDate.setHours(0,0,0,0);

            if (currentDate > periodEnd) break;

            if (plan.maxOccurrences && simCount >= plan.maxOccurrences) break;
            if (plan.endDate && currentDate > new Date(plan.endDate)) break;

            if (currentDate >= today) {
                if (plan.type === 'income') {
                    upcomingIncome += plan.amount;
                    projectedBalance += plan.amount;
                } else {
                    upcomingExpenses += plan.amount;
                    projectedBalance -= plan.amount;
                }
            }
            
            simCount++;
            simDate = addTime(plan.startDate, plan.frequency, simCount);
            if (plan.frequency === Frequency.ONE_TIME) break;
        }
    });

    return { currentBalance, projectedBalance, upcomingIncome, upcomingExpenses, periodStart, periodEnd };
  }, [transactions, plans, cycleStartDay, viewDate]);

  const handleSaveData = (data: any) => {
    if (editingItem) {
        const isPlan = 'frequency' in editingItem;
        
        if (isPlan) {
             const updatedPlan = {
                ...editingItem,
                description: data.description,
                amount: data.amount,
                type: data.type,
                category: data.category,
                startDate: data.date, 
                frequency: data.frequency,
                maxOccurrences: data.maxOccurrences,
                isInstallment: data.isInstallment
            } as RecurringPlan;
            setPlans(prev => prev.map(p => p.id === editingItem.id ? updatedPlan : p));
        } else {
            const updatedTx = {
                ...editingItem,
                description: data.description,
                amount: data.amount,
                type: data.type,
                category: data.category,
                date: data.date
            } as Transaction;
            setTransactions(prev => prev.map(t => t.id === editingItem.id ? updatedTx : t));
        }
        setEditingItem(null);
    } else {
        if (data.kind === 'single') {
            const newTx: Transaction = {
                id: generateId(),
                date: data.date,
                description: data.description,
                amount: data.amount,
                type: data.type,
                category: data.category,
                isPaid: true
            };
            setTransactions(prev => [newTx, ...prev]);
        } else if (data.kind === 'plan') {
            const newPlan: RecurringPlan = {
                id: generateId(),
                description: data.description,
                amount: data.amount,
                type: data.type,
                frequency: data.frequency,
                startDate: data.date,
                occurrencesGenerated: 0,
                category: data.category,
                isInstallment: data.isInstallment,
                maxOccurrences: data.maxOccurrences
            };
            setPlans(prev => [...prev, newPlan]);
        }
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
      setEditingItem(tx);
      setIsModalOpen(true);
  };

  const handleEditPlan = (plan: RecurringPlan) => {
      setEditingItem(plan);
      setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingItem(null);
  };

  const handleUpdateBillingDate = (date: Date) => {
      setCycleStartDay(date.getDate());
      setViewDate(date);
  };

  const executePlanApplication = (planId: string, applyDate: Date) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    const dateStr = applyDate.getFullYear() + '-' + String(applyDate.getMonth() + 1).padStart(2, '0') + '-' + String(applyDate.getDate()).padStart(2, '0');

    const newTx: Transaction = {
        id: generateId(),
        date: dateStr,
        description: `${plan.description} (${plan.occurrencesGenerated + 1})`,
        amount: plan.amount,
        type: plan.type,
        category: plan.category,
        isPaid: false, 
        relatedPlanId: plan.id
    };

    setTransactions(prev => [newTx, ...prev]);
    
    setPlans(prev => prev.map(p => 
        p.id === planId 
        ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1 }
        : p
    ));
  };

  const handleApplyPlanNow = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (plan.maxOccurrences && plan.occurrencesGenerated >= plan.maxOccurrences) {
        alert("Max payments reached for this plan.");
        return;
    }

    const newDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated);
    newDate.setHours(0,0,0,0);
    
    const currentPeriodEnd = new Date(snapshot.periodEnd);
    currentPeriodEnd.setHours(23, 59, 59, 999);
    
    const nextPeriodEnd = new Date(currentPeriodEnd);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    
    if (newDate > nextPeriodEnd) {
        alert(`Cannot apply this payment yet. It is due on ${newDate.toLocaleDateString()}, which is beyond the next billing cycle.`);
        return;
    }
    
    if (newDate > currentPeriodEnd) {
        setShiftCycleDialog({
            isOpen: true,
            planId,
            newDate
        });
    } else {
        executePlanApplication(planId, newDate);
    }
  };

  const handleConfirmShiftCycle = () => {
      if (shiftCycleDialog) {
          const day = shiftCycleDialog.newDate.getDate();
          setCycleStartDay(day);
          setViewDate(shiftCycleDialog.newDate);
          executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate);
          setShiftCycleDialog(null);
      }
  };

  const handleAlternativeKeepCycle = () => {
      if (shiftCycleDialog) {
          executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate);
          setShiftCycleDialog(null);
      }
  };

  const handleAbort = () => {
      setShiftCycleDialog(null);
  };

  const deleteTransaction = (id: string) => {
    const txToDelete = transactions.find(t => t.id === id);

    if (txToDelete && txToDelete.relatedPlanId) {
        setPlans(prev => prev.map(p => {
            if (p.id === txToDelete.relatedPlanId) {
                return {
                    ...p,
                    occurrencesGenerated: Math.max(0, p.occurrencesGenerated - 1)
                };
            }
            return p;
        }));
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const deletePlan = (id: string) => {
      setPlans(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen pb-20 bg-black text-gray-300 font-sans">
      <SummaryBar 
        snapshot={snapshot} 
        onUpdateDate={handleUpdateBillingDate}
      />

      <main className="max-w-4xl mx-auto px-4 pt-4">
        
        {/* Planned Section */}
        {plans.length > 0 && (
            <div className="mb-4">
                <div 
                    className="flex items-center gap-2 mb-1 cursor-pointer group select-none"
                    onClick={() => setShowPlanned(!showPlanned)}
                >
                    <svg 
                        className="w-2.5 h-2.5 text-gray-600 transition-transform duration-200" 
                        style={{ transform: showPlanned ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">Planned</h3>
                </div>
                
                {showPlanned && (
                    <PlanList 
                        plans={plans} 
                        onDelete={deletePlan} 
                        onEdit={handleEditPlan}
                        onApplyNow={handleApplyPlanNow}
                    />
                )}
            </div>
        )}

        {/* History Section */}
        <div className="mb-20">
            <div 
                className="flex items-center gap-2 mb-1 mt-4 cursor-pointer group select-none"
                onClick={() => setShowHistory(!showHistory)}
            >
                 <svg 
                        className="w-2.5 h-2.5 text-gray-600 transition-transform duration-200" 
                        style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                 <h1 className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-200 transition-colors">History</h1>
            </div>

            {showHistory && (
                <TransactionGrid 
                    transactions={transactions} 
                    onDelete={deleteTransaction} 
                    onEdit={handleEditTransaction}
                />
            )}
        </div>
      </main>

      <button 
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light transition-transform hover:scale-105 active:scale-95 z-40 border border-indigo-400/30"
          title="Add Entry"
      >
          +
      </button>

      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSaveData} 
        initialData={editingItem}
      />

      <ConfirmModal 
        isOpen={!!shiftCycleDialog}
        title="Next Billing Cycle?"
        message={`This payment (${shiftCycleDialog?.newDate.toLocaleDateString()}) falls in the next billing cycle. Do you want to shift your billing start day to the ${shiftCycleDialog?.newDate.getDate()}th?`}
        onConfirm={handleConfirmShiftCycle}
        confirmText="Yes, Shift Cycle"
        onAlternative={handleAlternativeKeepCycle}
        alternativeText="No, Keep Current"
        onCancel={handleAbort}
        cancelText="Cancel"
      />
    </div>
  );
}