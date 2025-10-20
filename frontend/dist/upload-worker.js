// Web Worker for parallel file processing with cancellation support
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
    
    // Token received for authentication
    
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
        console.error('No access token available for upload');
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
      
      // Get bulk presigned URLs using the new endpoint
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
        console.error('Bulk presigned URL failed:', presignedResponse.status, await presignedResponse.text());
        return fileBatch.map(fileData => ({
          success: false,
          file: fileData.name,
          path: fileData.relativePath,
          error: `Bulk presigned URL failed: ${presignedResponse.status}`
        }));
      }
      
      const { results: presignedResults } = await presignedResponse.json();
      
      // Upload each file using its presigned URL
      for (let i = 0; i < fileBatch.length; i++) {
        const fileData = fileBatch[i];
        const presignedData = presignedResults[i];
        
        // Check for cancellation before each file
        if (cancelled) {
          results.push({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: 'Upload cancelled'
          });
          continue;
        }
        
        try {
          // Send individual file progress update
          self.postMessage({
            type: 'progress',
            data: {
              placeholderId: `batch_${batchIndex}_${i}`,
              progress: 50,
              status: 'uploading',
              fileIndex: batchIndex * 50 + i
            }
          });
          
          // Upload to S3 using presigned URL
          const formData = new FormData();
          Object.keys(presignedData.presignedUrl.fields).forEach(key => {
            formData.append(key, presignedData.presignedUrl.fields[key]);
          });
          formData.append('file', fileData.file);
          
          const uploadResponse = await fetch(presignedData.presignedUrl.url, {
            method: 'POST',
            body: formData
          });
          
          // Check for cancellation after upload
          if (cancelled) {
            results.push({
              success: false,
              file: fileData.name,
              path: fileData.relativePath,
              error: 'Upload cancelled'
            });
            continue;
          }
          
          if (uploadResponse.ok) {
            // File record is already created by the bulk endpoint, no need to call markUploadComplete
            results.push({
              success: true,
              file: fileData.name,
              path: fileData.relativePath,
              size: fileData.size
            });
          } else {
            console.error('S3 upload failed:', uploadResponse.status, await uploadResponse.text());
            results.push({
              success: false,
              file: fileData.name,
              path: fileData.relativePath,
              error: `Upload failed: ${uploadResponse.status}`
            });
          }
        } catch (error) {
          console.error('Upload error for', fileData.name, ':', error.message);
          results.push({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: cancelled ? 'Upload cancelled' : error.message
          });
        }
      }
      
    } catch (error) {
      console.error('Batch processing error:', error.message);
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
            placeholderId: null, // Will be set by main thread
            progress: (allResults.length / files.length) * 100,
            status: 'uploading'
          }
        });
      }
      
        // Send final results
        self.postMessage({
          type: 'complete',
          data: {
            results: allResults
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
