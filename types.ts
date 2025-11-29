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
  relatedPlanId?: string; // If tied to a recurring plan or installment
}

export interface RecurringPlan {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate?: string; // Optional end date
  maxOccurrences?: number; // For limited number of payments
  occurrencesGenerated: number;
  category: string;
  isInstallment: boolean; // Distinction for UI mostly
  totalInstallmentAmount?: number; // If it's a fixed debt being paid off
}

export interface FinancialSnapshot {
  currentBalance: number;
  projectedBalance: number; // Balance after known upcoming recurring items for next 30 days
  upcomingExpenses: number;
  upcomingIncome: number;
  periodStart: Date;
  periodEnd: Date;
}