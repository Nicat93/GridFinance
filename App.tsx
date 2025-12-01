import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, RecurringPlan, Frequency, FinancialSnapshot, SyncConfig, BackupData, SyncStatus } from './types';
import TransactionGrid from './components/TransactionGrid';
import SummaryBar from './components/SummaryBar';
import AddTransactionModal from './components/AddTransactionModal';
import PlanList from './components/PlanList';
import ConfirmModal from './components/ConfirmModal';
import SettingsModal from './components/SettingsModal';
import * as SupabaseService from './services/supabaseService';

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const addTime = (date: string | Date, freq: Frequency, count: number): Date => {
    let d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    if (isNaN(d.getTime())) d = new Date();
    const startDay = d.getDate();
    if (freq === Frequency.ONE_TIME) return d;
    if (freq === Frequency.WEEKLY) d.setDate(d.getDate() + (7 * count));
    if (freq === Frequency.MONTHLY) { d.setMonth(d.getMonth() + count); if (d.getDate() !== startDay) d.setDate(0); }
    if (freq === Frequency.YEARLY) { d.setFullYear(d.getFullYear() + count); if (d.getDate() !== startDay) d.setDate(0); }
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
  const [deletedIds, setDeletedIds] = useState<{ [id: string]: number }>(() => {
      const saved = localStorage.getItem('deletedIds');
      return saved ? JSON.parse(saved) : {};
  });
  
  // Initialize SyncConfig with Hardcoded Credentials
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
      const saved = localStorage.getItem('syncConfig');
      if (saved) return JSON.parse(saved);

      // Hardcoded credentials
      const envUrl = 'https://svfcmefotkyphvzhrkfj.supabase.co';
      const envKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZmNtZWZvdGt5cGh2emhya2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzE5NDgsImV4cCI6MjA4MDE0Nzk0OH0.u0cIFe7TZa1h59bizfsl5qm9bwTUYmQ8pYXsadLbvWo';

      return { 
          enabled: !!(envUrl && envKey), 
          supabaseUrl: envUrl, 
          supabaseKey: envKey, 
          syncId: '', 
          lastSyncedAt: 0 
      };
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
  });

  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | RecurringPlan | null>(null);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [shiftCycleDialog, setShiftCycleDialog] = useState<{ isOpen: boolean, planId: string, newDate: Date } | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const syncTimeoutRef = useRef<number | null>(null);

  // Persistence
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('cycleStartDay', cycleStartDay.toString()); }, [cycleStartDay]);
  useEffect(() => { localStorage.setItem('deletedIds', JSON.stringify(deletedIds)); }, [deletedIds]);
  useEffect(() => { localStorage.setItem('syncConfig', JSON.stringify(syncConfig)); }, [syncConfig]);
  useEffect(() => { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);

  // Apply Theme
  useEffect(() => {
      if (isDarkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [isDarkMode]);

  // Initialize Supabase
  useEffect(() => {
      if (syncConfig.enabled && syncConfig.supabaseUrl && syncConfig.supabaseKey) {
          SupabaseService.initSupabase(syncConfig.supabaseUrl, syncConfig.supabaseKey);
          setSyncStatus('syncing');
          triggerSync();
      } else {
          setSyncStatus('offline');
      }
  }, [syncConfig.enabled, syncConfig.supabaseUrl, syncConfig.supabaseKey]);

  // Auto Sync on Change (Debounced)
  useEffect(() => {
      if (!syncConfig.enabled) return;
      
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => {
          triggerSync();
      }, 3000); // 3 seconds debounce

      return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); }
  }, [transactions, plans, cycleStartDay, deletedIds]); // Trigger on any data change including deletions

  const triggerSync = async () => {
      if (!syncConfig.enabled || !syncConfig.syncId) return;
      
      try {
          // 1. Fetch Remote
          const remoteData = await SupabaseService.fetchRemoteData(syncConfig);
          
          let currentData: BackupData = { transactions, plans, cycleStartDay, lastModified: Date.now(), deletedIds };
          let mergedData = currentData;

          if (remoteData) {
              // 2. Merge
              mergedData = SupabaseService.mergeData(currentData, remoteData);
              // Update local if changed
              if (mergedData !== currentData) {
                  setTransactions(mergedData.transactions);
                  setPlans(mergedData.plans);
                  setCycleStartDay(mergedData.cycleStartDay);
                  if (mergedData.deletedIds) setDeletedIds(mergedData.deletedIds);
              }
          }

          // 3. Push
          const success = await SupabaseService.pushRemoteData(syncConfig, mergedData);
          if (success) {
              setSyncStatus('synced');
          } else {
              setSyncStatus('error');
          }
      } catch (e) {
          console.error("Sync loop error", e);
          setSyncStatus('error');
      }
  };

  const handleClearData = () => {
      if (window.confirm("Are you sure? This will delete all local transactions and plans. This cannot be undone.")) {
          setTransactions([]);
          setPlans([]);
          setDeletedIds({});
          setCycleStartDay(1);
          setIsSettingsOpen(false);
      }
  };

  const snapshot: FinancialSnapshot = useMemo(() => {
    const currentBalance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    const today = new Date(); today.setHours(0,0,0,0);
    const anchor = new Date(viewDate); anchor.setHours(0,0,0,0);
    let periodStart = new Date(anchor.getFullYear(), anchor.getMonth(), cycleStartDay);
    if (anchor.getDate() < cycleStartDay) {
        periodStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, cycleStartDay);
        if (periodStart.getDate() !== cycleStartDay) periodStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1 + 1, 0);
    } else {
         if (periodStart.getDate() !== cycleStartDay) periodStart = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    }
    const periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1); periodEnd.setDate(periodEnd.getDate() - 1); periodEnd.setHours(23, 59, 59, 999);
    let projectedBalance = currentBalance; let upcomingIncome = 0; let upcomingExpenses = 0;
    plans.forEach(plan => {
        let simDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated);
        let simCount = plan.occurrencesGenerated;
        let safety = 0;
        while (safety < 100) {
            safety++;
            const currentDate = new Date(simDate); currentDate.setHours(0,0,0,0);
            if (currentDate > periodEnd) break;
            if (plan.maxOccurrences && simCount >= plan.maxOccurrences) break;
            if (plan.endDate && currentDate > new Date(plan.endDate)) break;
            if (currentDate >= today) {
                if (plan.type === 'income') { upcomingIncome += plan.amount; projectedBalance += plan.amount; } 
                else { upcomingExpenses += plan.amount; projectedBalance -= plan.amount; }
            }
            simCount++; simDate = addTime(plan.startDate, plan.frequency, simCount);
            if (plan.frequency === Frequency.ONE_TIME) break;
        }
    });
    return { currentBalance, projectedBalance, upcomingIncome, upcomingExpenses, periodStart, periodEnd };
  }, [transactions, plans, cycleStartDay, viewDate]);

  const handleSaveData = (data: any) => {
    const now = Date.now();
    if (editingItem) {
        const isPlan = 'frequency' in editingItem;
        if (isPlan) {
             const updatedPlan = {
                ...editingItem,
                description: data.description, amount: data.amount, type: data.type, category: data.category,
                startDate: data.date, frequency: data.frequency, maxOccurrences: data.maxOccurrences, isInstallment: data.isInstallment,
                lastModified: now
            } as RecurringPlan;
            setPlans(prev => prev.map(p => p.id === editingItem.id ? updatedPlan : p));
        } else {
            const updatedTx = {
                ...editingItem,
                description: data.description, amount: data.amount, type: data.type, category: data.category, date: data.date,
                lastModified: now
            } as Transaction;
            setTransactions(prev => prev.map(t => t.id === editingItem.id ? updatedTx : t));
        }
        setEditingItem(null);
    } else {
        if (data.kind === 'single') {
            const newTx: Transaction = {
                id: generateId(), date: data.date, description: data.description, amount: data.amount,
                type: data.type, category: data.category, isPaid: true, lastModified: now
            };
            setTransactions(prev => [newTx, ...prev]);
        } else if (data.kind === 'plan') {
            const newPlan: RecurringPlan = {
                id: generateId(), description: data.description, amount: data.amount, type: data.type,
                frequency: data.frequency, startDate: data.date, occurrencesGenerated: 0, category: data.category,
                isInstallment: data.isInstallment, maxOccurrences: data.maxOccurrences, lastModified: now
            };
            setPlans(prev => [...prev, newPlan]);
        }
    }
  };

  const executePlanApplication = (planId: string, applyDate: Date) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const now = Date.now();
    const dateStr = applyDate.getFullYear() + '-' + String(applyDate.getMonth() + 1).padStart(2, '0') + '-' + String(applyDate.getDate()).padStart(2, '0');
    
    const newTx: Transaction = {
        id: generateId(), date: dateStr, description: `${plan.description} (${plan.occurrencesGenerated + 1})`,
        amount: plan.amount, type: plan.type, category: plan.category, isPaid: false, relatedPlanId: plan.id, lastModified: now
    };
    setTransactions(prev => [newTx, ...prev]);
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
  };

  const handleApplyPlanNow = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    if (plan.maxOccurrences && plan.occurrencesGenerated >= plan.maxOccurrences) { alert("Max payments reached."); return; }
    const newDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated); newDate.setHours(0,0,0,0);
    const currentPeriodEnd = new Date(snapshot.periodEnd); currentPeriodEnd.setHours(23, 59, 59, 999);
    const nextPeriodEnd = new Date(currentPeriodEnd); nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
    if (newDate > nextPeriodEnd) { alert(`Too far: ${newDate.toLocaleDateString()}`); return; }
    if (newDate > currentPeriodEnd) { setShiftCycleDialog({ isOpen: true, planId, newDate }); } 
    else { executePlanApplication(planId, newDate); }
  };

  const deleteTransaction = (id: string) => {
    const now = Date.now();
    const txToDelete = transactions.find(t => t.id === id);
    if (txToDelete && txToDelete.relatedPlanId) {
        setPlans(prev => prev.map(p => {
            if (p.id === txToDelete.relatedPlanId) return { ...p, occurrencesGenerated: Math.max(0, p.occurrencesGenerated - 1), lastModified: now };
            return p;
        }));
    }
    // Track Deletion for Sync
    setDeletedIds(prev => ({ ...prev, [id]: now }));
    setTransactions(prev => prev.filter(t => t.id !== id));
  };
  
  const deletePlan = (id: string) => { 
      // Track Deletion for Sync
      setDeletedIds(prev => ({ ...prev, [id]: Date.now() }));
      setPlans(prev => prev.filter(p => p.id !== id)); 
  };

  const handleUpdateBillingDate = (date: Date) => { setCycleStartDay(date.getDate()); setViewDate(date); };
  const handleConfirmShiftCycle = () => { if (shiftCycleDialog) { setCycleStartDay(shiftCycleDialog.newDate.getDate()); setViewDate(shiftCycleDialog.newDate); executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate); setShiftCycleDialog(null); } };
  const handleAlternativeKeepCycle = () => { if (shiftCycleDialog) { executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate); setShiftCycleDialog(null); } };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-300 font-sans transition-colors">
      <SummaryBar snapshot={snapshot} onUpdateDate={handleUpdateBillingDate} syncStatus={syncStatus} />
      <main className="max-w-4xl mx-auto px-4 pt-4">
        {plans.length > 0 && (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1 cursor-pointer group select-none" onClick={() => setShowPlanned(!showPlanned)}>
                    <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showPlanned ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">Planned</h3>
                </div>
                {showPlanned && <PlanList plans={plans} onDelete={deletePlan} onEdit={(p) => { setEditingItem(p); setIsModalOpen(true); }} onApplyNow={handleApplyPlanNow} />}
            </div>
        )}
        <div className="mb-20">
            <div className="flex items-center gap-2 mb-1 mt-4 cursor-pointer group select-none" onClick={() => setShowHistory(!showHistory)}>
                 <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                 <h1 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">History</h1>
            </div>
            {showHistory && <TransactionGrid transactions={transactions} onDelete={deleteTransaction} onEdit={(t) => { setEditingItem(t); setIsModalOpen(true); }} />}
        </div>
      </main>
      
      {/* FABs */}
      <button 
          onClick={() => setIsSettingsOpen(true)}
          className="fixed bottom-6 left-6 w-10 h-10 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40 border border-gray-300 dark:border-gray-700"
          title="Settings"
      >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
      </button>

      <button 
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light transition-transform hover:scale-105 active:scale-95 z-40 border border-indigo-400/30"
          title="Add Entry"
      >
          +
      </button>

      <AddTransactionModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSave={handleSaveData} initialData={editingItem} />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        syncConfig={syncConfig}
        onSaveSyncConfig={setSyncConfig}
        onClearData={handleClearData}
      />
      <ConfirmModal 
        isOpen={!!shiftCycleDialog} title="Next Billing Cycle?" message={`This payment (${shiftCycleDialog?.newDate.toLocaleDateString()}) falls in the next billing cycle. Shift cycle start to ${shiftCycleDialog?.newDate.getDate()}th?`}
        onConfirm={handleConfirmShiftCycle} confirmText="Yes, Shift Cycle" onAlternative={handleAlternativeKeepCycle} alternativeText="No, Keep Current" onCancel={() => setShiftCycleDialog(null)} cancelText="Cancel"
      />
    </div>
  );
}