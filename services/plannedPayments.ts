import { Frequency, RecurringPlan, Transaction } from '../types';
import { getRecurringOccurrenceId } from './recurrence';

/** Approximate amounts describe plans for expenses, never actual transactions or income. */
export const getPlannedApproximateAmount = (
  isPlanned: boolean,
  type: 'income' | 'expense',
  approximateUpperAmount?: number,
): number | undefined => isPlanned && type === 'expense' ? approximateUpperAmount : undefined;

export const createPlannedPlan = (input: {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  tags: string[];
  date: string;
  frequency: Frequency;
  maxOccurrences?: number;
  approximateUpperAmount?: number;
  createdAt: number;
  lastModified: number;
}): RecurringPlan => ({
  id: input.id,
  description: input.description,
  amount: input.amount,
  ...(getPlannedApproximateAmount(true, input.type, input.approximateUpperAmount) === undefined ? {} : {
    approximateUpperAmount: input.approximateUpperAmount,
  }),
  type: input.type,
  frequency: input.frequency,
  startDate: input.date,
  maxOccurrences: input.maxOccurrences,
  occurrencesGenerated: 0,
  tags: input.tags,
  createdAt: input.createdAt,
  lastModified: input.lastModified,
});

export const createExactTransactionFromPlan = (
  input: { id: string; date: string; description: string; amount: number; type: 'income' | 'expense'; tags: string[]; createdAt: number; lastModified: number },
): Transaction => ({
  ...input,
  isPaid: true,
});

/** Materialize one planned occurrence as a transaction with one exact amount. */
export const createAppliedTransaction = (
  plan: RecurringPlan,
  date: string,
  isPaid = true,
  createdAt: number,
  lastModified: number,
  actualAmount = plan.amount,
): Transaction => {
  if (!Number.isFinite(actualAmount) || actualAmount < 0) throw new Error('Invalid actual amount');
  return {
    id: getRecurringOccurrenceId(plan.id, date),
    date,
    description: plan.description,
    amount: actualAmount,
    type: plan.type,
    tags: plan.tags,
    isPaid,
    relatedPlanId: plan.id,
    createdAt,
    lastModified,
  };
};
