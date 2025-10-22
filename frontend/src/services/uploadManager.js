/*
 * UploadManager singleton
 * - Owns upload queue independent of React component lifecycle
 * - Persists queue/progress to IndexedDB via indexedDBService
 * - Survives route changes; UI can subscribe to state updates
 */

import indexedDBService from './indexedDBService';
import { mediaAPI, uppyAPI } from './api';
import { UPLOAD_CONFIG } from '../constants';

class UploadManager {
  constructor() {
    this.queue = []; // [{ id, file, relativePath, status, progress, s3Key, error }]
    this.subscribers = new Set();
    this.isRunning = false;
    this.concurrent = UPLOAD_CONFIG.maxConcurrentUploads;
    this.activeCount = 0;
    this.initialized = false;
    this._emitThrottled = this._throttle(this._emit.bind(this), 200); // Restored to 200ms for smooth progress
    this.activeWorkers = new Set();
    this._uploadSessionActive = false; // Simple flag to prevent cleanup during uploads
    this._currentSessionTotal = 0; // Fixed total for current upload session
    this._cumulativeCompleted = 0; // Track cumulative completed files across the session
    this._cumulativeFailed = 0; // Track cumulative failed files across the session
    this._cumulativeCancelled = 0; // Track cumulative cancelled files across the session
  }

  // Throttle utility to limit function calls
  _throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  async init() {
    if (this.initialized) return;
    await indexedDBService.init();
    const persisted = await indexedDBService.getQueuedUploads();
    // Normalize persisted entries
    this.queue = (persisted || []).map((u) => ({
      id: u.id,
      file: u.file || null, // may be null if we only persisted meta
      relativePath: u.relativePath || '',
      status: u.status || 'queued',
      progress: u.progress || 0,
      s3Key: u.s3Key || '',
      error: undefined,
    }));
    this.initialized = true;
    this._emit();
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    // immediate push
    try { fn(this.getState()); } catch {}
    return () => this.subscribers.delete(fn);
  }

  getState() {
    // Use Map for O(1) lookups instead of array filtering - much faster for large queues
    const statusCounts = new Map();
    const operationTypeCounts = new Map();
    let totalSize = 0;
    // Upload-only counters (exclude delete/other operations)
    let uploadQueued = 0;
    let uploadInProgress = 0;
    let uploadFailed = 0;
    let uploadCompleted = 0;
    let uploadTotal = 0;
    
    // Single pass through queue for maximum efficiency
    for (const item of this.queue) {
      // Count by status
      statusCounts.set(item.status, (statusCounts.get(item.status) || 0) + 1);
      
      // Count by operation type
      const opType = item.operationType || 'upload';
      operationTypeCounts.set(opType, (operationTypeCounts.get(opType) || 0) + 1);
      
      // Upload-only counters
      if (opType === 'upload') {
        uploadTotal += 1;
        if (item.status === 'queued') uploadQueued += 1;
        else if (item.status === 'uploading') uploadInProgress += 1;
        else if (item.status === 'failed') uploadFailed += 1;
        else if (item.status === 'completed') uploadCompleted += 1;
        // Note: cancelled uploads are excluded from all counts
      }

      // Sum total size
      totalSize += item.size || 0;
    }
    
    // Extract counts with defaults
    const queued = statusCounts.get('queued') || 0;
    const inProgress = statusCounts.get('uploading') || 0;
    const failed = statusCounts.get('failed') || 0;
    const completed = statusCounts.get('completed') || 0;
    const deleteOps = operationTypeCounts.get('delete') || 0;
    const deleteInProgress = statusCounts.get('deleting') || 0;
    
    // Only return recent items for UI display (last 50 items for better performance)
    const recentItems = this.queue
      .slice(-50)
      .map(item => ({
        id: item.id,
        relativePath: item.relativePath,
        status: item.status,
        progress: item.progress,
        s3Key: item.s3Key,
        error: item.error,
        name: item.name,
        operationType: item.operationType || 'upload'
      }));
    
    // Get recent delete operations (last 10 for performance)
    const recentDeleteOperations = this.queue
      .filter(q => q.operationType === 'delete')
      .slice(-10)
      .map(item => ({
        id: item.id,
        status: item.status,
        progress: item.progress,
        completedFiles: item.completedFiles,
        totalFiles: item.totalFiles,
        error: item.error
      }));
    
    const state = {
      isRunning: inProgress > 0,
      activeCount: inProgress,
      total: this.queue.length,
      queued,
      inProgress,
      failed,
      completed,
      // Upload-only breakdown - use stable total during active sessions
      uploadTotal: this._uploadSessionActive ? this._currentSessionTotal : uploadTotal,
      uploadQueued,
      uploadInProgress,
      uploadFailed: this._uploadSessionActive ? this._cumulativeFailed : uploadFailed,
      uploadCancelled: this._uploadSessionActive ? this._cumulativeCancelled : (statusCounts.get('cancelled') || 0),
      uploadCompleted: this._uploadSessionActive ? this._cumulativeCompleted : uploadCompleted,
      items: recentItems,
      deleteOperations: recentDeleteOperations,
      deleteOperationsCount: deleteOps,
      deleteInProgress,
      totalSize,
      percentage: this.queue.length > 0 ? Math.round((completed / this.queue.length) * 100) : 0
    };
    
    return state;
  }

