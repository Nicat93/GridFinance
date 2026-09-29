import { Frequency, RecurringPlan } from '../types';
import { addDateOnly, isDateOnlyAfter } from './dateOnly';

/** Stable transaction ID for one recurring-plan due date across devices. */
export const getRecurringOccurrenceId = (planId: string, dueDate: string): string =>
    `recurring:${encodeURIComponent(planId)}:${dueDate}`;

/** Project only occurrences in the requested inclusive date range, jumping to the
 * first matching index so old weekly anchors do not require a linear scan. */
export const getPlanOccurrencesInRange = (plan: RecurringPlan, start: string, end: string): string[] => {
    const firstAvailable = plan.occurrencesGenerated;
    if (plan.maxOccurrences !== undefined && firstAvailable >= plan.maxOccurrences) return [];
    const occurrence = (index: number) => addDateOnly(plan.startDate, plan.frequency, index);
    const lowerBound = (target: string, afterTarget: boolean) => {
        let low = firstAvailable;
        const limit = plan.maxOccurrences ?? Number.MAX_SAFE_INTEGER;
        let high = Math.min(limit, low + 1);
        const matchesLowerBound = (date: string) => afterTarget ? date > target : date >= target;
        while (high < limit && !matchesLowerBound(occurrence(high))) {
            low = high;
            high = Math.min(limit, firstAvailable + (high - firstAvailable) * 2);
        }
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            const date = occurrence(middle);
            if (afterTarget ? date <= target : date < target) low = middle + 1;
            else high = middle;
        }
        return low;
    };

    if (plan.frequency === Frequency.ONE_TIME) {
        const date = occurrence(firstAvailable);
        return date >= start && date <= end && (!plan.endDate || !isDateOnlyAfter(date, plan.endDate)) ? [date] : [];
    }

    const first = lowerBound(start, false);
    const endExclusive = lowerBound(end, true);
    const maxExclusive = plan.maxOccurrences ?? Number.MAX_SAFE_INTEGER;
    const dates: string[] = [];
    for (let index = first; index < Math.min(endExclusive, maxExclusive); index++) {
        const date = occurrence(index);
        if (plan.endDate && isDateOnlyAfter(date, plan.endDate)) break;
        dates.push(date);
    }
    return dates;
};
