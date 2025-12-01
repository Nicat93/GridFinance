import { createClient } from '@supabase/supabase-js';
import { BackupData, SyncConfig, Transaction, RecurringPlan } from '../types';

let supabase: any = null;

export const initSupabase = (url: string, key: string) => {
    if (!url || !key) {
        supabase = null;
        return;
    }
    supabase = createClient(url, key);
};

export const fetchRemoteData = async (config: SyncConfig): Promise<BackupData | null> => {
    if (!supabase || !config.syncId) return null;

    // Assumes a table named 'grid_sync' with columns: id (text), data (jsonb), updated_at (timestamptz)
    // Use maybeSingle() instead of single() so it doesn't error if the row doesn't exist yet
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

// Merge Logic: Newer timestamp wins + Tombstones respect
export const mergeData = (local: BackupData, remote: BackupData): BackupData => {
    const mergedTransactions = new Map<string, Transaction>();
    const mergedPlans = new Map<string, RecurringPlan>();
    
    // Merge Tombstones (Union of deleted IDs, keeping newest timestamp if collision)
    const mergedDeletedIds: { [id: string]: number } = { ...local.deletedIds };
    if (remote.deletedIds) {
        for (const [id, ts] of Object.entries(remote.deletedIds)) {
            if (!mergedDeletedIds[id] || (ts > mergedDeletedIds[id])) {
                mergedDeletedIds[id] = ts;
            }
        }
    }

    const isDeleted = (id: string, itemTs: number) => {
        const deleteTs = mergedDeletedIds[id];
        if (!deleteTs) return false;
        // If deletion timestamp is NEWER than item modification timestamp, it's deleted.
        // (If item was updated AFTER deletion, it's a resurrection, so we keep it)
        return deleteTs > itemTs;
    };

    const mergeList = (localList: any[], remoteList: any[], map: Map<string, any>) => {
        const allItems = [...localList, ...remoteList];
        
        allItems.forEach(item => {
            // Check if deleted
            if (isDeleted(item.id, item.lastModified || 0)) return;

            const existing = map.get(item.id);
            if (existing) {
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

    // Global settings: trust newer dataset timestamp
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