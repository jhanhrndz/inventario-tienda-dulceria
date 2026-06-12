import { db } from '../db';
import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient';

const STORAGE_KEY_LAST_SYNC = 'supabase_last_sync_timestamp';

export interface SyncResult {
  success: boolean;
  error?: string;
  pushedCount?: number;
  pulledCount?: number;
}

/**
 * Map local Dexie entity (camelCase metadata) to Supabase table row (snake_case metadata)
 */
function toRow(entity: any, userId: string) {
  const row = { ...entity };
  row.user_id = userId;
  
  if (entity._lastModified !== undefined && entity._lastModified !== null) {
    row._last_modified = entity._lastModified;
  } else {
    row._last_modified = Date.now();
  }

  if (entity._deletedAt !== undefined && entity._deletedAt !== null) {
    row._deleted_at = entity._deletedAt;
  } else {
    row._deleted_at = null;
  }

  // Remove Dexie-specific keys
  delete row._syncStatus;
  delete row._lastModified;
  delete row._deletedAt;
  
  return row;
}

/**
 * Map Supabase table row (snake_case metadata) to local Dexie entity (camelCase metadata)
 */
function toLocal(row: any) {
  const local = { ...row };
  
  if (row._last_modified !== undefined && row._last_modified !== null) {
    local._lastModified = Number(row._last_modified);
  }
  if (row._deleted_at !== undefined && row._deleted_at !== null) {
    local._deletedAt = Number(row._deleted_at);
  }
  
  local._syncStatus = 'synced';
  
  // Remove Supabase-specific keys
  delete local._last_modified;
  delete local._deleted_at;
  
  return local;
}

export const syncService = {
  /**
   * Get the last sync timestamp for the current user
   */
  getLastSyncTime(userId: string): number {
    const key = `${STORAGE_KEY_LAST_SYNC}_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? Number(stored) : 0;
  },

  /**
   * Set the last sync timestamp for the current user
   */
  setLastSyncTime(userId: string, timestamp: number): void {
    const key = `${STORAGE_KEY_LAST_SYNC}_${userId}`;
    localStorage.setItem(key, timestamp.toString());
  },

  /**
   * Reset the last sync timestamp (e.g. on logout or sync error recovery)
   */
  resetLastSyncTime(userId: string): void {
    const key = `${STORAGE_KEY_LAST_SYNC}_${userId}`;
    localStorage.removeItem(key);
  },

  /**
   * Perform a full synchronization: Push pending changes, then Pull remote changes.
   */
  async sync(userId: string): Promise<SyncResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase no está configurado.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Error al inicializar el cliente de Supabase.' };
    }

    try {
      // 1. PUSH: Upload local pending changes
      const queueItems = await db.sync_queue.orderBy('timestamp').toArray();
      let pushedCount = 0;

      for (const item of queueItems) {
        const { id, collection, data, type } = item;
        const recordId = (data as any).id;
        
        if (!recordId) {
          // Skip operations without a valid ID
          await db.sync_queue.delete(id);
          continue;
        }

        // Fetch current local state of the record to ensure we push the latest fields
        let currentRecord = await db.table(collection).get(recordId);
        
        // If it doesn't exist locally (hard deleted, shouldn't happen with our soft delete repo)
        // fall back to the queue data
        if (!currentRecord) {
          if (type === 'DELETE') {
            currentRecord = { id: recordId, _deletedAt: item.timestamp };
          } else {
            currentRecord = data;
          }
        }

        const row = toRow(currentRecord, userId);

        // Perform upsert to Supabase
        const { error: upsertError } = await supabase
          .from(collection)
          .upsert(row);

        if (upsertError) {
          console.error(`Error syncing record ${recordId} in ${collection}:`, upsertError);
          // Update queue with error and increment retry
          await db.sync_queue.update(id, {
            retryCount: item.retryCount + 1,
            lastError: upsertError.message
          });
          // Stop push phase on first error to maintain sequence integrity
          return { success: false, error: `Error de subida (${collection}): ${upsertError.message}` };
        }

        // Clean up from queue and mark local record as synced
        await db.sync_queue.delete(id);
        const existsInLocal = await db.table(collection).get(recordId);
        if (existsInLocal) {
          await db.table(collection).update(recordId, { _syncStatus: 'synced' });
        }
        pushedCount++;
      }

      // 2. PULL: Fetch remote changes since last sync
      const lastSyncTime = this.getLastSyncTime(userId);
      const newSyncTime = Date.now();
      let pulledCount = 0;

      const collections = [
        'units',
        'categories',
        'products',
        'stock',
        'unit_conversions',
        'inventory_movements'
      ];

      for (const col of collections) {
        const { data: remoteRows, error: pullError } = await supabase
          .from(col)
          .select('*')
          .eq('user_id', userId)
          .gt('_last_modified', lastSyncTime);

        if (pullError) {
          console.error(`Error pulling records from ${col}:`, pullError);
          return { success: false, error: `Error de bajada (${col}): ${pullError.message}` };
        }

        if (remoteRows && remoteRows.length > 0) {
          for (const row of remoteRows) {
            const localObj = toLocal(row);
            const localRecord = await db.table(col).get(row.id);

            // Merge conflict resolution: Remote wins if remote is newer or if local is already synced
            if (!localRecord) {
              await db.table(col).put(localObj);
              pulledCount++;
            } else {
              const localModified = localRecord._lastModified || 0;
              const remoteModified = localObj._lastModified || 0;
              const isLocalPending = localRecord._syncStatus === 'pending';

              if (!isLocalPending || remoteModified > localModified) {
                await db.table(col).put(localObj);
                pulledCount++;
              }
            }
          }
        }
      }

      // Update last sync timestamp
      this.setLastSyncTime(userId, newSyncTime);

      return {
        success: true,
        pushedCount,
        pulledCount
      };
    } catch (err: any) {
      console.error('Excepción durante la sincronización:', err);
      return { success: false, error: err.message || 'Error de conexión' };
    }
  }
};
