/**
 * MongoDB Transaction Utilities
 *
 * ✅ SPRINT 4: MongoDB Transactions for Data Integrity
 *
 * Provides utilities for executing atomic operations with MongoDB transactions.
 * Prevents data inconsistency in bidirectional references.
 */

import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger';

/**
 * Execute operations within a MongoDB transaction
 *
 * @param operations - Async function that performs operations using the session
 * @returns Result of the operations
 *
 * @example
 * await withTransaction(async (session) => {
 *   await Character.updateOne({ _id }, { currentLocationId }, { session });
 *   await Location.updateOne({ _id: locationId }, { $push: { occupants } }, { session });
 * });
 */
export async function withTransaction<T>(
  operations: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    logger.debug('[Transaction] Started transaction', {
      sessionId: session.id
    });

    const result = await operations(session);

    await session.commitTransaction();

    logger.debug('[Transaction] Committed transaction', {
      sessionId: session.id
    });

    return result;

  } catch (error: any) {
    await session.abortTransaction();

    logger.error('[Transaction] Aborted transaction due to error', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    throw error;

  } finally {
    await session.endSession();

    logger.debug('[Transaction] Ended session', {
      sessionId: session.id
    });
  }
}

/**
 * Execute operations within a MongoDB transaction with retry logic
 *
 * Automatically retries transient transaction errors (e.g., write conflicts).
 *
 * @param operations - Async function that performs operations using the session
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Result of the operations
 *
 * @example
 * await withTransactionRetry(async (session) => {
 *   await Character.updateOne({ _id }, { currentLocationId }, { session });
 *   await Location.updateOne({ _id: locationId }, { $push: { occupants } }, { session });
 * }, 5);
 */
export async function withTransactionRetry<T>(
  operations: (session: ClientSession) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(operations);

    } catch (error: any) {
      lastError = error;

      // Check if error is a transient transaction error that can be retried
      const isTransientError = error.hasErrorLabel?.('TransientTransactionError') ||
                              error.code === 112 || // WriteConflict
                              error.code === 251;   // NoSuchTransaction

      if (!isTransientError || attempt === maxRetries) {
        logger.error('[Transaction] Transaction failed after retries', {
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
          isTransientError
        });
        throw error;
      }

      logger.warn('[Transaction] Retrying transaction due to transient error', {
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      });

      // Exponential backoff: wait 100ms, 200ms, 400ms, etc.
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

/**
 * Check if MongoDB is configured for transactions
 *
 * Transactions require:
 * - MongoDB 4.0+ (for replica set)
 * - MongoDB 4.2+ (for standalone with replica set)
 * - Replica set or sharded cluster (not standalone)
 *
 * @returns True if transactions are supported
 */
export async function isTransactionSupported(): Promise<boolean> {
  try {
    if (!mongoose.connection.db) {
      logger.warn('[Transaction] MongoDB connection not established');
      return false;
    }
    const adminDb = mongoose.connection.db.admin();
    const serverInfo = await adminDb.serverStatus();

    // Check if running in replica set mode
    const isReplicaSet = serverInfo.repl?.setName !== undefined;

    if (!isReplicaSet) {
      logger.warn('[Transaction] MongoDB is not running in replica set mode - transactions disabled');
      return false;
    }

    logger.info('[Transaction] MongoDB transactions supported', {
      replicaSetName: serverInfo.repl?.setName,
      version: serverInfo.version
    });

    return true;

  } catch (error: any) {
    logger.error('[Transaction] Failed to check transaction support', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Fallback execution without transaction
 *
 * Used when transactions are not supported (e.g., standalone MongoDB).
 * Operations are executed sequentially without atomicity guarantees.
 *
 * @param operations - Async function that performs operations
 * @returns Result of the operations
 */
export async function withoutTransaction<T>(
  operations: (session: null) => Promise<T>
): Promise<T> {
  logger.warn('[Transaction] Executing operations WITHOUT transaction (no atomicity guarantee)');
  return operations(null);
}

/**
 * Smart transaction wrapper that automatically falls back to non-transactional mode
 *
 * Use this when you want transaction support but need to gracefully handle
 * environments where transactions are not available (e.g., local development).
 *
 * @param operations - Async function that performs operations using the session (or null)
 * @param options - Configuration options
 * @returns Result of the operations
 *
 * @example
 * await smartTransaction(async (session) => {
 *   await Character.updateOne({ _id }, { currentLocationId }, { session });
 *   await Location.updateOne({ _id: locationId }, { $push: { occupants } }, { session });
 * });
 */
export async function smartTransaction<T>(
  operations: (session: ClientSession | null) => Promise<T>,
  options: {
    retries?: number;
    skipTransactionCheck?: boolean;
  } = {}
): Promise<T> {
  const { retries = 3, skipTransactionCheck = false } = options;

  // Check if transactions are supported (cache result for performance)
  if (!skipTransactionCheck) {
    const supported = await isTransactionSupported();
    if (!supported) {
      return withoutTransaction(operations);
    }
  }

  // Use transactions with retry
  return withTransactionRetry(operations, retries);
}
