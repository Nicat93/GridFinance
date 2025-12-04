
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

/**
 * PULL: Fetches only items that have changed since the last sync.
 */
export const pullChanges = async (config: SyncConfig, lastSyncedAt: number) => {
    if (!supabase || !config.syncId) return null;

    // SAFETY BUFFER: Subtract 5 minutes (300,000ms) from lastSyncedAt.
    const bufferedTimestamp = Math.max(0, lastSyncedAt - 300000);

    try {
        // 1. Fetch changed Transactions
        const { data: txRows, error: txError } = await supabase
            .from('grid_transactions')
            .select('*')
            .eq('sync_id', config.syncId)
            .gt('updated_at', bufferedTimestamp);

        if (txError) throw txError;

        // 2. Fetch changed Plans
        const { data: planRows, error: planError } = await supabase
            .from('grid_plans')
            .select('*')
            .eq('sync_id', config.syncId)
            .gt('updated_at', bufferedTimestamp);
            
        if (planError) throw planError;
        
        // 3. Fetch changed Categories
        const { data: catRows, error: catError } = await supabase
            .from('grid_categories')
            .select('*')
            .eq('sync_id', config.syncId)
            .gt('updated_at', bufferedTimestamp);
            
        // If table doesn't exist yet, we might get an error. We can optionally ignore or log it.
        // For now, throw to trigger fallback logging in catch block if it's a real issue.
        if (catError && !catError.message.includes('does not exist')) throw catError;

        // 4. Fetch Metadata (Cycle Start Day) - Only if changed
        const { data: metaRow, error: metaError } = await supabase
            .from('grid_metadata')
            .select('*')
            .eq('sync_id', config.syncId)
            .maybeSingle();

        if (metaError) throw metaError;

        return {
            transactions: txRows as DBRow[],
            plans: planRows as DBRow[],
            categories: (catRows || []) as DBRow[],
            metadata: metaRow as { cycle_start_day: number, updated_at: number } | null
        };

    } catch (e: any) {
        console.error("Sync Pull Error:", e.message);
        if (e.message?.includes('relation') && e.message?.includes('does not exist')) {
            console.error("IMPORTANT: You must run the SQL migration script in Supabase to create 'grid_transactions', 'grid_plans', and 'grid_categories' tables.");
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
): Promise<boolean> => {
    if (!supabase || !config.syncId) return false;

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
    
    // Note: We don't currently strictly "delete" categories with tombstones in the UI, 
    // but if we did, we'd handle it here.

    try {
        // Bulk Upsert Transactions
        if (txUpserts.length > 0) {
            const { error } = await supabase.from('grid_transactions').upsert(txUpserts);
            if (error) throw error;
        }

        // Bulk Upsert Plans
        const allPlanUpserts = [...planUpserts, ...planDeletes];
        if (allPlanUpserts.length > 0) {
            const { error } = await supabase.from('grid_plans').upsert(allPlanUpserts);
            if (error) throw error;
        }

        // Bulk Upsert Categories
        if (catUpserts.length > 0) {
            const { error } = await supabase.from('grid_categories').upsert(catUpserts);
            if (error) throw error;
        }

        // 4. Upsert Metadata (only if changed)
        if (txUpserts.length > 0 || planUpserts.length > 0) {
             const { error } = await supabase.from('grid_metadata').upsert({
                sync_id: config.syncId,
                cycle_start_day: cycleStartDay,
                updated_at: Date.now()
             });
             if (error) throw error;
        }

        return true;
    } catch (e: any) {
        console.error("Sync Push Error:", e.message);
        return false;
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

export const mergeData = (l: any, r: any) => l; 
export const fetchRemoteData = async (c: any) => null;
export const pushRemoteData = async (c: any, d: any) => false;
