import { useState, useEffect, useRef, useCallback } from 'react';
import { batchAPI } from '../services/api';

/**
 * Simple hook for polling batch job progress from backend.
 * Replaces complex client-side progress tracking with DB-backed polling.
 * 
 * Usage:
 *   const { progress, batchData, isComplete } = useBatchProgress(batchId);
 *   // progress = 0-100
 *   // batchData = { total_files, processed_files, succeeded_files, failed_files, ... }
 *   // isComplete = true when done
 */
export const useBatchProgress = (batchId, options = {}) => {
  const {
    pollInterval = 2000,  // Poll every 2 seconds
    onComplete,           // Callback when batch completes
    enabled = true        // Can disable polling
  } = options;

  const [batchData, setBatchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const fetchBatchStatus = useCallback(async () => {
    if (!batchId || !enabled) return;

    try {
      setLoading(true);
      const response = await batchAPI.getBatchStatus(batchId);
      const data = response.data;
      
      setBatchData(data);
      setError(null);

      // Check if complete
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        // Stop polling
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        // Call completion callback
        if (onCompleteRef.current) {
          onCompleteRef.current(data);
        }
      }

    } catch (err) {
      console.error('Error fetching batch status:', err);
      setError(err.message || 'Failed to fetch batch status');
    } finally {
      setLoading(false);
    }
  }, [batchId, enabled]);

  // Start polling when batch ID is available
  useEffect(() => {
    if (!batchId || !enabled) {
      return;
    }

    // Initial fetch
    fetchBatchStatus();

    // Set up polling
    pollTimerRef.current = setInterval(fetchBatchStatus, pollInterval);

    // Cleanup on unmount
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [batchId, enabled, pollInterval, fetchBatchStatus]);

  // Computed values
  const progress = batchData?.percentage || 0;
  const isComplete = batchData?.status === 'completed';
  const isFailed = batchData?.status === 'failed';
  const isActive = batchData?.is_active || false;

  return {
    batchData,
    progress,
    isComplete,
    isFailed,
    isActive,
    loading,
    error,
    refetch: fetchBatchStatus
  };
};

export default useBatchProgress;

