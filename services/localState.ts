import { BackupData } from '../types';

export type LocalSnapshot = Pick<BackupData, 'transactions' | 'plans' | 'categoryDefs' | 'cycleStartDay' | 'deletedIds' | 'transactionDeletedIds' | 'planDeletedIds' | 'deletedCategoryIds' | 'deletedCategoryNames' | 'cycleStartDayLastModified'> & { syncConfig?: any; localResetAt?: number };

const entityMerge = (local: any[], incoming: any[], tombstones: Record<string, number>) => {
  const result = new Map<string, any>();
  for (const item of [...local, ...incoming]) {
    const old = result.get(item.id);
    if (!old || (item.lastModified || 0) > (old.lastModified || 0)) result.set(item.id, item);
  }
  return [...result.values()].filter(item =>
    !Object.prototype.hasOwnProperty.call(tombstones, item.id) || tombstones[item.id] < (item.lastModified || 0));
};

const mergeTimes = (...maps: Array<Record<string, number> | undefined>) => {
  const result: Record<string, number> = {};
  maps.forEach(map => Object.entries(map || {}).forEach(([id, time]) => result[id] = Math.max(result[id] || 0, time)));
  return result;
};

/** Merge durable snapshots by their existing modification times and tombstones. */
export const mergeLocalSnapshots = (a: LocalSnapshot, b: LocalSnapshot): LocalSnapshot => {
  if ((a.localResetAt || 0) !== (b.localResetAt || 0)) {
    const reset = (a.localResetAt || 0) > (b.localResetAt || 0) ? a : b;
    return { ...reset, localResetAt: Math.max(a.localResetAt || 0, b.localResetAt || 0) };
  }
  const txDeletes = mergeTimes(a.transactionDeletedIds, b.transactionDeletedIds);
  const planDeletes = mergeTimes(a.planDeletedIds, b.planDeletedIds);
  const catDeletes = mergeTimes(a.deletedCategoryIds, b.deletedCategoryIds);
  const categoryDefs = entityMerge(a.categoryDefs || [], b.categoryDefs || [], catDeletes);
  const cycleFromB = (b.cycleStartDayLastModified || 0) > (a.cycleStartDayLastModified || 0);
  return {
    transactions: entityMerge(a.transactions || [], b.transactions || [], txDeletes),
    plans: entityMerge(a.plans || [], b.plans || [], planDeletes),
    categoryDefs,
    cycleStartDay: cycleFromB ? b.cycleStartDay : a.cycleStartDay,
    cycleStartDayLastModified: Math.max(a.cycleStartDayLastModified || 0, b.cycleStartDayLastModified || 0),
    transactionDeletedIds: txDeletes,
    planDeletedIds: planDeletes,
    deletedCategoryIds: catDeletes,
    deletedCategoryNames: { ...(a.deletedCategoryNames || {}), ...(b.deletedCategoryNames || {}) },
    deletedIds: mergeTimes(a.deletedIds, b.deletedIds),
    syncConfig: { ...(a.syncConfig || {}), ...(b.syncConfig || {}), lastSyncedAt: Math.max(a.syncConfig?.lastSyncedAt || 0, b.syncConfig?.lastSyncedAt || 0) },
    localResetAt: a.localResetAt || b.localResetAt || 0,
  };
};

/** Monotonic client logical time, seeded with every known local/sync timestamp. */
export class LogicalClock {
  private last: number;
  constructor(initial = 0, private now: () => number = Date.now) { this.last = initial; }
  next(...knownTimes: number[]) {
    this.last = Math.max(this.now(), this.last + 1, ...knownTimes.map(value => (value || 0) + 1));
    return this.last;
  }
}

const storageKeys: Record<string, keyof LocalSnapshot> = {
  transactions: 'transactions', plans: 'plans', categoryDefs: 'categoryDefs', cycleStartDay: 'cycleStartDay',
  cycleStartDayLastModified: 'cycleStartDayLastModified', transactionDeletedIds: 'transactionDeletedIds',
  planDeletedIds: 'planDeletedIds', deletedCategoryIds: 'deletedCategoryIds', deletedCategoryNames: 'deletedCategoryNames',
  deletedIds: 'deletedIds', syncConfig: 'syncConfig', localResetAt: 'localResetAt',
};

export const readLocalSnapshot = (storage: Storage): LocalSnapshot => {
  const json = (key: string) => { try { return JSON.parse(storage.getItem(key) || (key.endsWith('Ids') || key === 'deletedIds' || key === 'deletedCategoryNames' ? '{}' : '[]')); } catch { return []; } };
  return {
    transactions: json('transactions'), plans: json('plans'), categoryDefs: json('categoryDefs'), cycleStartDay: Number(storage.getItem('cycleStartDay') || 1),
    cycleStartDayLastModified: Number(storage.getItem('cycleStartDayLastModified') || 0), transactionDeletedIds: json('transactionDeletedIds'),
    planDeletedIds: json('planDeletedIds'), deletedCategoryIds: json('deletedCategoryIds'), deletedCategoryNames: json('deletedCategoryNames'),
    deletedIds: json('deletedIds'), syncConfig: json('syncConfig'), localResetAt: Number(storage.getItem('localResetAt') || 0),
  };
};

/** Serialize cross-tab read/merge/write with Web Locks; compare before writing to avoid event loops. */
export const persistMergedSnapshot = async (storage: Storage, state: LocalSnapshot) => {
  const persist = () => {
    const merged = mergeLocalSnapshots(readLocalSnapshot(storage), state);
    for (const [key, field] of Object.entries(storageKeys)) {
      const value = field === 'cycleStartDay' || field === 'cycleStartDayLastModified' ? String((merged as any)[field]) : JSON.stringify((merged as any)[field]);
      if (storage.getItem(key) !== value) storage.setItem(key, value);
    }
    return merged;
  };
  const locks = typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
  return locks?.request ? locks.request('gridfinance-local-state', persist) : persist();
};
