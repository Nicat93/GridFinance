








import { createClient } from '@supabase/supabase-js';
import { BackupData, SyncConfig, Transaction, RecurringPlan, CategoryDef } from '../types';

let supabase: any = null;

// --- Interfaces for DB Rows ---
interface DBRow {
    sync_id: string;
    id: string;
    data: any;
    updated_at: number;
    deleted: boolean;
}

/**
 * Initialize Supabase Client
 */
export const initSupabase = (url: string, key: string) => {
    if (!url || !key) {
        supabase = null;
        return;
    }
    supabase = createClient(url, key);
};

// Helper: Get estimated size of payload in bytes
const getPayloadSize = (data: any) => {
    try {
        return new Blob([JSON.stringify(data)]).size;
    } catch (e) {
        return 0;
    }
};

// Helper: Fetch all rows with pagination to bypass 1000 row limit
const fetchAll = async (table: string, syncId: string, minTime: number): Promise<DBRow[]> => {
    if (!supabase) return [];
    
    let allRows: DBRow[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('sync_id', syncId)
            .gt('updated_at', minTime)
            .range(from, to);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            allRows = allRows.concat(data as DBRow[]);
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }
    return allRows;
};

// Helper: Batch Upsert to avoid payload size limits
const batchUpsert = async (table: string, rows: any[]) => {
    if (!rows.length) return;
    const BATCH_SIZE = 200; 
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(table).upsert(chunk);
        if (error) throw error;
    }
};

/**
 * PULL: Fetches only items that have changed since the last sync.
 */
export const pullChanges = async (config: SyncConfig, lastSyncedAt: number) => {
    if (!supabase || !config.syncId) return null;

    // SAFETY BUFFER: Subtract 5 minutes (300,000ms) from lastSyncedAt.
    const bufferedTimestamp = Math.max(0, lastSyncedAt - 300000);

    try {
        // 1. Fetch changed Transactions (with pagination)
        const txRows = await fetchAll('grid_transactions', config.syncId, bufferedTimestamp);

        // 2. Fetch changed Plans (with pagination)
        const planRows = await fetchAll('grid_plans', config.syncId, bufferedTimestamp);
        
        // 3. Fetch changed Categories (with pagination)
        const catRows = await fetchAll('grid_categories', config.syncId, bufferedTimestamp);

        // 4. Fetch Metadata (Cycle Start Day)
        const { data: metaRow, error: metaError } = await supabase
            .from('grid_metadata')
            .select('*')
            .eq('sync_id', config.syncId)
            .maybeSingle();

        if (metaError) throw metaError;

        // Calculate download size
        const downloadSizeBytes = getPayloadSize(txRows) + getPayloadSize(planRows) + getPayloadSize(catRows) + (metaRow ? getPayloadSize(metaRow) : 0);

        return {
            transactions: txRows,
            plans: planRows,
            categories: catRows,
            metadata: metaRow as { cycle_start_day: number, updated_at: number } | null,
            downloadSizeBytes
        };

    } catch (e: any) {
        // Handle Network Errors gracefully
        const msg = (e.message || String(e)).toLowerCase();
        const isNetworkError = 
            msg.includes('network') || 
            msg.includes('fetch') || 
            msg.includes('connection') ||
            msg.includes('offline') ||
            msg.includes('load failed') ||
            (e.name === 'TypeError'); // TypeError is thrown by fetch on network failure

        if (isNetworkError) {
            console.warn("Sync paused: Network unavailable.");
        } else {
            console.error("Sync Pull Error:", e);
            if (msg.includes('relation') && msg.includes('does not exist')) {
                console.error("IMPORTANT: You must run the SQL migration script in Supabase to create 'grid_transactions', 'grid_plans', and 'grid_categories' tables.");
            }
        }
        return null;
    }
};

/**
 * PUSH: Upserts only items that have changed locally.
 */
