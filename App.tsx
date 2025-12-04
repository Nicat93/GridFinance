import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Transaction, RecurringPlan, Frequency, FinancialSnapshot, SyncConfig, BackupData, SyncStatus, TransactionType, SortOption } from './types';
import TransactionGrid from './components/TransactionGrid';
import SummaryBar from './components/SummaryBar';
import AddTransactionModal from './components/AddTransactionModal';
import PlanList from './components/PlanList';
import ConfirmModal from './components/ConfirmModal';
import SettingsModal from './components/SettingsModal';
import PeriodTransitionModal from './components/PeriodTransitionModal';
import FilterBar from './components/FilterBar';
import DesignDebugger, { DesignConfig } from './components/DesignDebugger';
import * as SupabaseService from './services/supabaseService';
import { APP_VERSION } from './version';

// --- Utility Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

/** Parses a 'YYYY-MM-DD' string into a local Date object (midnight) */
const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

/**
 * Calculates a future date based on a start date, frequency, and number of occurrences.
 * Handles edge cases like Month/Year overflow (e.g., Jan 31 + 1 month -> Feb 28/29).
 */
const addTime = (date: string | Date, freq: Frequency, count: number): Date => {
    let d = typeof date === 'string' ? parseLocalDate(date) : new Date(date);
    if (isNaN(d.getTime())) d = new Date();
    const startDay = d.getDate();

    if (freq === Frequency.ONE_TIME) return d;
    if (freq === Frequency.WEEKLY) d.setDate(d.getDate() + (7 * count));
    if (freq === Frequency.MONTHLY) { 
        d.setMonth(d.getMonth() + count); 
        // Adjustment for months with fewer days (e.g. Jan 31 -> Feb 28)
        if (d.getDate() !== startDay) d.setDate(0); 
    }
    if (freq === Frequency.YEARLY) { 
        d.setFullYear(d.getFullYear() + count); 
        if (d.getDate() !== startDay) d.setDate(0); 
    }
    return d;
};

// --- Main Component ---

