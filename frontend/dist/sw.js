/**
 * Service Worker for Offline Upload Management
 * Handles background uploads and offline storage
 */

const CACHE_NAME = 'glacier-archival-v1';
const UPLOAD_QUEUE_KEY = 'upload_queue';
const OFFLINE_FILES_KEY = 'offline_files';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch event - handle offline uploads
self.addEventListener('fetch', (event) => {
  // Only handle upload requests (POST/PUT with file data)
  if (event.request.url.includes('/media-files/') && 
      (event.request.method === 'POST' || event.request.method === 'PUT')) {
    
    // Check if this is actually a file upload request
    const contentType = event.request.headers.get('content-type');
    if (contentType && contentType.includes('multipart/form-data')) {
      event.respondWith(handleUploadRequest(event.request));
    } else {
      // Let other requests pass through normally
      return;
    }
  }
});

// Handle upload requests
async function handleUploadRequest(request) {
  try {
    // Clone the request before making the fetch to preserve the body
    const requestClone = request.clone();
    
    // Try to make the request with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    return response;
  } catch (error) {
    console.log('Upload failed, queuing for retry:', error);
    
    // Only queue for retry if it's a network error, not a timeout or other error
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      try {
        // Queue the upload for retry using the cloned request
        await queueUploadForRetry(requestClone);
        
        // Return a response indicating the upload was queued
        return new Response(JSON.stringify({
          status: 'queued',
          message: 'Upload queued for retry when connection is restored'
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (queueError) {
        console.error('Failed to queue upload:', queueError);
        // Return a generic error response
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Upload failed and could not be queued'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // For other errors, let them pass through
      throw error;
    }
  }
}

// Queue upload for retry
async function queueUploadForRetry(request) {
  try {
    // Extract form data from the request
    const uploadData = await request.formData();
    
    const uploadInfo = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: Date.now(),
      retryCount: 0
    };

    // Store upload data in IndexedDB
    await storeUploadInIndexedDB(uploadInfo, uploadData);
    
    // Notify main thread
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'UPLOAD_QUEUED',
          data: uploadInfo
        });
      });
    });
  } catch (error) {
    console.error('Error queuing upload:', error);
  }
}

// Store upload in IndexedDB
async function storeUploadInIndexedDB(uploadInfo, uploadData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GlacierArchivalDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      
      const uploadRecord = {
        id: Date.now() + Math.random(),
        ...uploadInfo,
        data: Array.from(uploadData.entries())
      };
      
      const addRequest = store.add(uploadRecord);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('uploads')) {
        db.createObjectStore('uploads', { keyPath: 'id' });
      }
    };
  });
}

// Background sync for retrying uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'retry-uploads') {
    event.waitUntil(retryQueuedUploads());
  }
});

// Retry queued uploads
async function retryQueuedUploads() {
  try {
    const queuedUploads = await getQueuedUploads();
    
    for (const upload of queuedUploads) {
      try {
        await retryUpload(upload);
        await removeQueuedUpload(upload.id);
      } catch (error) {
        console.error('Retry failed for upload:', upload.id, error);
        upload.retryCount++;
        
        // Remove from queue if too many retries
        if (upload.retryCount >= 3) {
          await removeQueuedUpload(upload.id);
        }
      }
    }
  } catch (error) {
    console.error('Error retrying uploads:', error);
  }
}

// Get queued uploads from IndexedDB
async function getQueuedUploads() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GlacierArchivalDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Retry a single upload
async function retryUpload(upload) {
  const formData = new FormData();
  
  // Reconstruct FormData from stored data
  upload.data.forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  const request = new Request(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: formData
  });
  
  const response = await fetch(request);
  
  if (!response.ok) {
    throw new Error(`Upload failed with status: ${response.status}`);
  }
  
  return response;
}

// Remove queued upload
async function removeQueuedUpload(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GlacierArchivalDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'RETRY_UPLOADS':
      retryQueuedUploads();
      break;
    case 'GET_QUEUE_STATUS':
      getQueuedUploads().then(uploads => {
        event.ports[0].postMessage({ uploads });
      });
      break;
  }
});
