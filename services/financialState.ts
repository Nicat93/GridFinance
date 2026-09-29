import { Transaction } from '../types';
import { todayDateOnly } from './dateOnly';

export type PaidVisualState = 'paid' | 'paid-early' | 'unpaid';

export const affectsCurrentBalance = (transaction: Transaction): boolean => transaction.isPaid;

export const getPaidVisualState = (transaction: Transaction, today = todayDateOnly()): PaidVisualState =>
    !transaction.isPaid ? 'unpaid' : transaction.date > today ? 'paid-early' : 'paid';