export const pushChanges = async (
    config: SyncConfig, 
    transactions: Transaction[], 
    plans: RecurringPlan[], 
    categoryDefs: CategoryDef[],
    deletedIds: { [id: string]: number },
    cycleStartDay: number,
    lastSyncedAt: number
): Promise<{ success: boolean, uploadSizeBytes: number }> => {
    if (!supabase || !config.syncId) return { success: false, uploadSizeBytes: 0 };

    // Identify Changed Items (Created/Modified AFTER lastSyncedAt)
    
    // 1. Prepare Transactions
    const txUpserts = transactions
        .filter(t => (t.lastModified || 0) > lastSyncedAt)
        .map(t => ({
            sync_id: config.syncId,
            id: t.id,
            data: t,
            updated_at: t.lastModified,
            deleted: false
        }));

    // Add Deletions (Transactions)
    Object.entries(deletedIds).forEach(([id, ts]) => {
        if (ts > lastSyncedAt) {
            txUpserts.push({
                sync_id: config.syncId,
                id: id,
                data: {} as any, // Empty data for tombstone
                updated_at: ts,
                deleted: true
            });
        }
    });

    // 2. Prepare Plans
    const planUpserts = plans
        .filter(p => (p.lastModified || 0) > lastSyncedAt)
        .map(p => ({
            sync_id: config.syncId,
            id: p.id,
            data: p,
            updated_at: p.lastModified,
            deleted: false
        }));
    
    // Add Deletions (Plans)
    const planDeletes: any[] = [];
    Object.entries(deletedIds).forEach(([id, ts]) => {
        if (ts > lastSyncedAt) {
             planDeletes.push({
                sync_id: config.syncId,
                id: id,
                data: {} as any,
                updated_at: ts,
                deleted: true
            });
        }
    });

    // 3. Prepare Categories
    const catUpserts = categoryDefs
        .filter(c => (c.lastModified || 0) > lastSyncedAt)
        .map(c => ({
            sync_id: config.syncId,
            id: c.id,
            data: c,
            updated_at: c.lastModified,
            deleted: false
        }));
    
    // Calculate Upload Size
    let uploadSizeBytes = 0;
    uploadSizeBytes += getPayloadSize(txUpserts);
    uploadSizeBytes += getPayloadSize(planUpserts);
    uploadSizeBytes += getPayloadSize(planDeletes);
    uploadSizeBytes += getPayloadSize(catUpserts);

    try {
        // Bulk Upsert Transactions (Batched)
        await batchUpsert('grid_transactions', txUpserts);

        // Bulk Upsert Plans (Batched)
        await batchUpsert('grid_plans', [...planUpserts, ...planDeletes]);

        // Bulk Upsert Categories (Batched)
        await batchUpsert('grid_categories', catUpserts);

        // 4. Upsert Metadata (only if changed)
        if (txUpserts.length > 0 || planUpserts.length > 0) {
             const metaPayload = {
                sync_id: config.syncId,
                cycle_start_day: cycleStartDay,
                updated_at: Date.now()
             };
             uploadSizeBytes += getPayloadSize(metaPayload);
             
             const { error } = await supabase.from('grid_metadata').upsert(metaPayload);
             if (error) throw error;
        }

        return { success: true, uploadSizeBytes };
    } catch (e: any) {
        const msg = (e.message || String(e)).toLowerCase();
        const isNetworkError = 
            msg.includes('network') || 
            msg.includes('fetch') || 
            msg.includes('connection') ||
            msg.includes('offline') ||
            msg.includes('load failed') ||
            (e.name === 'TypeError');

        if (isNetworkError) {
            console.warn("Sync paused: Network unavailable during push.");
        } else {
            console.error("Sync Push Error:", e);
        }
        return { success: false, uploadSizeBytes: 0 };
    }
};

/**
 * Merge Deltas into Local State
 */
export const mergeDeltas = (
    current: BackupData, 
    remote: { transactions: DBRow[], plans: DBRow[], categories: DBRow[], metadata: any }
): BackupData => {
    const nextTx = [...current.transactions];
    const nextPlans = [...current.plans];
    const nextCats = [...(current.categoryDefs || [])];
    const nextDeletedIds = { ...current.deletedIds };
    let nextCycleDay = current.cycleStartDay;

    // Helper: Merge list
    const applyMerge = (list: any[], remoteRows: DBRow[]) => {
        remoteRows.forEach(row => {
            const remoteTs = row.updated_at;

            // Handle Deletion
            if (row.deleted) {
                if (!nextDeletedIds[row.id] || remoteTs > nextDeletedIds[row.id]) {
                    nextDeletedIds[row.id] = remoteTs;
                }
                const idx = list.findIndex(i => i.id === row.id);
                if (idx !== -1) list.splice(idx, 1);
                return;
            }

            // Handle Update/Create
            if (nextDeletedIds[row.id] && nextDeletedIds[row.id] > remoteTs) {
                return; // Local deletion is newer
            }

            const idx = list.findIndex(i => i.id === row.id);
            if (idx === -1) {
                list.push(row.data);
            } else {
                const localItem = list[idx];
                const localTs = localItem.lastModified || 0;
                if (remoteTs > localTs) {
                    list[idx] = row.data;
                }
            }
        });
    };

    if (remote.transactions) applyMerge(nextTx, remote.transactions);
    if (remote.plans) applyMerge(nextPlans, remote.plans);
    if (remote.categories) applyMerge(nextCats, remote.categories);

    // Apply Metadata
    if (remote.metadata && remote.metadata.updated_at > (current.lastModified || 0)) {
        if (remote.metadata.cycle_start_day) {
            nextCycleDay = remote.metadata.cycle_start_day;
        }
    }

    return {
        transactions: nextTx,
        plans: nextPlans,
        cycleStartDay: nextCycleDay,
        deletedIds: nextDeletedIds,
        categoryDefs: nextCats,
        lastModified: Date.now()
    };
};