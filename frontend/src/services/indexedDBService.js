/**
 * IndexedDB Service for Offline File Storage
 * Handles local storage of files and upload queue
 */

class IndexedDBService {
  constructor() {
    this.dbName = 'GlacierArchivalDB';
    this.version = 1;
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('userId', 'userId', { unique: false });
          fileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('uploads')) {
          const uploadStore = db.createObjectStore('uploads', { keyPath: 'id' });
          uploadStore.createIndex('timestamp', 'timestamp', { unique: false });
          uploadStore.createIndex('retryCount', 'retryCount', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Store file locally
   */
  async storeFile(file, metadata = {}) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      const fileRecord = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: file,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          userId: metadata.userId || 'anonymous'
        }
      };

      const request = store.add(fileRecord);
      request.onsuccess = () => resolve(fileRecord.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve file from local storage
   */
  async getFile(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files for a user
   */
  async getUserFiles(userId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store upload queue item
   */
  async storeUploadQueueItem(uploadData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');

      const uploadRecord = {
        id: Date.now() + Math.random(),
        ...uploadData,
        timestamp: Date.now(),
        retryCount: 0
      };

      const request = store.add(uploadRecord);
      request.onsuccess = () => resolve(uploadRecord.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all queued uploads
   */
  async getQueuedUploads() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove upload from queue
   */
  async removeQueuedUpload(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store metadata
   */
  async storeMetadata(key, value) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');

      const request = store.put({ key, value, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata
   */
  async getMetadata(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage usage
   */
  async getStorageUsage() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result;
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        resolve({
          fileCount: files.length,
          totalSize: totalSize,
          totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data
   */
  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['files', 'uploads', 'metadata'], 'readwrite');
      
      const clearFiles = transaction.objectStore('files').clear();
      const clearUploads = transaction.objectStore('uploads').clear();
      const clearMetadata = transaction.objectStore('metadata').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear upload queue only
   */
  async clearUploadQueue() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export data for backup
   */
  async exportData() {
    if (!this.db) await this.init();

    const files = await this.getUserFiles('all');
    const uploads = await this.getQueuedUploads();
    
    return {
      files: files,
      uploads: uploads,
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Import data from backup
   */
  async importData(data) {
    if (!this.db) await this.init();

    try {
      // Import files
      for (const file of data.files || []) {
        await this.storeFile(file.data, file.metadata);
      }

      // Import uploads
      for (const upload of data.uploads || []) {
        await this.storeUploadQueueItem(upload);
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

export default new IndexedDBService();
