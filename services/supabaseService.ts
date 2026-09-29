








import { createClient } from '@supabase/supabase-js';
import { BackupData, SyncConfig, Transaction, RecurringPlan, CategoryDef } from '../types';

let supabase: any = null;
let supabaseConfig: { url: string; key: string } | null = null;

export interface SyncAuthUser { id: string; email?: string }

const authUser = (user: any): SyncAuthUser | null => user ? { id: user.id, email: user.email } : null;

export const getAuthUser = async (): Promise<SyncAuthUser | null> => {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        return authUser(data.user);
    } catch {
        return null;
    }
};

export const subscribeAuth = (callback: (user: SyncAuthUser | null) => void) => {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        callback(authUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
};

export const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not initialized');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
};

export const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not initialized');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
};

export const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase is not initialized');
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
    });
    if (error) throw error;
};

export const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

const requireOwnerId = async (): Promise<string> => {
    const user = await getAuthUser();
    if (!user) throw new Error('Sign in to synchronize your data');
    return user.id;
};

// --- Interfaces for DB Rows ---
interface DBRow {
    owner_id: string;
    sync_id: string;
    id: string;
    data: any;
    updated_at: number;
    deleted: boolean;
}

/**
 * Initialize Supabase Client
 */
export const initSupabase = (url: string, key: string, options: any = {}) => {
    if (!url || !key) {
        supabase = null;
        supabaseConfig = null;
        return;
    }
    if (supabase && supabaseConfig?.url === url && supabaseConfig.key === key) return;
    supabase = createClient(url, key, {
        ...options,
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            ...options.auth,
        },
    });
    supabaseConfig = { url, key };
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

const fetchPartitionIds = async (table: string, syncId: string): Promise<string[]> => {
    if (!supabase) throw new Error('Supabase is not initialized');
    const ids: string[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from(table)
            .select('id')
            .eq('sync_id', syncId)
            .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as { id: string }[];
        ids.push(...rows.map(row => row.id));
        if (rows.length < pageSize) return ids;
    }
};

/** Tombstone all synchronized records for this syncId and reset shared metadata. */
export const clearSyncData = async (config: SyncConfig): Promise<{ success: boolean; error?: unknown }> => {
    if (!supabase || !config.syncId) return { success: false, error: new Error('Sync is not configured') };
    const timestamp = Date.now();
    try {
        const ownerId = await requireOwnerId();
        const [transactionIds, planIds, categoryIds] = await Promise.all([
            fetchPartitionIds('grid_transactions', config.syncId),
            fetchPartitionIds('grid_plans', config.syncId),
            fetchPartitionIds('grid_categories', config.syncId),
        ]);
        const tombstones = (ids: string[]) => ids.map(id => ({
            owner_id: ownerId,
            sync_id: config.syncId,
            id,
            data: {},
            updated_at: timestamp,
            deleted: true,
        }));

        await batchUpsert('grid_transactions', tombstones(transactionIds));
        await batchUpsert('grid_plans', tombstones(planIds));
        await batchUpsert('grid_categories', tombstones(categoryIds));

        const { error } = await supabase.from('grid_metadata').upsert({
            owner_id: ownerId,
            sync_id: config.syncId,
            cycle_start_day: 1,
            updated_at: timestamp,
        }, { onConflict: 'owner_id,sync_id' });
        if (error) throw error;
        return { success: true };
    } catch (error) {
        // Some tables may already have been tombstoned. Keep local data intact
        // and report failure so the user can retry the idempotent operation.
        return { success: false, error };
    }
};

// Helper: Batch Upsert to avoid payload size limits
const batchUpsert = async (table: string, rows: any[]) => {
    if (!rows.length) return;
    const BATCH_SIZE = 200; 
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'owner_id,sync_id,id' });
        if (error) throw error;
    }
};

/**
 * PULL: Fetches only items that have changed since the last sync.
 */
export type PullChangesResult =
    | {
        success: true;
        changes: {
            transactions: DBRow[];
            plans: DBRow[];
            categories: DBRow[];
            metadata: { cycle_start_day: number, updated_at: number } | null;
            downloadSizeBytes: number;
        };
    }
    | { success: false; error: unknown };

