import { TransactionType } from '../types';

export interface ProjectedOccurrence {
  amount: number;
  type: TransactionType;
  approximateUpperAmount?: number;
}

export interface ProjectedBalanceRange {
  projectedBalance: number;
  projectedBalanceMin: number;
  projectedBalanceMax: number;
}

export interface ProjectedTransaction {
  amount: number;
  approximateUpperAmount?: number;
  date: string;
  isPaid: boolean;
  type: TransactionType;
}

/** Only uncertain unpaid expenses are additional projection inputs; un-ranged
 * transactions keep the app's existing projection behavior. */
export const getApproximateUnpaidExpenseOccurrences = (
  transactions: ProjectedTransaction[],
  periodStart: string,
  periodEnd: string,
): ProjectedOccurrence[] => transactions
  .filter(transaction => !transaction.isPaid && transaction.type === 'expense' &&
    transaction.approximateUpperAmount !== undefined && transaction.date >= periodStart && transaction.date <= periodEnd)
  .map(({ amount, type, approximateUpperAmount }) => ({ amount, type, approximateUpperAmount }));

/** Add projected occurrences to Current, keeping expense uncertainty as a balance range. */
export const calculateProjectedBalance = (
  currentBalance: number,
  occurrences: ProjectedOccurrence[],
): ProjectedBalanceRange => {
  let lower = currentBalance;
  let upper = currentBalance;
  for (const occurrence of occurrences) {
    if (occurrence.type === 'income') {
      lower += occurrence.amount;
      upper += occurrence.amount;
    } else {
      lower -= occurrence.approximateUpperAmount ?? occurrence.amount;
      upper -= occurrence.amount;
    }
  }
  return { projectedBalance: upper, projectedBalanceMin: lower, projectedBalanceMax: upper };
};
