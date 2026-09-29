import { CategoryDef, Frequency, RecurringPlan, Transaction, TransactionType } from '../types';

export interface ValidatedBackup {
  transactions: Transaction[];
  plans: RecurringPlan[];
  cycleStartDay: number;
  deletedIds: Record<string, number>;
  categoryDefs?: CategoryDef[];
  transactionDeletedIds?: Record<string, number>;
  planDeletedIds?: Record<string, number>;
  deletedCategoryIds?: Record<string, number>;
  deletedCategoryNames?: Record<string, string>;
  cycleStartDayLastModified?: number;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:%-]{0,199}$/.test(value);
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const validOptionalTimestamp = (item: Record<string, any>, key: string): boolean =>
  item[key] === undefined || isTimestamp(item[key]);
const validTags = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(tag => typeof tag === 'string');
const validType = (value: unknown): value is TransactionType => value === 'income' || value === 'expense';
const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const invalid = (): never => { throw new Error('Backup contains invalid or unsupported data.'); };

function migrateTags(item: Record<string, any>): unknown {
  if (item.tags !== undefined) return item.tags;
  // Known older format: category was a single string.
  if (item.category === undefined) return [];
  return typeof item.category === 'string' ? [item.category] : invalid();
}
function migrateDescription(item: Record<string, any>): unknown {
  if (item.description !== undefined) return item.description;
  // Known older format used `name` for the description.
  return item.name;
}
function migrateCreatedAt(item: Record<string, any>, now: number): number {
  if (item.createdAt !== undefined) return isTimestamp(item.createdAt) ? item.createdAt : invalid();
  if (item.lastModified !== undefined) return isTimestamp(item.lastModified) ? item.lastModified : invalid();
  // Older backups predate creation timestamps; backfill at import time.
  return now;
}