export const pullChanges = async (config: SyncConfig, lastSyncedAt: number): Promise<PullChangesResult> => {
    if (!supabase || !config.syncId) return { success: false, error: new Error('Supabase is not initialized') };

    // SAFETY BUFFER: Subtract 5 minutes (300,000ms) from lastSyncedAt.
    const bufferedTimestamp = Math.max(0, lastSyncedAt - 300000);

    try {
        await requireOwnerId();
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
            success: true,
            changes: {
                transactions: txRows,
                plans: planRows,
                categories: catRows,
                metadata: metaRow as { cycle_start_day: number, updated_at: number } | null,
                downloadSizeBytes
            }
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
        return { success: false, error: e };
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
    lastSyncedAt: number,
    forceUploadIds: { transactions?: string[], plans?: string[] } = {},
    transactionDeletedIds: { [id: string]: number } = deletedIds,
    planDeletedIds: { [id: string]: number } = deletedIds,
    deletedCategoryIds: { [id: string]: number } = {},
    cycleStartDayLastModified = 0,
    deletedCategoryNames: Record<string, string> = {}
): Promise<{ success: boolean, uploadSizeBytes: number }> => {
    if (!supabase || !config.syncId) return { success: false, uploadSizeBytes: 0 };

    let ownerId: string;
    try {
        ownerId = await requireOwnerId();
    } catch (e) {
        console.error('Sync Push Error:', e);
        return { success: false, uploadSizeBytes: 0 };
    }

    // Identify Changed Items (Created/Modified AFTER lastSyncedAt)
    
    // 1. Prepare Transactions
    const txUpserts = transactions
        .filter(t => (t.lastModified || 0) > lastSyncedAt || forceUploadIds.transactions?.includes(t.id))
        .map(t => ({
            owner_id: ownerId,
            sync_id: config.syncId,
            id: t.id,
            data: t,
            updated_at: t.lastModified,
            deleted: false
        }));

    // Add Deletions (Transactions)
    Object.entries(transactionDeletedIds).forEach(([id, ts]) => {
        if (ts > lastSyncedAt) {
            txUpserts.push({
                owner_id: ownerId,
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
        .filter(p => (p.lastModified || 0) > lastSyncedAt || forceUploadIds.plans?.includes(p.id))
        .map(p => ({
            owner_id: ownerId,
            sync_id: config.syncId,
            id: p.id,
            data: p,
            updated_at: p.lastModified,
            deleted: false
        }));
    
    // Add Deletions (Plans)
    const planDeletes: any[] = [];
    Object.entries(planDeletedIds).forEach(([id, ts]) => {
        if (ts > lastSyncedAt) {
             planDeletes.push({
                owner_id: ownerId,
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
            owner_id: ownerId,
            sync_id: config.syncId,
            id: c.id,
            data: c,
            updated_at: c.lastModified,
            deleted: false
        }));
    const catDeletes = Object.entries(deletedCategoryIds)
        .filter(([, ts]) => ts > lastSyncedAt)
        .map(([id, ts]) => ({ owner_id: ownerId, sync_id: config.syncId, id, data: deletedCategoryNames[id] ? { name: deletedCategoryNames[id] } : {}, updated_at: ts, deleted: true }));
    
    // Calculate Upload Size
    let uploadSizeBytes = 0;
    uploadSizeBytes += getPayloadSize(txUpserts);
    uploadSizeBytes += getPayloadSize(planUpserts);
    uploadSizeBytes += getPayloadSize(planDeletes);
    uploadSizeBytes += getPayloadSize(catUpserts);
    uploadSizeBytes += getPayloadSize(catDeletes);

    try {
        // Legacy imports have no trustworthy edit time. Cloud wins an ID collision;
        // otherwise the record gets a fresh timestamp so it can be uploaded safely.
        const uploadLegacy = async (table: string, records: any[], upserts: any[]) => {
            const legacy = records.filter(record => !record.lastModified);
            for (let offset = 0; offset < legacy.length; offset += 100) {
                const chunk = legacy.slice(offset, offset + 100);
                const { data, error } = await supabase.from(table).select('id').eq('sync_id', config.syncId).in('id', chunk.map(record => record.id));
                if (error) throw error;
                const cloudIds = new Set((data || []).map((row: any) => row.id));
                for (const record of chunk) if (!cloudIds.has(record.id)) upserts.push({
                    owner_id: ownerId, sync_id: config.syncId, id: record.id, data: record, updated_at: Date.now(), deleted: false,
                });
            }
        };
        await uploadLegacy('grid_transactions', transactions, txUpserts);
        await uploadLegacy('grid_plans', plans, planUpserts);

        // Bulk Upsert Transactions (Batched)
        await batchUpsert('grid_transactions', txUpserts);

        // Bulk Upsert Plans (Batched)
        await batchUpsert('grid_plans', [...planUpserts, ...planDeletes]);

        // Bulk Upsert Categories (Batched)
        await batchUpsert('grid_categories', [...catUpserts, ...catDeletes]);

        // 4. Upsert Metadata (only if changed)
        if (cycleStartDayLastModified > lastSyncedAt) {
             const metaPayload = {
                owner_id: ownerId,
                sync_id: config.syncId,
                cycle_start_day: cycleStartDay,
                updated_at: cycleStartDayLastModified
             };
             uploadSizeBytes += getPayloadSize(metaPayload);
             
             const { error } = await supabase.from('grid_metadata').upsert(metaPayload, { onConflict: 'owner_id,sync_id' });
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
    const nextTransactionDeletedIds = { ...(current.transactionDeletedIds || {}) };
    const nextPlanDeletedIds = { ...(current.planDeletedIds || {}) };
    const nextDeletedCategoryIds = { ...(current.deletedCategoryIds || {}) };
    const nextDeletedCategoryNames = { ...(current.deletedCategoryNames || {}) };
    let nextCycleDay = current.cycleStartDay;

    // Helper: Merge list
    const applyMerge = (list: any[], remoteRows: DBRow[], trackDeletion = true) => {
        remoteRows.forEach(row => {
            const remoteTs = row.updated_at;

            // Handle Deletion
            if (row.deleted) {
                const idx = list.findIndex(i => i.id === row.id);
                const localTs = idx === -1 ? 0 : (list[idx].lastModified || 0);

                // A newer local edit wins over an older remote tombstone. Do not
                // retain that losing tombstone, so the edit remains pushable.
                if (idx !== -1 && localTs > remoteTs) {
                    return;
                }

                const deletionMap = list === nextPlans ? nextPlanDeletedIds : nextTransactionDeletedIds;
                if (trackDeletion && (!deletionMap[row.id] || remoteTs > deletionMap[row.id])) {
                    deletionMap[row.id] = remoteTs;
                }
                if (idx !== -1) list.splice(idx, 1);
                return;
            }

            // Handle Update/Create
            const deletionMap = list === nextPlans ? nextPlanDeletedIds : nextTransactionDeletedIds;
            if (deletionMap[row.id] && deletionMap[row.id] > remoteTs) {
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
    if (remote.categories) remote.categories.forEach(row => {
        if (row.deleted) {
            const idx = nextCats.findIndex(item => item.id === row.id);
            if (idx >= 0 && (nextCats[idx].lastModified || 0) > row.updated_at) return;
            nextDeletedCategoryIds[row.id] = Math.max(nextDeletedCategoryIds[row.id] || 0, row.updated_at);
            if (row.data?.name) nextDeletedCategoryNames[row.id] = row.data.name;
            if (idx >= 0) nextCats.splice(idx, 1);
        } else {
            if ((nextDeletedCategoryIds[row.id] || 0) >= row.updated_at) return;
            const idx = nextCats.findIndex(item => item.id === row.id);
            if (idx < 0) nextCats.push(row.data);
            else if (row.updated_at > (nextCats[idx].lastModified || 0)) nextCats[idx] = row.data;
        }
    });

    // Apply Metadata
    let nextMetadataTime = current.cycleStartDayLastModified || 0;
    if (remote.metadata && remote.metadata.updated_at > nextMetadataTime) {
        if (remote.metadata.cycle_start_day) {
            nextCycleDay = remote.metadata.cycle_start_day;
            nextMetadataTime = remote.metadata.updated_at;
        }
    }

    return {
        transactions: nextTx,
        plans: nextPlans,
        cycleStartDay: nextCycleDay,
        deletedIds: nextDeletedIds,
        transactionDeletedIds: nextTransactionDeletedIds,
        planDeletedIds: nextPlanDeletedIds,
        deletedCategoryIds: nextDeletedCategoryIds,
        deletedCategoryNames: nextDeletedCategoryNames,
        categoryDefs: nextCats,
        cycleStartDayLastModified: nextMetadataTime,
        lastModified: Date.now()
    };
};
