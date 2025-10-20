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
          console.error('[Worker] No access token available for upload');
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
        
        // Get bulk presigned URLs using the bulk endpoint
        const presignedResponse = await fetch(`${apiBaseUrl}/media-files/get_presigned_urls/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include',
          body: JSON.stringify({
            files: fileMetadata
          })
        });
        
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
          const errorText = await presignedResponse.text();
          console.error(`[Worker] Bulk presigned URL failed: ${presignedResponse.status}`, errorText);
          return fileBatch.map(fileData => ({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: `Bulk presigned URL failed: ${presignedResponse.status}`
          }));
        }
        
        const { results: presignedResults } = await presignedResponse.json();
        
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
            // Send individual file progress update
            self.postMessage({
              type: 'progress',
              data: {
                placeholderId: `batch_${batchIndex}_${index}`,
                progress: 50,
                status: 'uploading',
                fileIndex: index
              }
            });
            
            // Upload to S3 using presigned URL
            const formData = new FormData();
            Object.keys(presignedData.presignedUrl.fields).forEach(key => {
              formData.append(key, presignedData.presignedUrl.fields[key]);
            });
            formData.append('file', fileData.file);
            
            const uploadStartTime = performance.now();
            const uploadResponse = await fetch(presignedData.presignedUrl.url, {
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
              const errorText = await uploadResponse.text();
              console.error(`[Worker] S3 upload failed for ${fileData.name}: ${uploadResponse.status}`, errorText);
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
              speed: speedMBps
            };
            
          } catch (error) {
            console.error(`[Worker] Upload error for ${fileData.name}:`, error.message);
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
          
          // Brief pause to avoid overwhelming the browser
          if (i + CONCURRENT_UPLOADS < fileBatch.length && !cancelled) {
            await new Promise(r => setTimeout(r, 10));
          }
        }
        
        const uploadEndTime = performance.now();
        const totalUploadTimeSec = ((uploadEndTime - uploadStartTime) / 1000).toFixed(2);
        // Totals computed but not logged; results returned to main thread
        
      } catch (error) {
        console.error('[Worker] Batch processing error:', error.message);
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
          
          // Send progress update
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
        
        // Send final results
        self.postMessage({
          type: 'complete',
          data: {
            results: allResults,
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
      } catch (error) {
        console.error('[Web Worker] Error processing files:', error);
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