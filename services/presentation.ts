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
