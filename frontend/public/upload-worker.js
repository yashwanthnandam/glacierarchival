// Web Worker for parallel file processing with cancellation support and adaptive concurrency
// This runs in a separate thread to avoid blocking the main UI

let accessToken = null;
let apiBaseUrl = 'http://localhost:8000/api'; // Default fallback
let cancelled = false; // shared across messages so cancel propagates

self.onmessage = function(e) {
  const { type, files, sessionId, batchSize, accessToken: token, apiBaseUrl: baseUrl } = e.data;
  
  // Store API base URL if provided
  if (baseUrl) {
    apiBaseUrl = baseUrl;
  }
  
  // Handle cancellation message
  if (type === 'cancel') {
    cancelled = true;
    self.postMessage({
      type: 'cancelled',
      data: { results: [] }
    });
    return;
  }
  
  // Handle upload message
  if (type === 'upload') {
    accessToken = token; // Store the token for use in requests
    cancelled = false;   // reset any previous cancel state at the start of an upload
    
    /**
     * Calculate optimal concurrency based on average file size
     * This prevents memory issues with large files
     */
    const getOptimalConcurrency = (fileBatch) => {
      if (!fileBatch || fileBatch.length === 0) return 12;
      
      const avgFileSize = fileBatch.reduce((sum, f) => sum + (f.size || 0), 0) / fileBatch.length;
      const avgSizeMB = avgFileSize / (1024 * 1024);
      
      // Small files (< 5 MB avg): Use high concurrency
      if (avgSizeMB < 5) {
        return 24; // 24 concurrent for small files (safe for 8GB RAM)
      }
      
      // Medium files (5-20 MB avg): Use moderate concurrency
      if (avgSizeMB < 20) {
        return 16; // 16 concurrent for medium files
      }
      
      // Large files (20-50 MB avg): Use low concurrency
      if (avgSizeMB < 50) {
        return 12; // 12 concurrent for large files
      }
      
      // Very large files (> 50 MB avg): Use minimal concurrency
      return 6; // 6 concurrent for very large files
    };
    
    // Process files in batches
    const processBatch = async (fileBatch, batchIndex) => {
      const results = [];
      
      // Check for cancellation before processing batch
      if (cancelled) {
        return fileBatch.map(fileData => ({
          success: false,
          file: fileData.name,
          path: fileData.relativePath,
          error: 'Upload cancelled'
        }));
      }
      
      try {
        // Check if we have a valid token
        if (!accessToken) {
          return fileBatch.map(fileData => ({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: 'No authentication token available'
          }));
        }
        
        // Prepare file metadata for bulk presigned URL request
        const fileMetadata = fileBatch.map(fileData => ({
          filename: fileData.name,
          fileType: fileData.type,
          fileSize: fileData.size,
          relativePath: fileData.relativePath
        }));
        
        // Calculate optimal concurrency based on file sizes
        const CONCURRENT_UPLOADS = getOptimalConcurrency(fileBatch);
        
        // Retry helper function for network requests
        const retryFetch = async (url, options, maxRetries = 3) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const response = await fetch(url, options);
              if (response.ok) return response;
              
              // Don't retry on 4xx errors (client errors)
              if (response.status >= 400 && response.status < 500) {
                return response;
              }
              
              // Retry on 5xx errors
              if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
                await new Promise(r => setTimeout(r, delay));
              } else {
                return response;
              }
            } catch (error) {
              if (attempt === maxRetries) throw error;
              const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        };
        
        // Get bulk presigned URLs using the bulk endpoint with retry logic
        const presignedResponse = await retryFetch(`${apiBaseUrl}/media-files/get_presigned_urls/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include',
          body: JSON.stringify({
            files: fileMetadata
          })
        }, 3); // 3 retries
        
        // Check for cancellation after API call
        if (cancelled) {
          return fileBatch.map(fileData => ({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: 'Upload cancelled'
          }));
        }
        
        if (!presignedResponse.ok) {
          return fileBatch.map(fileData => ({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: `Bulk presigned URL failed: ${presignedResponse.status}`
          }));
        }
        
        const { presigned_urls: presignedResults } = await presignedResponse.json();
        
        if (presignedResults && presignedResults.length > 0) {
          // Process files
        }
        
        /**
         * Upload a single file to S3
         */
        const uploadFile = async (fileData, presignedData, index) => {
          if (cancelled) {
            return {
              success: false,
              file: fileData.name,
              path: fileData.relativePath,
              error: 'Upload cancelled'
            };
          }
          
          try {
            // Upload to S3 using presigned URL
            const formData = new FormData();
            Object.keys(presignedData.fields).forEach(key => {
              formData.append(key, presignedData.fields[key]);
            });
            formData.append('file', fileData.file);
            
            const uploadStartTime = performance.now();
            const uploadResponse = await fetch(presignedData.url, {
              method: 'POST',
              body: formData
            });
            const uploadEndTime = performance.now();
            const uploadTimeSec = ((uploadEndTime - uploadStartTime) / 1000).toFixed(2);
            
            // Check for cancellation after upload
            if (cancelled) {
              return {
                success: false,
                file: fileData.name,
                path: fileData.relativePath,
                error: 'Upload cancelled'
              };
            }
            
            if (!uploadResponse.ok) {
              return {
                success: false,
                file: fileData.name,
                path: fileData.relativePath,
                error: `Upload failed: ${uploadResponse.status}`
              };
            }
            
            // File record is already created by the bulk endpoint
            const fileSizeMB = ((fileData.size || 0) / 1024 / 1024).toFixed(2);
            const speedMBps = (parseFloat(fileSizeMB) / parseFloat(uploadTimeSec)).toFixed(2);
            
            return {
              success: true,
              file: fileData.name,
              path: fileData.relativePath,
              size: fileData.size,
              uploadTime: uploadTimeSec,
              speed: speedMBps,
              mediaFileId: presignedData.media_file_id,
              s3Key: presignedData.s3_key
            };
            
          } catch (error) {
            return {
              success: false,
              file: fileData.name,
              path: fileData.relativePath,
              error: cancelled ? 'Upload cancelled' : error.message
            };
          }
        };
        
        // Process files with ADAPTIVE controlled concurrency
        const uploadStartTime = performance.now();
        let lastProgressUpdate = 0;
        const PROGRESS_UPDATE_INTERVAL = 200; // Update progress every 200ms max
        
        for (let i = 0; i < fileBatch.length; i += CONCURRENT_UPLOADS) {
          if (cancelled) break;
          
          // Take a chunk of files (up to CONCURRENT_UPLOADS)
          const chunk = fileBatch.slice(i, i + CONCURRENT_UPLOADS);
          const chunkPresigned = presignedResults.slice(i, i + CONCURRENT_UPLOADS);
          
          // Upload this chunk in parallel
          const chunkResults = await Promise.all(
            chunk.map((fileData, idx) => 
              uploadFile(fileData, chunkPresigned[idx], i + idx)
            )
          );
          
          results.push(...chunkResults);
          
          // Throttled progress update - only send every 200ms
          const now = performance.now();
          if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
            lastProgressUpdate = now;
            // Send progress update for this batch
            self.postMessage({
              type: 'progress',
              data: {
                completed: results.length,
                total: fileBatch.length,
                results: results,
                placeholderId: null,
                progress: (results.length / fileBatch.length) * 100,
                status: 'uploading'
              }
            });
          }
          
          // Brief pause to avoid overwhelming the browser
          if (i + CONCURRENT_UPLOADS < fileBatch.length && !cancelled) {
            await new Promise(r => setTimeout(r, 10));
          }
        }
        
        const uploadEndTime = performance.now();
        const totalUploadTimeSec = ((uploadEndTime - uploadStartTime) / 1000).toFixed(2);
        // Totals computed but not logged; results returned to main thread
        
      } catch (error) {
        return fileBatch.map(fileData => ({
          success: false,
          file: fileData.name,
          path: fileData.relativePath,
          error: cancelled ? 'Upload cancelled' : error.message
        }));
      }
      
      return results;
    };
    
    // Process all files in batches
    const processAllFiles = async () => {
      try {
        const allResults = [];
        const overallStartTime = performance.now();
        
        for (let i = 0; i < files.length; i += batchSize) {
          // Check for cancellation before each batch
          if (cancelled) {
            self.postMessage({ type: 'cancelled', results: allResults });
            return;
          }
          
          const batch = files.slice(i, i + batchSize);
          const batchIndex = Math.floor(i / batchSize);
          const batchResults = await processBatch(batch, batchIndex);
          allResults.push(...batchResults);
          
          // Check for cancellation before sending progress
          if (cancelled) {
            self.postMessage({ 
              type: 'cancelled', 
              data: { results: allResults } 
            });
            return;
          }
          
          // Send progress update (not complete)
          self.postMessage({
            type: 'progress',
            data: {
              completed: allResults.length,
              total: files.length,
              results: allResults,
              placeholderId: null,
              progress: (allResults.length / files.length) * 100,
              status: 'uploading'
            }
          });
        }
        
        const overallEndTime = performance.now();
        const totalTimeSec = ((overallEndTime - overallStartTime) / 1000).toFixed(2);
        const totalSizeMB = (files.reduce((sum, f) => sum + (f.size || 0), 0) / 1024 / 1024).toFixed(2);
        const avgSpeedMBps = (parseFloat(totalSizeMB) / parseFloat(totalTimeSec)).toFixed(2);
        const successCount = allResults.filter(r => r.success).length;
        const failCount = allResults.filter(r => !r.success).length;
        
        // Send final results as progress (not complete) since this is just one batch
        self.postMessage({
          type: 'progress',
          data: {
            completed: allResults.length,
            total: files.length,
            results: allResults,
            progress: 100, // Add progress field for main thread detection
            stats: {
              totalFiles: files.length,
              successCount,
              failCount,
              totalSizeMB: parseFloat(totalSizeMB),
              totalTimeSec: parseFloat(totalTimeSec),
              avgSpeedMBps: parseFloat(avgSpeedMBps)
            }
          }
        });

        // Note: complete_upload_batch is now handled by the main thread
        // to avoid Web Worker network issues
      } catch (error) {
        self.postMessage({
          type: 'error',
          data: {
            error: error.message,
            results: []
          }
        });
      }
    };
    
    processAllFiles();
  }
};