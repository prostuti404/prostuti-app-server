import mongoose, { ClientSession } from 'mongoose';

let _cachedTransactionSupport: boolean | null = null;

/**
 * Checks whether the current MongoDB deployment supports multi-document transactions.
 * Transactions require a replica set member or mongos router.
 */
export const supportsTransactions = (): boolean => {
    if (_cachedTransactionSupport !== null) {
        return _cachedTransactionSupport;
    }

    try {
        const client = mongoose.connection?.getClient?.();
        const topologyType = (client as any)?.topology?.description?.type;
        if (topologyType) {
            const isSupported =
                typeof topologyType === 'string' &&
                (topologyType.includes('ReplicaSet') || topologyType === 'Sharded');
            _cachedTransactionSupport = isSupported;
            return isSupported;
        }
    } catch {
        // Fallback to checking via trial if topology is unavailable
    }

    return true; // Default to trying transaction if indeterminate
};

/**
 * Reset transaction support cache if connection changes
 */
export const resetTransactionSupportCache = () => {
    _cachedTransactionSupport = null;
};

/**
 * Runs operations inside a MongoDB transaction if supported by the database deployment.
 * If transactions are not supported (e.g. standalone MongoDB instance on EC2 or local dev),
 * it executes the operation without a transaction and triggers a compensating rollback hook if an error occurs.
 */
export const runTransactionSafe = async <T>(
    operation: (session: ClientSession | null) => Promise<T>,
    onRollback?: (error: unknown) => Promise<void> | void,
): Promise<T> => {
    const isSupported = supportsTransactions();

    if (isSupported) {
        let session: ClientSession | null = null;
        try {
            session = await mongoose.startSession();
            session.startTransaction();

            const result = await operation(session);

            await session.commitTransaction();
            return result;
        } catch (error: any) {
            if (session) {
                try {
                    await session.abortTransaction();
                } catch {
                    // Ignore abort error if already aborted or failed
                }
            }

            // Check if failure was because transactions are not supported on this cluster
            const errorMsg = error?.message || '';
            if (
                errorMsg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
                errorMsg.includes('This MongoDB deployment does not support retryable writes')
            ) {
                _cachedTransactionSupport = false;

                // Execute fallback without transaction
                try {
                    return await operation(null);
                } catch (fallbackError) {
                    if (onRollback) {
                        try {
                            await onRollback(fallbackError);
                        } catch (rbErr) {
                            // eslint-disable-next-line no-console
                            console.error('Error during compensating rollback:', rbErr);
                        }
                    }
                    throw fallbackError;
                }
            }

            throw error;
        } finally {
            if (session) {
                try {
                    await session.endSession();
                } catch {
                    // Ignore end session error
                }
            }
        }
    } else {
        // Standalone MongoDB execution path
        try {
            return await operation(null);
        } catch (error) {
            if (onRollback) {
                try {
                    await onRollback(error);
                } catch (rbErr) {
                    // eslint-disable-next-line no-console
                    console.error('Error during compensating rollback:', rbErr);
                }
            }
            throw error;
        }
    }
};

