export type TransactionType = 'income' | 'expense';

export enum Frequency {
  ONE_TIME = 'One-time',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly'
}

/**
 * Represents a single financial transaction (income or expense).
 */
export interface Transaction {
  id: string;
  date: string; // ISO Date string YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  isPaid: boolean;
  relatedPlanId?: string; // Links this transaction to a RecurringPlan if generated from one
  lastModified?: number; // Timestamp for sync conflict resolution
}

/**
 * Represents a recurring financial plan or bill (e.g., Rent, Netflix).
 * Used to generate future projections and instantiate transactions.
 */
export interface RecurringPlan {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  startDate: string; // Anchor date for the recurrence
  endDate?: string;
  maxOccurrences?: number; // Stop after N occurrences (e.g., loan payments)
  occurrencesGenerated: number; // How many real Transactions have been created from this plan
  category: string;
  isInstallment: boolean; // Visual tag for loans/installments
  totalInstallmentAmount?: number;
  lastModified?: number; // Timestamp for sync conflict resolution
}

/**
 * Calculated view of financial health for a specific period (usually a billing month).
 */
export interface FinancialSnapshot {
  currentBalance: number;
  projectedBalance: number;
  upcomingExpenses: number;
  upcomingIncome: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * The data structure used for syncing with Supabase.
 * Contains the full state required to restore or merge data on another device.
 */
export interface BackupData {
  transactions: Transaction[];
  plans: RecurringPlan[];
  cycleStartDay: number;
  lastModified?: number;
  deletedIds?: { [id: string]: number }; // Tombstones for sync: { id: timestampOfDeletion }
}

export interface SyncConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  syncId: string; // Unique ID (partition key) for this user's data
  lastSyncedAt: number;
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';