export default function App() {
  // --- State: Data ---
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    let parsed: any[] = saved ? JSON.parse(saved) : [];
    // Migration: Map old 'name' to 'description' if present
    return parsed.map((t: any) => {
        // If coming from version with 'name', prefer name as description
        const desc = t.name || t.description || 'Unknown';
        // Clean up object by removing name property if it exists
        const { name, ...rest } = t;
        return {
            ...rest,
            description: desc
        };
    });
  });
  
  const [plans, setPlans] = useState<RecurringPlan[]>(() => {
    const saved = localStorage.getItem('plans');
    let parsed: any[] = saved ? JSON.parse(saved) : [];
    // Migration
    return parsed.map((p: any) => {
        const desc = p.name || p.description || 'Unknown';
        const { name, ...rest } = p;
        return {
            ...rest,
            description: desc
        };
    });
  });

  const [cycleStartDay, setCycleStartDay] = useState<number>(() => {
      const saved = localStorage.getItem('cycleStartDay');
      return saved ? parseInt(saved, 10) : 1;
  });

  const [deletedIds, setDeletedIds] = useState<{ [id: string]: number }>(() => {
      const saved = localStorage.getItem('deletedIds');
      return saved ? JSON.parse(saved) : {};
  });
  
  // --- State: Sync Config ---
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
      const saved = localStorage.getItem('syncConfig');
      if (saved) return JSON.parse(saved);

      // Default Demo Credentials
      const envUrl = 'https://svfcmefotkyphvzhrkfj.supabase.co';
      const envKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZmNtZWZvdGt5cGh2emhya2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzE5NDgsImV4cCI6MjA4MDE0Nzk0OH0.u0cIFe7TZa1h59bizfsl5qm9bwTUYmQ8pYXsadLbvWo';

      return { 
          enabled: false, 
          supabaseUrl: envUrl, 
          supabaseKey: envKey, 
          syncId: '', 
          lastSyncedAt: 0 
      };
  });

  // --- State: UI ---
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
  
  // Global Filter/Sort State
  const [filterText, setFilterText] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date_asc'); 
  
  // Design Debugger State
  const [showDesignDebug, setShowDesignDebug] = useState(false);
  // Default: 11px font, reduced padding (0.1rem)
  const [designConfig, setDesignConfig] = useState<DesignConfig>({ fontSize: 11, paddingY: 0.1 });

  // Dialog state for "Apply Now" edge case where date falls in next cycle
  const [shiftCycleDialog, setShiftCycleDialog] = useState<{ isOpen: boolean, planId: string, newDate: Date } | null>(null);

  // Transition Dialog State
  const [transitionState, setTransitionState] = useState<{ 
    isOpen: boolean, 
    targetDate: Date, 
    pendingItems: { plan: RecurringPlan, due: Date }[] 
  } | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const isFirstMount = useRef(true);

  // --- Derived State ---
  const uniqueCategories = useMemo(() => {
      const cats = new Set<string>();
      // Pre-populate with defaults
      ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Salary', 'Freelance'].forEach(c => cats.add(c));
      transactions.forEach(t => { if(t.category) cats.add(t.category) });
      plans.forEach(p => { if(p.category) cats.add(p.category) });
      return Array.from(cats).sort();
  }, [transactions, plans]);

  // --- Effects: Persistence ---
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('cycleStartDay', cycleStartDay.toString()); }, [cycleStartDay]);
  useEffect(() => { localStorage.setItem('deletedIds', JSON.stringify(deletedIds)); }, [deletedIds]);
  useEffect(() => { localStorage.setItem('syncConfig', JSON.stringify(syncConfig)); }, [syncConfig]);
  useEffect(() => { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);

  // --- Effects: Theme ---
  useEffect(() => {
      if (isDarkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // --- Sync Logic ---

  // Ref to hold current state for async operations to avoid stale closures
  const stateRef = useRef({ transactions, plans, cycleStartDay, deletedIds, syncConfig });
  useEffect(() => {
      stateRef.current = { transactions, plans, cycleStartDay, deletedIds, syncConfig };
  }, [transactions, plans, cycleStartDay, deletedIds, syncConfig]);

  /**
   * Optimized Delta Sync Function
   */
  const triggerSync = useCallback(async () => {
      // Read latest config from ref
      const currentConfig = stateRef.current.syncConfig;
      
      if (!currentConfig.enabled || !currentConfig.syncId) return;
      if (isSyncingRef.current) return;
      
      isSyncingRef.current = true;
      setSyncStatus('syncing');
      
      const currentLocalState = stateRef.current;
      const lastSyncedAt = currentConfig.lastSyncedAt || 0;
      const syncStartTime = Date.now();

      try {
          // 1. PULL Deltas (Only items changed on server since lastSyncedAt)
          const remoteChanges = await SupabaseService.pullChanges(currentConfig, lastSyncedAt);
          
          let mergedTransactions = currentLocalState.transactions;
          let mergedPlans = currentLocalState.plans;
          let mergedDeletedIds = currentLocalState.deletedIds;
          let mergedCycleDay = currentLocalState.cycleStartDay;

          // 2. MERGE
          if (remoteChanges) {
              const merged = SupabaseService.mergeDeltas(
                  { 
                      transactions: currentLocalState.transactions, 
                      plans: currentLocalState.plans, 
                      cycleStartDay: currentLocalState.cycleStartDay, 
                      deletedIds: currentLocalState.deletedIds,
                      lastModified: 0 
                  }, 
                  remoteChanges
              );
              
              mergedTransactions = merged.transactions;
              mergedPlans = merged.plans;
              mergedDeletedIds = merged.deletedIds || {};
              mergedCycleDay = merged.cycleStartDay;

              // Update State if changed
              const hasChanges = 
                  mergedTransactions.length !== currentLocalState.transactions.length ||
                  JSON.stringify(mergedTransactions) !== JSON.stringify(currentLocalState.transactions) ||
                  JSON.stringify(mergedPlans) !== JSON.stringify(currentLocalState.plans) ||
                  mergedCycleDay !== currentLocalState.cycleStartDay;

              if (hasChanges) {
                  setTransactions(mergedTransactions);
                  setPlans(mergedPlans);
                  setCycleStartDay(mergedCycleDay);
                  setDeletedIds(mergedDeletedIds);
              }
          }

          // 3. PUSH Deltas (Only items changed locally since lastSyncedAt)
          const success = await SupabaseService.pushChanges(
              currentConfig, 
              mergedTransactions, 
              mergedPlans, 
              mergedDeletedIds, 
              mergedCycleDay,
              lastSyncedAt
          );

          if (success) {
            setSyncStatus('synced');
            // Update timestamp so next sync only fetches updates after this point
            setSyncConfig(prev => ({ ...prev, lastSyncedAt: syncStartTime }));
          } else {
            setSyncStatus('error');
          }

      } catch (e) {
          console.error("Sync loop error", e);
          setSyncStatus('error');
      } finally {
          isSyncingRef.current = false;
      }
  }, []); // Stable function, depends on nothing (reads refs)

  // Initialize Client & Trigger Initial Sync
  useEffect(() => {
      if (syncConfig.enabled && syncConfig.supabaseUrl && syncConfig.supabaseKey) {
          // Initialize Supabase client
          SupabaseService.initSupabase(syncConfig.supabaseUrl, syncConfig.supabaseKey);
          
          // Trigger initial sync after initialization
          triggerSync();
      } else {
          setSyncStatus('offline');
      }
  }, [syncConfig.enabled, syncConfig.supabaseUrl, syncConfig.supabaseKey, syncConfig.syncId, triggerSync]);

  // Auto Sync on Data Change (Debounced)
  useEffect(() => {
      // Skip the first mount to prevent double-syncing (since Init effect handles it)
      if (isFirstMount.current) {
          isFirstMount.current = false;
          return;
      }

      if (!syncConfig.enabled) return;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      
      syncTimeoutRef.current = window.setTimeout(() => {
          triggerSync();
      }, 3000); // 3 seconds debounce

      return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); }
  }, [transactions, plans, cycleStartDay, deletedIds, triggerSync, syncConfig.enabled]); 

  // Auto Sync on Visibility Change (App Open / Foreground)
  useEffect(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && syncConfig.enabled) {
              console.log("App foregrounded: Triggering sync...");
              triggerSync();
          }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);

      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleVisibilityChange);
      };
  }, [syncConfig.enabled, triggerSync]);

  // --- Logic: Financial Snapshot Calculation ---

  const calculatePeriod = (anchor: Date, startDay: number) => {
    const d = new Date(anchor); d.setHours(0,0,0,0);
    let start = new Date(d.getFullYear(), d.getMonth(), startDay);
    if (d.getDate() < startDay) {
        start = new Date(d.getFullYear(), d.getMonth() - 1, startDay);
        if (start.getDate() !== startDay) start = new Date(d.getFullYear(), d.getMonth() - 1 + 1, 0);
    } else {
        if (start.getDate() !== startDay) start = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    const end = new Date(start); 
    end.setMonth(end.getMonth() + 1); 
    end.setDate(end.getDate() - 1); 
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const snapshot: FinancialSnapshot = useMemo(() => {
    const currentBalance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    const { start: periodStart, end: periodEnd } = calculatePeriod(viewDate, cycleStartDay);

    let projectedBalance = currentBalance; 
    let upcomingIncome = 0; 
    let upcomingExpenses = 0;

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
            
            // Only add if inside period window (or unapplied past items in this cycle)
            if (currentDate >= periodStart) {
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

  // --- Handlers: Data Mutation ---

  const handleClearData = () => {
      if (window.confirm("Are you sure? This will delete all local transactions and plans. This cannot be undone.")) {
          setTransactions([]);
          setPlans([]);
          setDeletedIds({});
          setCycleStartDay(1);
          setSyncConfig(prev => ({ ...prev, lastSyncedAt: 0 }));
      }
  };

  const handleAddMockData = () => {
      const newTxs: Transaction[] = [];
      const newPlans: RecurringPlan[] = [];
      const now = Date.now();
      const categories = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Salary', 'Freelance'];
      const freqs: Frequency[] = [Frequency.MONTHLY, Frequency.WEEKLY, Frequency.YEARLY, Frequency.ONE_TIME];

      for (let i = 0; i < 200; i++) {
          const type = Math.random() > 0.7 ? 'income' : 'expense';
          const desc = `Mock ${type === 'income' ? 'Income' : 'Expense'} ${i}`;
          newTxs.push({
              id: generateId(),
              date: new Date(Date.now() - Math.random() * 31536000000).toISOString().split('T')[0], // Last year
              description: desc,
              amount: parseFloat((Math.random() * 1000).toFixed(2)),
              type: type,
              category: categories[Math.floor(Math.random() * categories.length)],
              isPaid: true,
              lastModified: now
          });

          newPlans.push({
              id: generateId(),
              description: `Plan ${desc}`,
              amount: parseFloat((Math.random() * 500).toFixed(2)),
              type: type,
              frequency: freqs[Math.floor(Math.random() * freqs.length)],
              startDate: new Date(Date.now() + Math.random() * 31536000000).toISOString().split('T')[0], // Next year
              occurrencesGenerated: 0,
              category: categories[Math.floor(Math.random() * categories.length)],
              maxOccurrences: Math.random() > 0.8 ? 12 : undefined,
              lastModified: now
          });
      }

      setTransactions(prev => [...prev, ...newTxs]);
      setPlans(prev => [...prev, ...newPlans]);
      alert("Added 200 mock transactions and 200 mock plans.");
  };

  const handleExportData = () => {
    const data = {
        transactions,
        plans,
        cycleStartDay,
        deletedIds,
        exportDate: new Date().toISOString(),
        version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grid-finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = async (file: File) => {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.transactions) || !Array.isArray(data.plans)) {
            alert("Invalid backup file format.");
            return;
        }
        if (window.confirm(`Found ${data.transactions.length} transactions and ${data.plans.length} plans. This will OVERWRITE your current local data. Continue?`)) {
            // Migration during import
            const importedTx = data.transactions.map((t: any) => {
                 const desc = t.name || t.description || 'Unknown';
                 const { name, ...rest } = t;
                 return { ...rest, description: desc };
            });
             const importedPlans = data.plans.map((p: any) => {
                 const desc = p.name || p.description || 'Unknown';
                 const { name, ...rest } = p;
                 return { ...rest, description: desc };
            });

            setTransactions(importedTx);
            setPlans(importedPlans);
            if (data.cycleStartDay) setCycleStartDay(data.cycleStartDay);
            if (data.deletedIds) setDeletedIds(data.deletedIds);
            setSyncConfig(prev => ({ ...prev, lastSyncedAt: 0 }));
            setIsSettingsOpen(false);
            alert("Import successful.");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to parse backup file.");
    }
  };

  const handleSaveSyncConfig = (newConfig: SyncConfig) => {
    if (newConfig.syncId !== syncConfig.syncId) {
        setTransactions([]);
        setPlans([]);
        setDeletedIds({});
        setCycleStartDay(1);
    }
    setSyncConfig(newConfig);
  };

  const handleSaveData = (data: any) => {
    const now = Date.now();
    const finalDescription = data.description?.trim() || 'Unknown';

    if (editingItem) {
        const isPlan = 'frequency' in editingItem;
        if (isPlan) {
             const updatedPlan = {
                ...editingItem,
                description: finalDescription, amount: data.amount, type: data.type, category: data.category,
                startDate: data.date, frequency: data.frequency, maxOccurrences: data.maxOccurrences,
                lastModified: now
            } as RecurringPlan;
            setPlans(prev => prev.map(p => p.id === editingItem.id ? updatedPlan : p));
        } else {
            const updatedTx = {
                ...editingItem,
                description: finalDescription, amount: data.amount, type: data.type, category: data.category, date: data.date,
                lastModified: now
            } as Transaction;
            setTransactions(prev => prev.map(t => t.id === editingItem.id ? updatedTx : t));
        }
        setEditingItem(null);
    } else {
        if (data.kind === 'single') {
            const newTx: Transaction = {
                id: generateId(), date: data.date, description: finalDescription, amount: data.amount,
                type: data.type, category: data.category, isPaid: true, lastModified: now
            };
            setTransactions(prev => [newTx, ...prev]);
        } else if (data.kind === 'plan') {
            const newPlan: RecurringPlan = {
                id: generateId(), description: finalDescription, amount: data.amount, type: data.type,
                frequency: data.frequency, startDate: data.date, occurrencesGenerated: 0, category: data.category,
                maxOccurrences: data.maxOccurrences, 
                lastModified: now
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
        id: generateId(), date: dateStr, description: plan.description,
        amount: plan.amount, type: plan.type, category: plan.category, isPaid: false, relatedPlanId: plan.id, lastModified: now
    };
    setTransactions(prev => [newTx, ...prev]);
    
    if (plan.frequency === Frequency.ONE_TIME) {
        setDeletedIds(prev => ({ ...prev, [planId]: now }));
        setPlans(prev => prev.filter(p => p.id !== planId));
    } else {
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
    }
  };

  // --- Handlers: Date & Period Management ---

  const handleUpdateBillingDate = (newDate: Date) => { 
    // Check for period transition
    const currentPeriod = snapshot;
    const { start: newPeriodStart } = calculatePeriod(newDate, newDate.getDate()); // Assuming new date sets the start day
    
    // If moving to a future period (start date of new view is > start date of current view)
    if (newPeriodStart > currentPeriod.periodStart) {
        const pending: { plan: RecurringPlan, due: Date }[] = [];
        const today = new Date(); today.setHours(0,0,0,0);

        plans.forEach(plan => {
             // Calculate Next Due Date
             const nextDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated);
             nextDate.setHours(0,0,0,0);
             const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;

             // If item is Due within the CURRENT (old) period window
             if (!isMaxed && nextDate >= currentPeriod.periodStart && nextDate <= currentPeriod.periodEnd) {
                 pending.push({ plan, due: nextDate });
             }
             // Also include any "Late" items that are even older than current period start
             else if (!isMaxed && nextDate < currentPeriod.periodStart) {
                 pending.push({ plan, due: nextDate });
             }
        });

        if (pending.length > 0) {
            setTransitionState({
                isOpen: true,
                targetDate: newDate,
                pendingItems: pending
            });
            // We do NOT update the viewDate yet. We wait for modal resolution.
            return;
        }
    }

    // Default behavior if no transition logic triggered
    setCycleStartDay(newDate.getDate()); 
    setViewDate(newDate); 
  };

  const handleResolveTransitionItem = (planId: string, action: 'move' | 'paid' | 'cancel') => {
      if (!transitionState) return;
      const { targetDate } = transitionState;
      const item = transitionState.pendingItems.find(i => i.plan.id === planId);
      if (!item) return;

      const now = Date.now();

      if (action === 'paid') {
          // Create Transaction at original due date
          executePlanApplication(planId, item.due);
      } else if (action === 'cancel') {
          // Skip occurrence
          const plan = plans.find(p => p.id === planId);
          if (plan) {
             if (plan.frequency === Frequency.ONE_TIME) {
                 deletePlan(planId);
             } else {
                 setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
             }
          }
      } else if (action === 'move') {
          // Move to new target date
          const plan = plans.find(p => p.id === planId);
          if (plan) {
              if (plan.frequency === Frequency.ONE_TIME) {
                  // Simply update date
                  const newDateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
                  setPlans(prev => prev.map(p => p.id === planId ? { ...p, startDate: newDateStr, lastModified: now } : p));
              } else {
                  // Recurring: Skip current, create new One-Time plan at target date
                  // 1. Skip
                  setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
                  // 2. Create new One Time
                  const newDateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
                  const newPlan: RecurringPlan = {
                      id: generateId(),
                      description: plan.description,
                      amount: plan.amount,
                      type: plan.type,
                      frequency: Frequency.ONE_TIME,
                      startDate: newDateStr,
                      occurrencesGenerated: 0,
                      category: plan.category,
                      lastModified: now
                  };
                  setPlans(prev => [...prev, newPlan]);
              }
          }
      }

      // Remove from pending list
      setTransitionState(prev => {
          if (!prev) return null;
          return {
              ...prev,
              pendingItems: prev.pendingItems.filter(i => i.plan.id !== planId)
          };
      });
  };

  const handleFinishTransition = () => {
      if (transitionState) {
          setCycleStartDay(transitionState.targetDate.getDate());
          setViewDate(transitionState.targetDate);
          setTransitionState(null);
      }
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
    setDeletedIds(prev => ({ ...prev, [id]: now }));
    setTransactions(prev => prev.filter(t => t.id !== id));
  };
  
  const deletePlan = (id: string) => { 
      setDeletedIds(prev => ({ ...prev, [id]: Date.now() }));
      setPlans(prev => prev.filter(p => p.id !== id)); 
  };

  const handleConfirmShiftCycle = () => { if (shiftCycleDialog) { setCycleStartDay(shiftCycleDialog.newDate.getDate()); setViewDate(shiftCycleDialog.newDate); executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate); setShiftCycleDialog(null); } };
  const handleAlternativeKeepCycle = () => { if (shiftCycleDialog) { executePlanApplication(shiftCycleDialog.planId, shiftCycleDialog.newDate); setShiftCycleDialog(null); } };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-300 font-sans transition-colors relative">
      <SummaryBar snapshot={snapshot} onUpdateDate={handleUpdateBillingDate} syncStatus={syncStatus} />
      
      <main className="max-w-4xl mx-auto px-4">
        {/* Global Filter Bar */}
        <FilterBar 
            filterText={filterText} 
            onFilterChange={setFilterText} 
            sortOption={sortOption} 
            onSortChange={setSortOption} 
        />
        
        {/* Planned Section */}
        {plans.length > 0 && (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1 cursor-pointer group select-none" onClick={() => setShowPlanned(!showPlanned)}>
                    <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showPlanned ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">Planned</h3>
                </div>
                {showPlanned && <PlanList 
                    plans={plans} 
                    onDelete={deletePlan} 
                    onEdit={(p) => { setEditingItem(p); setIsModalOpen(true); }} 
                    onApplyNow={handleApplyPlanNow} 
                    currentPeriodEnd={snapshot.periodEnd} 
                    filterText={filterText}
                    sortOption={sortOption}
                    designConfig={designConfig}
                />}
            </div>
        )}

        {/* History Section */}
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-1 mt-4 cursor-pointer group select-none" onClick={() => setShowHistory(!showHistory)}>
                 <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                 <h1 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">History</h1>
            </div>
            {showHistory && <TransactionGrid 
                transactions={transactions} 
                onDelete={deleteTransaction} 
                onEdit={(t) => { setEditingItem(t); setIsModalOpen(true); }} 
                filterText={filterText}
                sortOption={sortOption}
                designConfig={designConfig}
            />}
        </div>
      </main>

      {/* Version Footer */}
      <div className="fixed bottom-1 w-full flex justify-center pointer-events-none select-none z-0">
          <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-500 opacity-40">
            v{APP_VERSION}
          </span>
      </div>
      
      {/* Floating Action Buttons */}
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

      {/* Sync Status - Bottom Left (Below settings button) */}
      {syncStatus !== 'offline' && (
        <div className="fixed bottom-2 left-6 z-50 flex items-center gap-1.5">
             <div className={`w-1.5 h-1.5 rounded-full ${
                 syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 
                 syncStatus === 'syncing' ? 'bg-indigo-500 animate-pulse' : 
                 'bg-rose-500'
             }`}></div>
             <span className="text-[9px] text-gray-400 dark:text-gray-600 font-bold tracking-wider">
                {syncStatus === 'synced' ? 'SYNCED' : syncStatus === 'syncing' ? 'SYNCING...' : 'ERROR'}
             </span>
        </div>
      )}

      <button 
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light transition-transform hover:scale-105 active:scale-95 z-40 border border-indigo-400/30"
          title="Add Entry"
      >
          +
      </button>

      {/* Floating Design Debugger */}
      {showDesignDebug && (
          <DesignDebugger 
            config={designConfig}
            onChange={setDesignConfig}
            onClose={() => setShowDesignDebug(false)}
          />
      )}

      {/* Modals */}
      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        onSave={handleSaveData} 
        initialData={editingItem}
        categories={uniqueCategories}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        syncConfig={syncConfig}
        onSaveSyncConfig={handleSaveSyncConfig}
        onClearData={handleClearData}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onAddMockData={handleAddMockData}
        showDesignDebug={showDesignDebug}
        onToggleDesignDebug={() => setShowDesignDebug(!showDesignDebug)}
      />
      <ConfirmModal 
        isOpen={!!shiftCycleDialog} title="Next Billing Cycle?" message={`This payment (${shiftCycleDialog?.newDate.toLocaleDateString()}) falls in the next billing cycle. Shift cycle start to ${shiftCycleDialog?.newDate.getDate()}th?`}
        onConfirm={handleConfirmShiftCycle} confirmText="Yes, Shift Cycle" onAlternative={handleAlternativeKeepCycle} alternativeText="No, Keep Current" onCancel={() => setShiftCycleDialog(null)} cancelText="Cancel"
      />
      
      {/* Period Transition Modal */}
      {transitionState && (
          <PeriodTransitionModal
            isOpen={transitionState.isOpen}
            targetDate={transitionState.targetDate}
            pendingPlans={transitionState.pendingItems}
            onResolve={handleResolveTransitionItem}
            onContinue={handleFinishTransition}
            onCancel={() => setTransitionState(null)}
          />
      )}
    </div>
  );
}