import indexedDBService from './indexedDBService';

class OfflineUploadService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async storeOfflineUpload(file, metadata = {}) {
    try {
      await indexedDBService.init();
      
      const uploadRequest = {
        id: Date.now() + Math.random(),
        file: file,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          status: 'pending'
        }
      };

      await indexedDBService.storeFile(file, uploadRequest.metadata);
      
      // Store in upload queue
      const queueData = await indexedDBService.getData('upload_queue') || [];
      queueData.push(uploadRequest);
      await indexedDBService.storeData('upload_queue', queueData);

      return uploadRequest.id;
    } catch (error) {
      console.error('Error storing offline upload:', error);
      throw error;
    }
  }

  async processOfflineQueue() {
    if (!this.isOnline) return;

    try {
      await indexedDBService.init();
      const queueData = await indexedDBService.getData('upload_queue') || [];
      
      if (queueData.length === 0) return;


      for (const uploadRequest of queueData) {
        try {
          // Retrieve file from IndexedDB
          const storedFile = await indexedDBService.getFile(uploadRequest.id);
          
          if (storedFile) {
            // Process the upload
            await this.processUpload(storedFile, uploadRequest.metadata);
            
            // Remove from queue
            await this.removeFromQueue(uploadRequest.id);
          }
        } catch (error) {
          console.error('Error processing offline upload:', uploadRequest.id, error);
          // Mark as failed but keep in queue for retry
          uploadRequest.metadata.status = 'failed';
          uploadRequest.metadata.error = error.message;
          await indexedDBService.storeData('upload_queue', queueData);
        }
      }
    } catch (error) {
      console.error('Error processing offline queue:', error);
    }
  }

  async processUpload(file, metadata) {
    // This would integrate with your actual upload service
    // For now, we'll just simulate the upload
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({ success: true, fileId: Date.now() });
        } else {
          reject(new Error('Simulated upload failure'));
        }
      }, 1000);
    });
  }

  async removeFromQueue(uploadId) {
    try {
      const queueData = await indexedDBService.getData('upload_queue') || [];
      const filteredQueue = queueData.filter(item => item.id !== uploadId);
      await indexedDBService.storeData('upload_queue', filteredQueue);
      
      // Also remove the file from IndexedDB
      await indexedDBService.deleteFile(uploadId);
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }

  async getOfflineQueue() {
    try {
      await indexedDBService.init();
      return await indexedDBService.getQueuedUploads() || [];
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  async clearOfflineQueue() {
    try {
      await indexedDBService.init();
      // Clear all uploads from the queue
      const uploads = await indexedDBService.getQueuedUploads();
      for (const upload of uploads) {
        await indexedDBService.removeQueuedUpload(upload.id);
      }
    } catch (error) {
      console.error('Error clearing offline queue:', error);
    }
  }
}

export default new OfflineUploadService();
