
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Transaction, RecurringPlan, Frequency, FinancialSnapshot, SyncConfig, BackupData, SyncStatus, TransactionType, SortOption, CategoryDef, LanguageCode } from './types';
import TransactionGrid from './components/TransactionGrid';
import SummaryBar from './components/SummaryBar';
import AddTransactionModal from './components/AddTransactionModal';
import PlanList from './components/PlanList';
import ConfirmModal from './components/ConfirmModal';
import SettingsModal from './components/SettingsModal';
import PeriodTransitionModal from './components/PeriodTransitionModal';
import FilterBar from './components/FilterBar';
import DesignDebugger, { DesignConfig } from './components/DesignDebugger';
import CategoryManager from './components/CategoryManager';
import DateRangeModal from './components/DateRangeModal';
import * as SupabaseService from './services/supabaseService';
import { APP_VERSION } from './version';
import { translations } from './translations';

// --- Utility Functions ---

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
    if (freq === Frequency.MONTHLY) { 
        d.setMonth(d.getMonth() + count); 
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
    return parsed.map((t: any) => {
        const desc = t.name || t.description || '';
        const { name, ...rest } = t;
        return { ...rest, description: desc };
    });
  });
  
  const [plans, setPlans] = useState<RecurringPlan[]>(() => {
    const saved = localStorage.getItem('plans');
    let parsed: any[] = saved ? JSON.parse(saved) : [];
    return parsed.map((p: any) => {
        const desc = p.name || p.description || '';
        const { name, ...rest } = p;
        return { ...rest, description: desc };
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

  // Persistent Category Definitions
  const [categoryDefs, setCategoryDefs] = useState<CategoryDef[]>(() => {
      const saved = localStorage.getItem('categoryDefs');
      if (saved) return JSON.parse(saved);

      // Migration: Convert old 'savedCategories' string array to CategoryDefs
      const oldSavedCats = localStorage.getItem('savedCategories');
      const cats: CategoryDef[] = [];
      const colors = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
      const now = Date.now();

      if (oldSavedCats) {
          const names: string[] = JSON.parse(oldSavedCats);
          names.forEach(name => {
              cats.push({
                  id: Math.random().toString(36).substr(2, 9),
                  name: name,
                  color: colors[Math.floor(Math.random() * colors.length)],
                  lastModified: now // Important for sync
              });
          });
      }
      return cats;
  });
  
  // --- State: Sync Config ---
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
      const saved = localStorage.getItem('syncConfig');
      if (saved) return JSON.parse(saved);

      const envUrl = 'https://svfcmefotkyphvzhrkfj.supabase.co';
      const envKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2ZmNtZWZvdGt5cGh2emhya2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzE5NDgsImV4cCI6MjA4MDE0Nzk0OH0.u0cIFe7TZa1h59bizfsl5qm9bwTUYmQ8pYXsadLbvWo';

      return { enabled: false, supabaseUrl: envUrl, supabaseKey: envKey, syncId: '', lastSyncedAt: 0 };
  });

  // --- State: UI ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
  });
  
  const [language, setLanguage] = useState<LanguageCode>(() => {
      const saved = localStorage.getItem('language');
      return (saved as LanguageCode) || 'en';
  });

  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | RecurringPlan | null>(null);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  
  // Global Filter/Sort State
  const [filterText, setFilterText] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date_asc'); 
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Design Debugger State
  const [showDesignDebug, setShowDesignDebug] = useState(false);
  const [designConfig, setDesignConfig] = useState<DesignConfig>({ 
      fontSize: 11, 
      paddingY: 0.1,
      fontWeightDesc: 500,
      fontWeightAmount: 700,
      tracking: -0.05,
      pillRadius: 4
  });

  const [shiftCycleDialog, setShiftCycleDialog] = useState<{ isOpen: boolean, planId: string, newDate: Date } | null>(null);
  const [transitionState, setTransitionState] = useState<{ isOpen: boolean, targetDate: Date, pendingItems: { plan: RecurringPlan, due: Date }[] } | null>(null);
  const [isClearDataConfirmOpen, setIsClearDataConfirmOpen] = useState(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const isFirstMount = useRef(true);

  // --- Effects: Persistence ---
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('cycleStartDay', cycleStartDay.toString()); }, [cycleStartDay]);
  useEffect(() => { localStorage.setItem('deletedIds', JSON.stringify(deletedIds)); }, [deletedIds]);
  useEffect(() => { localStorage.setItem('categoryDefs', JSON.stringify(categoryDefs)); }, [categoryDefs]);
  useEffect(() => { localStorage.setItem('syncConfig', JSON.stringify(syncConfig)); }, [syncConfig]);
  useEffect(() => { localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); }, [isDarkMode]);
  useEffect(() => { localStorage.setItem('language', language); }, [language]);

  // --- Effects: Theme ---
  useEffect(() => {
      if (isDarkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // --- Effect: Harvest Categories from History/Plans ---
  // Runs whenever transactions or plans change (including after a sync)
  useEffect(() => {
    const usedCategories = new Set<string>();
    transactions.forEach(t => t.category && usedCategories.add(t.category));
    plans.forEach(p => p.category && usedCategories.add(p.category));

    setCategoryDefs(prev => {
        const newDefs = [...prev];
        let changed = false;
        const colors = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
        const now = Date.now();

        usedCategories.forEach(catName => {
            const normalized = catName.trim();
            if (!normalized) return;
            
            // Check if exists (case insensitive)
            if (!newDefs.some(d => d.name.toLowerCase() === normalized.toLowerCase())) {
                newDefs.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: normalized,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    lastModified: now // Important for sync
                });
                changed = true;
            }
        });
        
        return changed ? newDefs : prev;
    });
  }, [transactions, plans]);

  // --- Sync Logic ---
  const stateRef = useRef({ transactions, plans, cycleStartDay, deletedIds, categoryDefs, syncConfig });
  useEffect(() => {
      stateRef.current = { transactions, plans, cycleStartDay, deletedIds, categoryDefs, syncConfig };
  }, [transactions, plans, cycleStartDay, deletedIds, categoryDefs, syncConfig]);

  const triggerSync = useCallback(async () => {
      const currentConfig = stateRef.current.syncConfig;
      if (!currentConfig.enabled || !currentConfig.syncId) return;
      if (isSyncingRef.current) return;
      
      isSyncingRef.current = true;
      setSyncStatus('syncing');
      
      const currentLocalState = stateRef.current;
      const lastSyncedAt = currentConfig.lastSyncedAt || 0;
      const syncStartTime = Date.now();

      try {
          // 1. PULL
          const remoteChanges = await SupabaseService.pullChanges(currentConfig, lastSyncedAt);
          
          let mergedTransactions = currentLocalState.transactions;
          let mergedPlans = currentLocalState.plans;
          let mergedDeletedIds = currentLocalState.deletedIds;
          let mergedCategories = currentLocalState.categoryDefs;
          let mergedCycleDay = currentLocalState.cycleStartDay;

          if (remoteChanges) {
              const merged = SupabaseService.mergeDeltas(
                  { 
                      transactions: currentLocalState.transactions, 
                      plans: currentLocalState.plans, 
                      cycleStartDay: currentLocalState.cycleStartDay, 
                      deletedIds: currentLocalState.deletedIds,
                      categoryDefs: currentLocalState.categoryDefs,
                      lastModified: 0 
                  }, 
                  remoteChanges
              );
              mergedTransactions = merged.transactions;
              mergedPlans = merged.plans;
              mergedDeletedIds = merged.deletedIds || {};
              mergedCategories = merged.categoryDefs || [];
              mergedCycleDay = merged.cycleStartDay;

              const hasChanges = 
                  mergedTransactions.length !== currentLocalState.transactions.length ||
                  JSON.stringify(mergedTransactions) !== JSON.stringify(currentLocalState.transactions) ||
                  JSON.stringify(mergedPlans) !== JSON.stringify(currentLocalState.plans) ||
                  JSON.stringify(mergedCategories) !== JSON.stringify(currentLocalState.categoryDefs) ||
                  mergedCycleDay !== currentLocalState.cycleStartDay;

              if (hasChanges) {
                  setTransactions(mergedTransactions);
                  setPlans(mergedPlans);
                  setCategoryDefs(mergedCategories);
                  setCycleStartDay(mergedCycleDay);
                  setDeletedIds(mergedDeletedIds);
              }
          }

          // 2. PUSH
          // Use merged data (or current if no merge) for push to ensure we are up to date
          const success = await SupabaseService.pushChanges(
              currentConfig, 
              mergedTransactions, 
              mergedPlans, 
              mergedCategories,
              mergedDeletedIds, 
              mergedCycleDay, 
              lastSyncedAt
          );
          
          if (success) {
            setSyncStatus('synced');
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
  }, []); 

  useEffect(() => {
      if (syncConfig.enabled && syncConfig.supabaseUrl && syncConfig.supabaseKey) {
          SupabaseService.initSupabase(syncConfig.supabaseUrl, syncConfig.supabaseKey);
          triggerSync();
      } else {
          setSyncStatus('offline');
      }
  }, [syncConfig.enabled, syncConfig.supabaseUrl, syncConfig.supabaseKey, syncConfig.syncId, triggerSync]);

  useEffect(() => {
      if (isFirstMount.current) { isFirstMount.current = false; return; }
      if (!syncConfig.enabled) return;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = window.setTimeout(() => { triggerSync(); }, 3000); 
      return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); }
  }, [transactions, plans, cycleStartDay, deletedIds, categoryDefs, triggerSync, syncConfig.enabled]); 

  useEffect(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && syncConfig.enabled) {
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
            
            if (currentDate >= periodStart) {
                if (plan.type === 'income') { upcomingIncome += plan.amount; projectedBalance += plan.amount; } 
                else { upcomingExpenses += plan.amount; projectedBalance -= plan.amount; }
            }
            simCount++; 
            simDate = addTime(plan.startDate, plan.frequency, simCount);
            if (plan.frequency === Frequency.ONE_TIME) break;
        }
    });

    return { currentBalance, projectedBalance, upcomingIncome, upcomingExpenses, periodStart, periodEnd };
  }, [transactions, plans, cycleStartDay, viewDate]);

  const handleClearDataRequest = () => {
      setIsClearDataConfirmOpen(true);
  };

  const performClearData = () => {
      setTransactions([]);
      setPlans([]);
      setDeletedIds({});
      setCategoryDefs([]); // Reset Categories too
      setCycleStartDay(1);
      setSyncConfig(prev => ({ ...prev, lastSyncedAt: 0 }));
      setIsClearDataConfirmOpen(false);
  };

  const handleAddMockData = () => {
      const newTxs: Transaction[] = [];
      const newPlans: RecurringPlan[] = [];
      const now = Date.now();
      const mockCats = ['Food', 'Transport', 'Housing', 'Utilities'];
      
      // Add Mock categories if they don't exist
      const newCatDefs = [...categoryDefs];
      const colors = ['red', 'blue', 'green', 'amber'];
      mockCats.forEach((name, i) => {
          if (!newCatDefs.find(c => c.name === name)) {
              newCatDefs.push({ id: generateId(), name, color: colors[i], lastModified: now });
          }
      });
      setCategoryDefs(newCatDefs);

      for (let i = 0; i < 200; i++) {
          const type = Math.random() > 0.7 ? 'income' : 'expense';
          const desc = `Mock ${type === 'income' ? 'Income' : 'Expense'} ${i}`;
          const cat = mockCats[Math.floor(Math.random() * mockCats.length)];
          newTxs.push({
              id: generateId(),
              date: new Date(Date.now() - Math.random() * 31536000000).toISOString().split('T')[0], 
              description: desc,
              amount: parseFloat((Math.random() * 1000).toFixed(2)),
              type: type,
              category: cat,
              isPaid: true,
              lastModified: now
          });
          newPlans.push({
              id: generateId(),
              description: `Plan ${desc}`,
              amount: parseFloat((Math.random() * 500).toFixed(2)),
              type: type,
              frequency: Frequency.MONTHLY,
              startDate: new Date(Date.now() + Math.random() * 31536000000).toISOString().split('T')[0],
              occurrencesGenerated: 0,
              category: cat,
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
        categoryDefs,
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
        if (!Array.isArray(data.transactions) || !Array.isArray(data.plans)) { alert("Invalid backup file format."); return; }
        if (window.confirm(`Found ${data.transactions.length} transactions and ${data.plans.length} plans. This will OVERWRITE your current local data. Continue?`)) {
            const now = Date.now();
            const importedTx = data.transactions.map((t: any) => {
                 const desc = t.name || t.description || '';
                 const { name, ...rest } = t;
                 return { ...rest, description: desc };
            });
             const importedPlans = data.plans.map((p: any) => {
                 const desc = p.name || p.description || '';
                 const { name, ...rest } = p;
                 return { ...rest, description: desc };
            });

            if (data.categoryDefs && Array.isArray(data.categoryDefs)) {
                // Ensure imports have timestamps
                const cats = data.categoryDefs.map((c: any) => ({ ...c, lastModified: c.lastModified || now }));
                setCategoryDefs(cats);
            } else if (data.savedCategories) {
                // Legacy Import Migration
                 const cats: CategoryDef[] = [];
                 const colors = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
                 data.savedCategories.forEach((name: string) => {
                    cats.push({ id: generateId(), name: name, color: colors[Math.floor(Math.random() * colors.length)], lastModified: now });
                 });
                 setCategoryDefs(cats);
            }

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
    const finalDescription = data.description?.trim() || '';
    // Allow empty category string
    const finalCategory = data.category ? data.category.trim() : '';

    // Auto-create category if new (Fallback behavior, user can manage later)
    if (finalCategory && !categoryDefs.find(c => c.name.toLowerCase() === finalCategory.toLowerCase())) {
        const colors = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
        const newDef: CategoryDef = {
            id: generateId(),
            name: finalCategory,
            color: data.newCategoryColor || colors[Math.floor(Math.random() * colors.length)],
            lastModified: now
        };
        setCategoryDefs(prev => [...prev, newDef]);
    }

    if (editingItem) {
        const isPlan = 'frequency' in editingItem;
        if (isPlan) {
             const updatedPlan = {
                ...editingItem,
                description: finalDescription, amount: data.amount, type: data.type, category: finalCategory,
                startDate: data.date, frequency: data.frequency, maxOccurrences: data.maxOccurrences,
                lastModified: now
            } as RecurringPlan;
            setPlans(prev => prev.map(p => p.id === editingItem.id ? updatedPlan : p));
        } else {
            const updatedTx = {
                ...editingItem,
                description: finalDescription, amount: data.amount, type: data.type, category: finalCategory, date: data.date,
                lastModified: now
            } as Transaction;
            setTransactions(prev => prev.map(t => t.id === editingItem.id ? updatedTx : t));
        }
        setEditingItem(null);
    } else {
        if (data.kind === 'single') {
            const newTx: Transaction = {
                id: generateId(), date: data.date, description: finalDescription, amount: data.amount,
                type: data.type, category: finalCategory, isPaid: true, lastModified: now
            };
            setTransactions(prev => [newTx, ...prev]);
        } else if (data.kind === 'plan') {
            const count = data.maxOccurrences || 1;
            // If it's a loan, the input amount is the Total, so the plan amount (monthly) is Total / Count.
            // If it's not a loan, the input amount is the Monthly amount.
            const finalPlanAmount = data.isLoan ? (data.amount / count) : data.amount;

            // For loans, use the specified start date. For regular plans, use the transaction date.
            const finalPlanStartDate = data.isLoan ? (data.planStartDate || data.date) : data.date;

            const newPlan: RecurringPlan = {
                id: generateId(), description: finalDescription, 
                amount: finalPlanAmount, 
                type: data.type,
                frequency: data.frequency, startDate: finalPlanStartDate, occurrencesGenerated: 0, category: finalCategory,
                maxOccurrences: data.maxOccurrences, 
                lastModified: now
            };
            setPlans(prev => [...prev, newPlan]);

            // Handle Loan Logic: Create immediate transaction for total amount
            if (data.isLoan) {
                // User entered Total in the amount field, so use it directly
                const totalAmount = data.amount;
                // Loan transaction usually implies receiving money (if it's a loan taken) or spending money (loan given)
                // If I am taking a loan, I get INCOME (cash). Repayments are EXPENSE.
                // If I create a PLAN for EXPENSE (repayment), then the initial TX is INCOME.
                // If I create a PLAN for INCOME (I am being repaid), then initial TX is EXPENSE (I gave money).
                const reverseType = data.type === 'expense' ? 'income' : 'expense';
                
                const principalTx: Transaction = {
                    id: generateId(),
                    date: data.date, // Transaction happens "now"
                    description: `Loan Principal: ${finalDescription}`,
                    amount: totalAmount,
                    type: reverseType,
                    category: finalCategory,
                    isPaid: true,
                    lastModified: now
                };
                setTransactions(prev => [principalTx, ...prev]);
            }
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

  const handleUpdateBillingDate = (newDate: Date) => { 
    const currentPeriod = snapshot;
    const { start: newPeriodStart } = calculatePeriod(newDate, newDate.getDate()); 
    
    if (newPeriodStart > currentPeriod.periodStart) {
        const pending: { plan: RecurringPlan, due: Date }[] = [];
        const today = new Date(); today.setHours(0,0,0,0);
        plans.forEach(plan => {
             const nextDate = addTime(plan.startDate, plan.frequency, plan.occurrencesGenerated);
             nextDate.setHours(0,0,0,0);
             const isMaxed = plan.maxOccurrences ? plan.occurrencesGenerated >= plan.maxOccurrences : false;
             if (!isMaxed && nextDate >= currentPeriod.periodStart && nextDate <= currentPeriod.periodEnd) {
                 pending.push({ plan, due: nextDate });
             }
             else if (!isMaxed && nextDate < currentPeriod.periodStart) {
                 pending.push({ plan, due: nextDate });
             }
        });

        if (pending.length > 0) {
            setTransitionState({ isOpen: true, targetDate: newDate, pendingItems: pending });
            return;
        }
    }
    setCycleStartDay(newDate.getDate()); 
    setViewDate(newDate); 
  };

  const handleResolveTransitionItem = (planId: string, action: 'move' | 'paid' | 'cancel') => {
      if (!transitionState) return;
      const { targetDate } = transitionState;
      const item = transitionState.pendingItems.find(i => i.plan.id === planId);
      if (!item) return;
      const now = Date.now();

      if (action === 'paid') { executePlanApplication(planId, item.due); } 
      else if (action === 'cancel') {
          const plan = plans.find(p => p.id === planId);
          if (plan) {
             if (plan.frequency === Frequency.ONE_TIME) deletePlan(planId);
             else setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
          }
      } else if (action === 'move') {
          const plan = plans.find(p => p.id === planId);
          if (plan) {
              if (plan.frequency === Frequency.ONE_TIME) {
                  const newDateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
                  setPlans(prev => prev.map(p => p.id === planId ? { ...p, startDate: newDateStr, lastModified: now } : p));
              } else {
                  setPlans(prev => prev.map(p => p.id === planId ? { ...p, occurrencesGenerated: p.occurrencesGenerated + 1, lastModified: now } : p));
                  const newDateStr = targetDate.getFullYear() + '-' + String(targetDate.getMonth() + 1).padStart(2, '0') + '-' + String(targetDate.getDate()).padStart(2, '0');
                  const newPlan: RecurringPlan = {
                      id: generateId(), description: plan.description, amount: plan.amount, type: plan.type,
                      frequency: Frequency.ONE_TIME, startDate: newDateStr, occurrencesGenerated: 0, category: plan.category,
                      lastModified: now
                  };
                  setPlans(prev => [...prev, newPlan]);
              }
          }
      }

      setTransitionState(prev => {
          if (!prev) return null;
          return { ...prev, pendingItems: prev.pendingItems.filter(i => i.plan.id !== planId) };
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

  // Translations helper
  const t = translations[language];

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-300 font-sans transition-colors relative">
      <SummaryBar snapshot={snapshot} onUpdateDate={handleUpdateBillingDate} syncStatus={syncStatus} language={language} />
      
      <main className="max-w-4xl mx-auto px-4">
        <FilterBar 
            filterText={filterText} onFilterChange={setFilterText} 
            sortOption={sortOption} onSortChange={setSortOption} 
            onOpenDateFilter={() => setIsDateFilterOpen(true)}
            hasDateFilter={!!(filterStartDate || filterEndDate)}
            language={language}
        />
        
        {plans.length > 0 && (
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1 cursor-pointer group select-none" onClick={() => setShowPlanned(!showPlanned)}>
                    <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showPlanned ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">{t.planned}</h3>
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
                    categories={categoryDefs}
                    startDate={filterStartDate}
                    endDate={filterEndDate}
                    language={language}
                />}
            </div>
        )}

        <div className="mb-6">
            <div className="flex items-center gap-2 mb-1 mt-4 cursor-pointer group select-none" onClick={() => setShowHistory(!showHistory)}>
                 <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-600 transition-transform duration-200" style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                 <h1 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">{t.history}</h1>
            </div>
            {showHistory && <TransactionGrid 
                transactions={transactions} 
                onDelete={deleteTransaction} 
                onEdit={(t) => { setEditingItem(t); setIsModalOpen(true); }} 
                filterText={filterText}
                sortOption={sortOption}
                designConfig={designConfig}
                categories={categoryDefs}
                startDate={filterStartDate}
                endDate={filterEndDate}
                language={language}
            />}
        </div>
      </main>

      <div className="fixed bottom-1 w-full flex justify-center pointer-events-none select-none z-0">
          <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-500 opacity-40">v{APP_VERSION}</span>
      </div>
      
      <button 
          onClick={() => setIsSettingsOpen(true)}
          className="fixed bottom-6 left-6 w-10 h-10 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40 border border-gray-300 dark:border-gray-700"
          title={t.settings}
      >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 11-6 0 3 3 0 016 0z" /></svg>
      </button>

      {syncStatus !== 'offline' && (
        <div className="fixed bottom-2 left-6 z-50 flex items-center gap-1.5">
             <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : syncStatus === 'syncing' ? 'bg-indigo-500 animate-pulse' : 'bg-rose-500'}`}></div>
             <span className="text-[9px] text-gray-400 dark:text-gray-600 font-bold tracking-wider">{syncStatus === 'synced' ? 'SYNCED' : syncStatus === 'syncing' ? 'SYNCING...' : 'ERROR'}</span>
        </div>
      )}

      <button 
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light transition-transform hover:scale-105 active:scale-95 z-40 border border-indigo-400/30"
          title={t.addTransaction}
      >
          +
      </button>

      {showDesignDebug && (
          <DesignDebugger config={designConfig} onChange={setDesignConfig} onClose={() => setShowDesignDebug(false)} />
      )}
      <AddTransactionModal 
        isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSave={handleSaveData} initialData={editingItem} categories={categoryDefs} language={language}
      />
      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isDarkMode={isDarkMode} onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        syncConfig={syncConfig} onSaveSyncConfig={handleSaveSyncConfig} onClearData={handleClearDataRequest} onExportData={handleExportData} onImportData={handleImportData} onAddMockData={handleAddMockData}
        showDesignDebug={showDesignDebug} onToggleDesignDebug={() => setShowDesignDebug(!showDesignDebug)}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        language={language} onLanguageChange={setLanguage}
      />
      <CategoryManager 
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categoryDefs}
        onSave={setCategoryDefs}
        language={language}
      />
      <DateRangeModal 
        isOpen={isDateFilterOpen}
        startDate={filterStartDate}
        endDate={filterEndDate}
        onClose={() => setIsDateFilterOpen(false)}
        onApply={(start, end) => {
            setFilterStartDate(start);
            setFilterEndDate(end);
        }}
        language={language}
      />
      <ConfirmModal 
        isOpen={!!shiftCycleDialog} title={t.confirmTitle} message={`This payment (${shiftCycleDialog?.newDate.toLocaleDateString()}) falls in the next billing cycle. Shift cycle start to ${shiftCycleDialog?.newDate.getDate()}th?`}
        onConfirm={handleConfirmShiftCycle} confirmText="Yes, Shift Cycle" onAlternative={handleAlternativeKeepCycle} alternativeText="No, Keep Current" onCancel={() => setShiftCycleDialog(null)} cancelText={t.cancel}
      />
      <ConfirmModal
        isOpen={isClearDataConfirmOpen}
        title={t.clearData}
        message="Are you sure? This will delete all local transactions and plans. This cannot be undone."
        onConfirm={performClearData}
        onCancel={() => setIsClearDataConfirmOpen(false)}
        confirmText={t.yes}
        cancelText={t.cancel}
      />
      {transitionState && (
          <PeriodTransitionModal
            isOpen={transitionState.isOpen} targetDate={transitionState.targetDate} pendingPlans={transitionState.pendingItems}
            onResolve={handleResolveTransitionItem} onContinue={handleFinishTransition} onCancel={() => setTransitionState(null)}
            language={language}
          />
      )}
    </div>
  );
}