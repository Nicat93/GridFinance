import { createClient } from '@supabase/supabase-js';
import { BackupData, SyncConfig, Transaction, RecurringPlan } from '../types';

let supabase: any = null;

/**
 * Initialize the Supabase client.
 * This can be called multiple times if keys change (e.g. from settings).
 */
export const initSupabase = (url: string, key: string) => {
    if (!url || !key) {
        supabase = null;
        return;
    }
    supabase = createClient(url, key);
};

/**
 * Fetches the remote state from Supabase.
 * Uses `maybeSingle()` to handle the case where the user has no data yet (returns null instead of error).
 */
export const fetchRemoteData = async (config: SyncConfig): Promise<BackupData | null> => {
    if (!supabase || !config.syncId) return null;

    // Assumes a table named 'grid_sync' with columns: 
    // id (text primary key), data (jsonb), updated_at (timestamptz)
    const { data, error } = await supabase
        .from('grid_sync')
        .select('data')
        .eq('id', config.syncId)
        .maybeSingle();

    if (error) {
        console.error("Supabase Fetch Error:", error.message);
        return null;
    }

    if (!data) return null;

    return data.data as BackupData;
};

/**
 * Pushes the merged local state to Supabase.
 * Uses `upsert` to create the row if it doesn't exist or update it if it does.
 */
export const pushRemoteData = async (config: SyncConfig, data: BackupData): Promise<boolean> => {
    if (!supabase || !config.syncId) return false;

    const { error } = await supabase
        .from('grid_sync')
        .upsert({ 
            id: config.syncId, 
            data: data,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error("Supabase Push Error:", error.message);
        return false;
    }
    return true;
};

/**
 * Merges Local and Remote data using a modified Last-Write-Wins (LWW) strategy.
 * 
 * Strategy:
 * 1. Tombstones (Deletions): 
 *    - Combine local and remote deletion logs.
 *    - An item is considered deleted if its ID exists in `deletedIds` AND
 *      the deletion timestamp is newer than the item's `lastModified` timestamp.
 *      (This allows "resurrection" if a user modifies an item on Device A after deleting it on Device B).
 * 
 * 2. Upserts (Updates/Creates):
 *    - Iterate through both lists.
 *    - If an item exists in both, keep the one with the newer `lastModified` timestamp.
 *    - If an item exists in only one, keep it (unless it's deleted).
 */
export const mergeData = (local: BackupData, remote: BackupData): BackupData => {
    const mergedTransactions = new Map<string, Transaction>();
    const mergedPlans = new Map<string, RecurringPlan>();
    
    // 1. Merge Tombstones
    // Union of deleted IDs, keeping the newest timestamp if collision occurs
    const mergedDeletedIds: { [id: string]: number } = { ...local.deletedIds };
    if (remote.deletedIds) {
        for (const [id, ts] of Object.entries(remote.deletedIds)) {
            if (!mergedDeletedIds[id] || (ts > mergedDeletedIds[id])) {
                mergedDeletedIds[id] = ts;
            }
        }
    }

    // Helper to check if an item should be excluded based on the merged tombstone list
    const isDeleted = (id: string, itemTs: number) => {
        const deleteTs = mergedDeletedIds[id];
        if (!deleteTs) return false;
        // It is deleted only if the deletion happened AFTER the last modification.
        return deleteTs > itemTs;
    };

    // 2. Merge Lists (Transactions & Plans)
    const mergeList = (localList: any[], remoteList: any[], map: Map<string, any>) => {
        const allItems = [...localList, ...remoteList];
        
        allItems.forEach(item => {
            // Check tombstone
            if (isDeleted(item.id, item.lastModified || 0)) return;

            const existing = map.get(item.id);
            if (existing) {
                // Conflict: Keep the newer version
                const existingTime = existing.lastModified || 0;
                const itemTime = item.lastModified || 0;
                if (itemTime > existingTime) {
                    map.set(item.id, item);
                }
            } else {
                map.set(item.id, item);
            }
        });
    };

    mergeList(local.transactions, remote.transactions || [], mergedTransactions);
    mergeList(local.plans, remote.plans || [], mergedPlans);

    // 3. Merge Global Settings
    // Simple LWW based on the entire dataset timestamp
    const localTs = local.lastModified || 0;
    const remoteTs = remote.lastModified || 0;
    const cycleStartDay = remoteTs > localTs ? remote.cycleStartDay : local.cycleStartDay;

    return {
        transactions: Array.from(mergedTransactions.values()),
        plans: Array.from(mergedPlans.values()),
        cycleStartDay,
        lastModified: Date.now(),
        deletedIds: mergedDeletedIds
    };
};
