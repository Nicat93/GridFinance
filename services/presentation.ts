import { TransactionType } from '../types';

export const formatMoney = (amount: number): string =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatExpenseAmount = (amount: number, approximateUpperAmount?: number): string => {
    if (approximateUpperAmount !== undefined && approximateUpperAmount !== amount) {
        return `−(${formatMoney(amount)} – ${formatMoney(approximateUpperAmount)})`;
    }
    return `−${formatMoney(amount)}`;
};

export const formatTransactionAmount = (type: TransactionType, amount: number, approximateUpperAmount?: number): string =>
    type === 'expense'
        ? formatExpenseAmount(amount, approximateUpperAmount)
        : `+${formatMoney(amount)}`;

export type HistoryEmptyState = 'empty' | 'noMatches';

export const getHistoryEmptyState = (
    transactionCount: number,
    filterText: string,
    startDate?: string,
    endDate?: string,
): HistoryEmptyState => transactionCount === 0 && !filterText.trim() && !startDate && !endDate
    ? 'empty'
    : 'noMatches';

/** Horizontal swipe on the cycle bar: left shows the next cycle, right the previous one. */
export const getCycleSwipeDirection = (dx: number, dy: number, threshold = 40): 'previous' | 'next' | null => {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'previous';
};
