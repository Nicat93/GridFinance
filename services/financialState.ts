import { Transaction } from '../types';
import { todayDateOnly } from './dateOnly';

export type PaidVisualState = 'paid' | 'paid-early' | 'unpaid';

export const affectsCurrentBalance = (transaction: Transaction): boolean => transaction.isPaid;

export const calculateCurrentBalance = (transactions: Transaction[]): number => transactions.reduce(
    (balance, transaction) => !affectsCurrentBalance(transaction)
        ? balance
        : transaction.type === 'income' ? balance + transaction.amount : balance - transaction.amount,
    0,
);

export const getPaidVisualState = (transaction: Transaction, today = todayDateOnly()): PaidVisualState =>
    !transaction.isPaid ? 'unpaid' : transaction.date > today ? 'paid-early' : 'paid';