  // Simple cleanup - only run when no uploads are active
  _cleanupCompletedItems() {
    if (this._uploadSessionActive) return; // Don't cleanup during active uploads
    
    const maxQueueSize = 10000;
    if (this.queue.length > maxQueueSize) {
      // Remove oldest completed items only
      const completedItems = this.queue.filter(item => item.status === 'completed');
      if (completedItems.length > 0) {
        completedItems.sort((a, b) => a.id.localeCompare(b.id));
        const toRemove = completedItems.slice(0, Math.min(completedItems.length, this.queue.length - maxQueueSize));
        this.queue = this.queue.filter(item => !toRemove.includes(item));
      }
    }
  }

  // Manual cleanup - call this when uploads are complete or cancelled
  cleanupCompletedItems() {
    this._cleanupCompletedItems();
  }

  // Simple upload session control
  startUploadSession(totalFiles) { 
    this._uploadSessionActive = true;
    this._currentSessionTotal = totalFiles; // Set stable total at start
    this._cumulativeCompleted = 0; // Reset cumulative completed counter
    this._cumulativeFailed = 0; // Reset cumulative failed counter
    this._cumulativeCancelled = 0; // Reset cumulative cancelled counter
  }
  async endUploadSession() { 
    this._uploadSessionActive = false; 
    this._currentSessionTotal = 0; // Reset stable total
    this._cumulativeCompleted = 0; // Reset cumulative completed counter
    this._cumulativeFailed = 0; // Reset cumulative failed counter
    this._cumulativeCancelled = 0; // Reset cumulative cancelled counter
    
    // Mark upload as complete and invalidate cache
    try {
      const completedFileIds = this.queue
        .filter(item => item.status === 'completed' && item.fileId)
        .map(item => item.fileId);
      
      if (completedFileIds.length > 0) {
        const { mediaAPI } = await import('./api');
        await mediaAPI.markUploadComplete(completedFileIds);
      }
    } catch (error) {
      console.error('Failed to mark upload as complete:', error);
    }
    
    this._cleanupCompletedItems(); // Cleanup after upload ends
  }

  // Method to increment cumulative completed counter (for Web Worker uploads)
  incrementCompleted() {
    this._cumulativeCompleted += 1;
    this._emitThrottled();
  }

  // Method to increment cumulative failed counter (for Web Worker uploads)
  incrementFailed() {
    this._cumulativeFailed = (this._cumulativeFailed || 0) + 1;
    this._emitThrottled();
  }

  // Method to increment cumulative cancelled counter (for Web Worker uploads)
  incrementCancelled() {
    this._cumulativeCancelled = (this._cumulativeCancelled || 0) + 1;
    this._emitThrottled();
  }

  // External linkage: allow UI-managed uploads to surface progress in the global queue
  addPlaceholder(name, relativePath = '') {
    const id = `ext_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item = { id, file: null, relativePath, status: 'queued', progress: 0, s3Key: '', error: undefined, name, operationType: 'upload' };
    this.queue.push(item);
    this._emitThrottled();
    return id;
  }

  // Batch placeholder creation - simple and stable
  addPlaceholdersBatch(files) {
    const allPlaceholderIds = [];
    const timestamp = Date.now();
    
    // Create all placeholders at once - no batching complexity
    const items = files.map((file, index) => {
      const id = `ext_${timestamp}_${index}_${Math.random().toString(16).slice(2)}`;
      return { 
        id, 
        file: null,
        relativePath: file.relativePath || '', 
        status: 'queued', 
        progress: 0, 
        s3Key: '', 
        error: undefined, 
        name: file.name,
        size: file.size || 0,
        operationType: 'upload'
      };
    });
    
    this.queue.push(...items);
    allPlaceholderIds.push(...items.map(item => item.id));
    
    this._emitThrottled();
    return allPlaceholderIds;
  }

  // Delete operations
  addDeleteOperation(fileIds, operationType = 'delete') {
    const id = `del_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const item = { 
      id, 
      file: null, 
      relativePath: '', 
      status: 'queued', 
      progress: 0, 
      s3Key: '', 
      error: undefined, 
      name: `${operationType} operation`,
      operationType,
      fileIds,
      totalFiles: fileIds.length,
      completedFiles: 0
    };
    this.queue.push(item);
    this._emitThrottled();
    return id;
  }

