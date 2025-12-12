/**
 * Offline Transaction Queue Service
 * 
 * Handles queuing and syncing transactions when the device is offline.
 * Transactions are stored locally and synced when connectivity is restored.
 */

import { supabase } from "@/integrations/supabase/client";

export interface QueuedTransaction {
  id: string;
  transactionData: {
    transactionId: string;
    kioskId: string;
    amount: number;
    category: string;
    mobileNumber?: string;
    paymentResult: any;
    createdAt: string;
  };
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

// Local storage key for offline queue
const QUEUE_STORAGE_KEY = 'offline_transaction_queue';
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Check if the device is online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Get all queued transactions from local storage
 */
export const getLocalQueue = (): QueuedTransaction[] => {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[OfflineQueue] Error reading local queue:', error);
    return [];
  }
};

/**
 * Save queue to local storage
 */
const saveLocalQueue = (queue: QueuedTransaction[]): void => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineQueue] Error saving local queue:', error);
  }
};

/**
 * Add a transaction to the offline queue
 */
export const queueTransaction = (transactionData: QueuedTransaction['transactionData']): string => {
  const queue = getLocalQueue();
  
  const queuedItem: QueuedTransaction = {
    id: crypto.randomUUID(),
    transactionData,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  
  queue.push(queuedItem);
  saveLocalQueue(queue);
  
  console.log('[OfflineQueue] Transaction queued:', queuedItem.id);
  return queuedItem.id;
};

/**
 * Sync a single transaction to the server
 */
const syncTransaction = async (item: QueuedTransaction): Promise<boolean> => {
  console.log('[OfflineQueue] Syncing transaction:', item.id);
  
  try {
    const { data, error } = await supabase.functions.invoke('process-payment', {
      body: {
        transactionId: item.transactionData.transactionId,
        kioskId: item.transactionData.kioskId,
        amount: item.transactionData.amount,
        category: item.transactionData.category,
        mobileNumber: item.transactionData.mobileNumber,
        offlineProcessed: true,
        offlinePaymentResult: item.transactionData.paymentResult,
      },
    });
    
    if (error) throw error;
    
    // Also save to the offline_transaction_queue table for tracking
    await supabase.from('offline_transaction_queue').insert({
      id: item.id,
      transaction_data: item.transactionData as any,
      status: 'synced',
      retry_count: item.retryCount,
      synced_at: new Date().toISOString(),
      kiosk_id: item.transactionData.kioskId,
    });
    
    console.log('[OfflineQueue] Transaction synced successfully:', item.id);
    return true;
  } catch (error: any) {
    console.error('[OfflineQueue] Failed to sync transaction:', item.id, error);
    return false;
  }
};

/**
 * Process all pending transactions in the queue
 */
export const processQueue = async (): Promise<{
  synced: number;
  failed: number;
  pending: number;
}> => {
  if (!isOnline()) {
    console.log('[OfflineQueue] Device is offline, skipping sync');
    return { synced: 0, failed: 0, pending: getLocalQueue().length };
  }
  
  const queue = getLocalQueue();
  const pendingItems = queue.filter(item => item.status === 'pending');
  
  console.log('[OfflineQueue] Processing queue:', pendingItems.length, 'pending items');
  
  let synced = 0;
  let failed = 0;
  
  for (const item of pendingItems) {
    const success = await syncTransaction(item);
    
    const itemIndex = queue.findIndex(q => q.id === item.id);
    if (itemIndex === -1) continue;
    
    if (success) {
      queue[itemIndex].status = 'synced';
      synced++;
    } else {
      queue[itemIndex].retryCount++;
      
      if (queue[itemIndex].retryCount >= MAX_RETRY_ATTEMPTS) {
        queue[itemIndex].status = 'failed';
        queue[itemIndex].errorMessage = 'Max retry attempts exceeded';
        failed++;
      }
    }
    
    saveLocalQueue(queue);
  }
  
  const pendingCount = queue.filter(item => item.status === 'pending').length;
  
  console.log('[OfflineQueue] Processing complete:', { synced, failed, pending: pendingCount });
  return { synced, failed, pending: pendingCount };
};

/**
 * Remove synced transactions from local storage (cleanup)
 */
export const cleanupSyncedTransactions = (): number => {
  const queue = getLocalQueue();
  const before = queue.length;
  
  const filtered = queue.filter(item => item.status !== 'synced');
  saveLocalQueue(filtered);
  
  const removed = before - filtered.length;
  console.log('[OfflineQueue] Cleaned up', removed, 'synced transactions');
  return removed;
};

/**
 * Get queue statistics
 */
export const getQueueStats = (): {
  total: number;
  pending: number;
  synced: number;
  failed: number;
} => {
  const queue = getLocalQueue();
  return {
    total: queue.length,
    pending: queue.filter(item => item.status === 'pending').length,
    synced: queue.filter(item => item.status === 'synced').length,
    failed: queue.filter(item => item.status === 'failed').length,
  };
};

/**
 * Start background sync process
 * This should be called when the app initializes
 */
export const startBackgroundSync = (): void => {
  // Sync when coming online
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Device came online, processing queue...');
    processQueue();
  });
  
  // Also try to sync periodically (every 30 seconds)
  setInterval(() => {
    if (isOnline()) {
      processQueue();
    }
  }, 30000);
  
  // Initial sync attempt
  if (isOnline()) {
    processQueue();
  }
  
  console.log('[OfflineQueue] Background sync started');
};

/**
 * Clear the entire offline queue (for testing/reset purposes)
 */
export const clearQueue = (): void => {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
  console.log('[OfflineQueue] Queue cleared');
};
