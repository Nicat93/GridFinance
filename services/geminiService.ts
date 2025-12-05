
import { Transaction, RecurringPlan, FinancialSnapshot } from "../types";

export const generateInsights = async (
  transactions: Transaction[],
  plans: RecurringPlan[],
  snapshot: FinancialSnapshot
): Promise<string> => {
  return "AI features have been disabled.";
};

export const suggestTags = async (description: string): Promise<string[]> => {
    return [];
}