  updatePlaceholder(id, { status, progress, error }) {
    const item = this.queue.find(q => q.id === id);
    if (!item) {
      return;
    }
    // Update placeholder status and progress
    if (typeof status === 'string') item.status = status;
    if (typeof progress === 'number') item.progress = progress;
    if (error !== undefined) item.error = error;
    
    // Don't clean up during active uploads - let Web Worker finish all updates first
    // Cleanup will happen when upload is complete or cancelled
    
    // Use immediate emit for status changes to ensure UI updates
    this._emit();
  }

  updateDeleteOperation(id, { status, progress, completedFiles, error }) {
    const item = this.queue.find(q => q.id === id);
    if (!item) {
      return;
    }
    if (typeof status === 'string') item.status = status;
    if (typeof progress === 'number') item.progress = progress;
    if (typeof completedFiles === 'number') item.completedFiles = completedFiles;
    if (error !== undefined) item.error = error;
    
    // Don't clean up during active operations - let operations finish first
    
    // Use immediate emit for status changes to ensure UI updates
    this._emit();
  }

  async addFile(file, { relativePath = '' } = {}) {
    await this.init();
    const id = Date.now() + Math.random();
    const item = { id, file, relativePath, status: 'queued', progress: 0, s3Key: '' };
    this.queue.push(item);
    await indexedDBService.storeUploadQueueItem({ id, relativePath, status: 'queued', progress: 0 });
    this._emit();
    if (this.isRunning) this._tick();
    return id;
  }

  start() {
    this.isRunning = true;
    this._emit();
    this._tick();
  }

  pause() {
    this.isRunning = false;
    this._emit();
  }

  async cancel(id) {
    await this.init();
    this.queue = this.queue.filter((q) => q.id !== id);
    await indexedDBService.removeQueuedUpload(id);
    this._emit();
  }

  // clearStalledUploads removed per product decision; rely on Cancel/auto-clear on completion

  // Clear all uploads (for debugging/reset)
  async clearAll() {
    await this.init();
    this.queue = [];
    await indexedDBService.clearUploadQueue();
    this._emit();
  }

  // Register a Web Worker for cancellation tracking
  registerWorker(worker) {
    this.activeWorkers.add(worker);
  }

  // Unregister a Web Worker
  unregisterWorker(worker) {
    this.activeWorkers.delete(worker);
  }

  // Cancel all active uploads
  async cancelAllUploads() {
    await this.init();
    
    // Mark all upload items as cancelled
    this.queue.forEach(item => {
      if (item.operationType === 'upload' && (item.status === 'queued' || item.status === 'uploading')) {
        item.status = 'cancelled';
        item.progress = 0;
        item.error = 'Upload cancelled';
      }
    });
    
    // Clear upload state
    this.activeCount = 0;
    this.isRunning = false;
    
    // Terminate all active Web Workers
    this.activeWorkers.forEach(worker => {
      try {
        worker.postMessage({ type: 'cancel' });
        setTimeout(() => {
          worker.terminate();
        }, 100);
      } catch (error) {
        console.warn('Error cancelling worker:', error);
      }
    });
    this.activeWorkers.clear();
    
    // Persist changes
    await indexedDBService.clearUploadQueue();
    
    // Emit state change
    this._emit();
    
    // Dispatch global cancel event for any active Web Workers
    window.dispatchEvent(new CustomEvent('cancelAllUploads'));
    
    // Also dispatch the legacy cancelUpload event for backward compatibility
    window.dispatchEvent(new CustomEvent('cancelUpload'));
  }

  async _tick() {
    if (!this.isRunning) return;
    while (this.activeCount < this.concurrent) {
      const next = this.queue.find((q) => q.status === 'queued');
      if (!next) break;
      this._upload(next).catch(() => {});
    }
  }

