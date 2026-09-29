/** Stable transaction ID for one recurring-plan due date across devices. */
export const getRecurringOccurrenceId = (planId: string, dueDate: string): string =>
    `recurring:${encodeURIComponent(planId)}:${dueDate}`;
