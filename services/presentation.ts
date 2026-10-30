import { TransactionType } from '../types';

export const formatMoney = (amount: number): string =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatExpenseAmount = (amount: number, approximateUpperAmount?: number): string => {
    if (approximateUpperAmount !== undefined && approximateUpperAmount !== amount) {
        return `−(${formatMoney(amount)} – ${formatMoney(approximateUpperAmount)})`;
    }
    return `−${formatMoney(amount)}`;
};

export const formatTransactionAmount = (type: TransactionType, amount: number, approximateUpperAmount?: number): string =>
    type === 'expense'
        ? formatExpenseAmount(amount, approximateUpperAmount)
        : `+${formatMoney(amount)}`;

export type HistoryEmptyState = 'empty' | 'noMatches';

export const getHistoryEmptyState = (
    transactionCount: number,
    filterText: string,
    startDate?: string,
    endDate?: string,
): HistoryEmptyState => transactionCount === 0 && !filterText.trim() && !startDate && !endDate
    ? 'empty'
    : 'noMatches';

/** Horizontal swipe on the cycle bar: left shows the next cycle, right the previous one. */
export const getCycleSwipeDirection = (dx: number, dy: number, threshold = 40): 'previous' | 'next' | null => {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'previous';
};

/** Fixed width of one expanded-row action button; buttons shrink equally only when the row is narrower. */
export const ROW_ACTION_WIDTH_PX = 58;
const ROW_ACTION_GAP_PX = 8;

/**
 * Places an expanded row's action group horizontally under the pointer that opened it: centred on the tap and
 * clamped inside the row. Keyboard-opened rows (no tap position) keep the full-width layout.
 */
export const getRowActionGroupStyle = (count: number, tapX: number | null): { width?: string; marginLeft?: string } => {
  if (tapX === null) return {};
  const groupWidth = count * ROW_ACTION_WIDTH_PX + (count - 1) * ROW_ACTION_GAP_PX;
  const width = `min(100%, ${groupWidth}px)`;
  return { width, marginLeft: `clamp(0px, ${Math.round(tapX - groupWidth / 2)}px, 100% - ${width})` };
};

/** Horizontal tap position inside a row's action panel (rows and panels share the same left edge and px-2 inset). */
export const getRowTapX = (event: { clientX: number; currentTarget: { getBoundingClientRect: () => { left: number } } }): number =>
  event.clientX - event.currentTarget.getBoundingClientRect().left - 8;
