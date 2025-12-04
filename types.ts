
export type TransactionType = 'income' | 'expense';

export enum Frequency {
  ONE_TIME = 'One-time',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly',
  YEARLY = 'Yearly'
}

export type SortOption = 'date_desc' | 'date_asc' | 'description_asc' | 'amount_desc' | 'category';

export type LanguageCode = 'en' | 'az' | 'ru' | 'tr';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'TRY' | 'AZN' | 'RUB';

export interface CategoryDef {
  id: string;
  name: string;
  color: string; // e.g., 'red', 'blue', 'emerald'
  lastModified?: number;
}

/**
 * Represents a single financial transaction (income or expense).
 */
export interface Transaction {
  /** Unique identifier (UUID or random string) */
  id: string;
  /** ISO Date string YYYY-MM-DD */
  date: string;
  /** Detailed description (e.g. "Walmart - Groceries") */
  description: string;
  /** Monetary value */
  amount: number;
  /** Income or Expense */
  type: TransactionType;
  /** Category tag (e.g., 'Food', 'Rent') */
  category: string;
  /** Tracks if the transaction has been marked as paid/cleared */
  isPaid: boolean;
  /** Links this transaction to a RecurringPlan if generated from one */
  relatedPlanId?: string;
  /** Timestamp for sync conflict resolution (Last-Write-Wins) */
  lastModified?: number;
}

/**
 * Represents a recurring financial plan or bill (e.g., Rent, Netflix).
 * Used to generate future projections and instantiate actual transactions.
 */
export interface RecurringPlan {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  /** Anchor date for the recurrence calculation */
  startDate: string;
  endDate?: string;
  /** Optional limit on number of occurrences (e.g. for loans) */
  maxOccurrences?: number;
  /** Counter of how many real Transactions have been created from this plan */
  occurrencesGenerated: number;
  category: string;
  /** Timestamp for sync conflict resolution */
  lastModified?: number;
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
  /** Timestamp of the last local modification */
  lastModified?: number;
  /** Tombstones for sync: { id: timestampOfDeletion } */
  deletedIds?: { [id: string]: number };
  categoryDefs?: CategoryDef[];
}

/**
 * Configuration for the synchronization service.
 */
export interface SyncConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  /** Unique ID (partition key) for this user's data in the shared table */
  syncId: string;
  lastSyncedAt: number;
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';
