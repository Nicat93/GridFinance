import { Frequency } from '../types';

/** Calendar-date helpers. YYYY-MM-DD values are deliberately kept out of UTC instants. */
export const parseDateOnly = (value: string): { year: number; month: number; day: number } => {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
};

export const formatDateOnly = (date: Date): string =>
  `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

export const todayDateOnly = (now = new Date()): string => formatDateOnly(now);

export const isDateOnlyAfter = (date: string, inclusiveEndDate: string): boolean => date > inclusiveEndDate;

export const dateOnlyToLocalDate = (value: string): Date => {
  const { year, month, day } = parseDateOnly(value);
  return new Date(year, month - 1, day);
};

const monthDate = (year: number, monthIndex: number, day: number): { year: number; monthIndex: number; day: number } => {
  const normalized = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: normalized.getUTCFullYear(), monthIndex: normalized.getUTCMonth(), day: Math.min(day, lastDay) };
};

/** Returns the nth occurrence from the original anchor, clamping short months without drifting the anchor. */
export const addDateOnly = (value: string, frequency: Frequency, count: number): string => {
  const { year, month, day } = parseDateOnly(value);
  if (frequency === Frequency.WEEKLY) {
    const next = new Date(Date.UTC(year, month - 1, day + 7 * count));
    return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1).toString().padStart(2, '0')}-${next.getUTCDate().toString().padStart(2, '0')}`;
  }
  if (frequency === Frequency.MONTHLY) {
    const target = monthDate(year, month - 1 + count, day);
    return `${target.year.toString().padStart(4, '0')}-${(target.monthIndex + 1).toString().padStart(2, '0')}-${target.day.toString().padStart(2, '0')}`;
  }
  if (frequency === Frequency.YEARLY) {
    const target = monthDate(year + count, month - 1, day);
    return `${target.year.toString().padStart(4, '0')}-${(target.monthIndex + 1).toString().padStart(2, '0')}-${target.day.toString().padStart(2, '0')}`;
  }
  return value;
};

/** Billing periods are [configured day, day before next configured day], with month-end clamping. */
export const calculateBillingPeriod = (anchor: Date, startDay: number): { start: Date; end: Date } => {
  const anchorValue = formatDateOnly(anchor);
  let { year, month, day } = parseDateOnly(anchorValue);
  const thisMonthStart = monthDate(year, month - 1, startDay);
  if (day < thisMonthStart.day) {
    const previous = monthDate(year, month - 2, startDay);
    year = previous.year; month = previous.monthIndex + 1; day = previous.day;
  } else {
    year = thisMonthStart.year; month = thisMonthStart.monthIndex + 1; day = thisMonthStart.day;
  }
  const start = new Date(year, month - 1, day);
  const next = monthDate(year, month, startDay);
  const end = new Date(next.year, next.monthIndex, next.day);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};
