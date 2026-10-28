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

const isDateOnlyString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDateOnly(value);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** One shifted billing cycle, as inclusive YYYY-MM-DD dates. `end` is always the end of a regular cycle. */
export interface CycleShift { start: string; end: string }

/** A saved shift is only trusted when it holds two valid dates in order; anything else is ignored. */
export const parseCycleShift = (value: unknown): CycleShift | null => {
  if (!value || typeof value !== 'object') return null;
  const { start, end } = value as Record<string, unknown>;
  return isDateOnlyString(start) && isDateOnlyString(end) && start <= end ? { start, end } : null;
};

const dayBefore = (date: Date): Date => {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return previous;
};

/**
 * Builds the shift for a chosen start date. A date inside the period being viewed begins the NEXT cycle early:
 * it lasts until that next cycle's regular end. A date in a later cycle begins that cycle late. A date that is
 * already a regular start needs no shift.
 */
export const createCycleShift = (
  target: Date,
  startDay: number,
  viewedPeriod: { start: Date; end: Date },
): CycleShift | null => {
  const start = formatDateOnly(target);
  if (start > formatDateOnly(viewedPeriod.start) && start <= formatDateOnly(viewedPeriod.end)) {
    const afterViewed = new Date(viewedPeriod.end);
    afterViewed.setDate(afterViewed.getDate() + 1);
    return { start, end: formatDateOnly(calculateBillingPeriod(afterViewed, startDay).end) };
  }
  const regular = calculateBillingPeriod(target, startDay);
  return formatDateOnly(regular.start) === start ? null : { start, end: formatDateOnly(regular.end) };
};

/**
 * Billing period with an optional one-cycle shift. The shifted cycle is [start, end]; regular cycles resume the
 * day after `end`. Days before the shift belong to the cycle that precedes the shifted regular cycle, which is
 * ended the day before the shift starts, so periods never overlap and no short stub is left behind.
 */
export const calculateShiftedBillingPeriod = (
  anchor: Date,
  startDay: number,
  shift?: CycleShift | null,
): { start: Date; end: Date } => {
  const regular = calculateBillingPeriod(anchor, startDay);
  const valid = parseCycleShift(shift);
  if (!valid) return regular;

  const anchorValue = formatDateOnly(anchor);
  if (anchorValue >= valid.start && anchorValue <= valid.end) {
    return { start: dateOnlyToLocalDate(valid.start), end: dateOnlyToLocalDate(valid.end) };
  }
  if (anchorValue > valid.end) return regular;

  const shifted = calculateBillingPeriod(dateOnlyToLocalDate(valid.end), startDay);
  if (formatDateOnly(shifted.start) === valid.start) return regular;
  const before = calculateBillingPeriod(dayBefore(shifted.start), startDay);
  if (anchorValue >= formatDateOnly(before.start)) {
    const end = dayBefore(dateOnlyToLocalDate(valid.start));
    end.setHours(23, 59, 59, 999);
    return { start: before.start, end };
  }
  return regular;
};

/** Anchor dates that land in the previous / next billing period, for swiping between cycles. */
export const adjacentPeriodAnchor = (period: { start: Date; end: Date }, direction: 'previous' | 'next'): Date => {
  const anchor = new Date(direction === 'next' ? period.end : period.start);
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + (direction === 'next' ? 1 : -1));
  return anchor;
};

/** The cycle a person last looked at, remembered until the cycle that was current when it was saved ends. */
export interface SavedCycleView { start: string; until: string }

export const parseSavedCycleView = (value: unknown): SavedCycleView | null => {
  if (!value || typeof value !== 'object') return null;
  const { start, until } = value as Record<string, unknown>;
  return isDateOnlyString(start) && isDateOnlyString(until) ? { start, until } : null;
};

/** A viewed cycle other than today's is worth remembering; viewing today's cycle clears the memory. */
export const nextSavedCycleView = (viewedStart: string, currentPeriod: { start: Date; end: Date }): SavedCycleView | null =>
  viewedStart === formatDateOnly(currentPeriod.start) ? null : { start: viewedStart, until: formatDateOnly(currentPeriod.end) };
