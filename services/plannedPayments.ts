import { Frequency, RecurringPlan, Transaction } from '../types';
import { getPlanOccurrencesInRange, getRecurringOccurrenceId } from './recurrence';
import { addDateOnly } from './dateOnly';

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

export const SKIP_DESCRIPTION_PREFIX = '[skip] ';

/**
 * Skipping applies the occurrence as a paid zero-amount transaction marked "[skip]". It keeps the occurrence's
 * deterministic ID, so the plan advances exactly as for a normal apply, and deleting the transaction rolls the
 * plan back like any applied one; editing it turns it into a real transaction.
 */
export const createSkippedTransaction = (plan: RecurringPlan, date: string, now: number): Transaction => ({
  ...createAppliedTransaction(plan, date, true, now, now, 0),
  description: `${SKIP_DESCRIPTION_PREFIX}${plan.description}`,
});

/** Due date of the plan's next unapplied occurrence. */
export const getPlanNextDueDate = (plan: RecurringPlan): string =>
  addDateOnly(plan.startDate, plan.frequency, plan.occurrencesGenerated);

/**
 * "Spend" records part of a planned occurrence as its own paid transaction. It gets a random ID and no
 * relatedPlanId, so the plan does not advance and deleting it needs no plan rollback; the amount spent is derived
 * from these transactions for the occurrence they name, so it resets when the plan advances.
 */
export const createPartialTransaction = (
  plan: RecurringPlan,
  input: { id: string; date: string; amount: number; now: number },
): Transaction => {
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error('Invalid partial amount');
  return {
    id: input.id,
    date: input.date,
    description: plan.description,
    amount: input.amount,
    type: plan.type,
    tags: plan.tags,
    isPaid: true,
    partialPlanId: plan.id,
    partialDueDate: getPlanNextDueDate(plan),
    createdAt: input.now,
    lastModified: input.now,
  };
};

/** Amount already spent against the plan's next occurrence. */
export const getPlanSpent = (plan: RecurringPlan, transactions: Transaction[]): number => {
  const dueDate = getPlanNextDueDate(plan);
  return transactions.reduce((sum, transaction) =>
    transaction.partialPlanId === plan.id && transaction.partialDueDate === dueDate ? sum + transaction.amount : sum, 0);
};

/** What is left of the next occurrence after partial spends; overspending floors at zero. */
export const getPlanRemaining = (plan: RecurringPlan, spent: number): { amount: number; approximateUpperAmount?: number } => ({
  amount: Math.max(0, plan.amount - spent),
  ...(plan.approximateUpperAmount === undefined ? {} : { approximateUpperAmount: Math.max(0, plan.approximateUpperAmount - spent) }),
});

/** Plan occurrences in an inclusive date range; the next occurrence projects only what partial spends left of it. */
export const getProjectedPlanOccurrences = (
  plan: RecurringPlan,
  start: string,
  end: string,
  spent?: number,
): { date: string; amount: number; type: 'income' | 'expense'; approximateUpperAmount?: number }[] => {
  const nextDueDate = getPlanNextDueDate(plan);
  return getPlanOccurrencesInRange(plan, start, end).map(date => {
    const { amount, approximateUpperAmount } = spent && date === nextDueDate ? getPlanRemaining(plan, spent) : plan;
    return { date, amount, type: plan.type, ...(approximateUpperAmount === undefined ? {} : { approximateUpperAmount }) };
  });
};
