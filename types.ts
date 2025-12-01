export type TransactionType = 'income' | 'expense';

export enum Frequency {
  ONE_TIME = 'One-time',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly'
}

export interface Transaction {
  id: string;
  date: string; // ISO Date string YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  isPaid: boolean;
  relatedPlanId?: string;
  lastModified?: number; // Timestamp for sync
}

export interface RecurringPlan {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  category: string;
  isInstallment: boolean;
  totalInstallmentAmount?: number;
  lastModified?: number; // Timestamp for sync
}

export interface FinancialSnapshot {
  currentBalance: number;
  projectedBalance: number;
  upcomingExpenses: number;
  upcomingIncome: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface BackupData {
  transactions: Transaction[];
  plans: RecurringPlan[];
  cycleStartDay: number;
  lastModified?: number;
  deletedIds?: { [id: string]: number }; // Tombstones for sync { id: timestamp }
}

export interface SyncConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  syncId: string; // Unique ID for this user's data row
  lastSyncedAt: number;
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';