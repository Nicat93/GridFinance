
import React from 'react';
import { Transaction, RecurringPlan, FinancialSnapshot } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  plans: RecurringPlan[];
  snapshot: FinancialSnapshot;
}

const AIInsightsModal: React.FC<Props> = () => {
  return null;
};

export default AIInsightsModal;