export function validateBackup(input: unknown, now = Date.now()): ValidatedBackup {
  if (!isRecord(input) || !Array.isArray(input.transactions) || !Array.isArray(input.plans)) return invalid();
  if (input.version !== undefined && (!Number.isInteger(input.version) || input.version !== 1)) return invalid();
  if (input.exportDate !== undefined && (typeof input.exportDate !== 'string' || !Number.isFinite(Date.parse(input.exportDate)))) return invalid();
  if (!validOptionalTimestamp(input, 'lastModified')) return invalid();
  const cycleStartDay = input.cycleStartDay === undefined ? 1 : input.cycleStartDay;
  if (!Number.isInteger(cycleStartDay) || cycleStartDay < 1 || cycleStartDay > 31) return invalid();

  const transactions = input.transactions.map((raw: unknown): Transaction => {
    if (!isRecord(raw) || !isId(raw.id) || !isDate(raw.date) || typeof migrateDescription(raw) !== 'string' ||
        !validAmount(raw.amount) || !validType(raw.type) || !validTags(migrateTags(raw)) ||
        (raw.isPaid !== undefined && typeof raw.isPaid !== 'boolean') ||
        (raw.relatedPlanId !== undefined && !isId(raw.relatedPlanId)) ||
        !validOptionalTimestamp(raw, 'lastModified')) return invalid();
    return {
      id: raw.id, date: raw.date, description: migrateDescription(raw) as string, amount: raw.amount,
      type: raw.type, tags: migrateTags(raw) as string[], isPaid: raw.isPaid ?? false,
      ...(raw.relatedPlanId === undefined ? {} : { relatedPlanId: raw.relatedPlanId }),
      createdAt: migrateCreatedAt(raw, now),
      ...(raw.lastModified === undefined ? {} : { lastModified: raw.lastModified }),
    };
  });
  const frequencies = Object.values(Frequency);
  const plans = input.plans.map((raw: unknown): RecurringPlan => {
    if (!isRecord(raw) || !isId(raw.id) || typeof migrateDescription(raw) !== 'string' ||
        !validAmount(raw.amount) || !validType(raw.type) || !frequencies.includes(raw.frequency) ||
        !isDate(raw.startDate) || (raw.endDate !== undefined && !isDate(raw.endDate)) ||
        (raw.maxOccurrences !== undefined && (!Number.isInteger(raw.maxOccurrences) || raw.maxOccurrences < 1)) ||
        (raw.occurrencesGenerated !== undefined && (!Number.isInteger(raw.occurrencesGenerated) || raw.occurrencesGenerated < 0)) ||
        !validTags(migrateTags(raw)) || !validOptionalTimestamp(raw, 'lastModified')) return invalid();
    return {
      id: raw.id, description: migrateDescription(raw) as string, amount: raw.amount, type: raw.type,
      frequency: raw.frequency, startDate: raw.startDate,
      ...(raw.endDate === undefined ? {} : { endDate: raw.endDate }),
      ...(raw.maxOccurrences === undefined ? {} : { maxOccurrences: raw.maxOccurrences }),
      occurrencesGenerated: raw.occurrencesGenerated ?? 0, tags: migrateTags(raw) as string[],
      createdAt: migrateCreatedAt(raw, now),
      ...(raw.lastModified === undefined ? {} : { lastModified: raw.lastModified }),
    };
  });

  let categoryDefs: CategoryDef[] | undefined;
  if (input.categoryDefs !== undefined) {
    if (!Array.isArray(input.categoryDefs)) return invalid();
    categoryDefs = input.categoryDefs.map((raw: unknown) => {
      if (!isRecord(raw) || !isId(raw.id) || typeof raw.name !== 'string' || typeof raw.color !== 'string' ||
          !validOptionalTimestamp(raw, 'lastModified')) return invalid();
      return { id: raw.id, name: raw.name, color: raw.color,
        ...(raw.lastModified === undefined ? {} : { lastModified: raw.lastModified }) };
    });
  } else if (input.savedCategories !== undefined) {
    // Known legacy format: savedCategories was a string array of category names.
    if (!Array.isArray(input.savedCategories) || !input.savedCategories.every((name: unknown) => typeof name === 'string')) return invalid();
    const colors = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
    categoryDefs = input.savedCategories.map((name: string, index: number) => ({
      id: `legacy-category-${index + 1}`, name, color: colors[index % colors.length], lastModified: now,
    }));
  }

  const deletedIds: Record<string, number> = {};
  if (input.deletedIds !== undefined) {
    if (!isRecord(input.deletedIds)) return invalid();
    for (const [id, timestamp] of Object.entries(input.deletedIds)) {
      if (!isId(id) || !isTimestamp(timestamp)) return invalid();
      deletedIds[id] = timestamp;
    }
  }
  const readTimestampMap = (key: string) => {
    const result: Record<string, number> = {};
    const raw = input[key];
    if (raw !== undefined) {
      if (!isRecord(raw)) return invalid();
      for (const [id, timestamp] of Object.entries(raw)) {
        if (!isId(id) || !isTimestamp(timestamp)) return invalid();
        result[id] = timestamp;
      }
    }
    return result;
  };
  const deletedCategoryNames: Record<string, string> = {};
  if (input.deletedCategoryNames !== undefined) {
    if (!isRecord(input.deletedCategoryNames)) return invalid();
    for (const [id, name] of Object.entries(input.deletedCategoryNames)) {
      if (!isId(id) || typeof name !== 'string') return invalid();
      deletedCategoryNames[id] = name;
    }
  }
  if (!validOptionalTimestamp(input, 'cycleStartDayLastModified')) return invalid();
  return {
    transactions, plans, cycleStartDay, deletedIds,
    transactionDeletedIds: readTimestampMap('transactionDeletedIds'),
    planDeletedIds: readTimestampMap('planDeletedIds'),
    deletedCategoryIds: readTimestampMap('deletedCategoryIds'),
    deletedCategoryNames,
    ...(input.cycleStartDayLastModified === undefined ? {} : { cycleStartDayLastModified: input.cycleStartDayLastModified }),
    ...(categoryDefs === undefined ? {} : { categoryDefs }),
  };
}