  async _upload(item) {
    this.activeCount += 1;
    item.status = 'uploading';
    item.progress = 0;
    await this._persistItem(item);
    this._emitThrottled(); // Use throttled emit to reduce flickering

    try {
      // Use the updated get_presigned_urls endpoint that supports bulk
      const presigned = await mediaAPI.getPresignedUrls({
        files: [{
          filename: item.file.name,
          fileType: item.file.type || 'application/octet-stream',
          fileSize: item.file.size || 0,
          relativePath: item.relativePath || '',
        }]
      });

      // Handle bulk response format
      const result = presigned.data.results[0];
      const { url, fields } = result.presignedUrl || {};
      const s3Key = result.s3Key;
      const fileId = result.fileId;

      // Upload via presigned POST
      const formData = new FormData();
      Object.entries(fields || {}).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', item.file);

      await this._xhrPost(url, formData, (pct) => {
        item.progress = pct;
        this._emitThrottled();
      });

      // Mark as completed (file record already created by bulk endpoint)
      item.status = 'completed';
      item.progress = 100;
      item.s3Key = s3Key;
      item.fileId = fileId; // Store fileId for cache invalidation
      await this._persistItem(item);
      this._emitThrottled(); // Use throttled emit to reduce flickering
      
      // Increment cumulative completed counter
      this._cumulativeCompleted += 1;
    } catch (e) {
      item.status = 'failed';
      item.error = e?.message || String(e);
      await this._persistItem(item);
      this._emitThrottled(); // Use throttled emit to reduce flickering
    } finally {
      this.activeCount -= 1;
      // Auto-remove completed from queue after short delay
      if (item.status === 'completed') {
        await indexedDBService.removeQueuedUpload(item.id);
        this.queue = this.queue.filter((q) => q.id !== item.id);
        this._emitThrottled(); // Use throttled emit to reduce flickering
      }
      if (this.isRunning) this._tick();
    }
  }

  // Bulk upload method using the updated get_presigned_urls endpoint
  async bulkUpload(files, relativePath = '') {
    await this.init();
    
    if (files.length === 0) return;
    
    // Start upload session
    this.startUploadSession(files.length);
    
    try {
      // Process files in batches to avoid overwhelming the API
      const batchSize = UPLOAD_CONFIG.bulkBatchSize;
      const batches = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Prepare file metadata for bulk presigned URL request
        const fileMetadata = batch.map(file => ({
          filename: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size || 0,
          relativePath: relativePath
        }));
        
        // Get bulk presigned URLs for this batch
        const bulkResponse = await mediaAPI.getPresignedUrls({
          files: fileMetadata
        });
        const { results } = bulkResponse.data;
        
        // Create upload items for each file in this batch
        const uploadItems = batch.map((file, index) => {
          const id = `bulk_${Date.now()}_${batchIndex}_${index}_${Math.random().toString(16).slice(2)}`;
          const result = results[index];
          
          return {
            id,
            file,
            relativePath,
            status: 'queued',
            progress: 0,
            s3Key: result.s3Key,
            presignedUrl: result.presignedUrl,
            fileId: result.fileId,
            error: undefined,
            operationType: 'upload'
          };
        });
        
        // Add batch items to queue
        this.queue.push(...uploadItems);
        this._emitThrottled(); // Use throttled emit for better performance
        
        // Small delay between batches to prevent overwhelming the API
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Start uploading files concurrently (they're already in the queue)
      this.start();
      
    } catch (error) {
      console.error('Bulk upload failed:', error);
      // Mark all items as failed
      this.queue.forEach(item => {
        if (item.operationType === 'upload' && item.status === 'queued') {
          item.status = 'failed';
          item.error = error.message || 'Bulk upload failed';
        }
      });
      this._emit();
    } finally {
      this.endUploadSession();
    }
  }

  async _bulkUploadItem(item) {
    item.status = 'uploading';
    item.progress = 0;
    this._emit();

    try {
      const { url, fields } = item.presignedUrl || {};
      
      if (!url || !fields) {
        throw new Error('Invalid presigned URL response');
      }

      // Upload via presigned POST
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', item.file);

      await this._xhrPost(url, formData, (pct) => {
        item.progress = pct;
        this._emitThrottled();
      });

      // Mark as completed
      item.status = 'completed';
      item.progress = 100;
      this._emit();
      
    } catch (error) {
      item.status = 'failed';
      item.error = error.message || 'Upload failed';
      this._emit();
    }
  }

  _xhrPost(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        try { onProgress?.(pct); } catch {}
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }

  async _persistItem(item) {
    // Upsert simplified record into uploads store
    await indexedDBService.storeUploadQueueItem({
      id: item.id,
      relativePath: item.relativePath,
      status: item.status,
      progress: item.progress,
      s3Key: item.s3Key || '',
    });
  }

  _emit() {
    const state = this.getState();
    this.subscribers.forEach((fn) => {
      try { fn(state); } catch {}
    });
  }

  _emitThrottled() {
    if (this._throttleTimer) return;
    this._throttleTimer = setTimeout(() => {
      this._throttleTimer = null;
      this._emit();
    }, 200); // Restored to 200ms for smooth progress updates
  }
}

const uploadManager = new UploadManager();
export default uploadManager;



