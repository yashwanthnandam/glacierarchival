// Web Worker for parallel file processing with cancellation support
// This runs in a separate thread to avoid blocking the main UI

let accessToken = null;
let cancelled = false; // shared across messages so cancel propagates

self.onmessage = function(e) {
  const { type, files, sessionId, batchSize, accessToken: token } = e.data;
  
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
    
    for (let i = 0; i < fileBatch.length; i++) {
      const fileData = fileBatch[i];
      
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
        // Check if we have a valid token
        if (!accessToken) {
          console.error('No access token available for upload');
          results.push({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: 'No authentication token available'
          });
          continue;
        }
        
        // Get presigned URL
        const presignedResponse = await fetch('https://datahibernate.in/api/uppy/presigned-url/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({
            filename: fileData.name,
            fileType: fileData.type,
            fileSize: fileData.size,
            sessionId: sessionId,
            relativePath: fileData.relativePath
          })
        });
        
        // Check for cancellation after API call
        if (cancelled) {
          results.push({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: 'Upload cancelled'
          });
          continue;
        }
        
        if (!presignedResponse.ok) {
          console.error('Presigned URL failed:', presignedResponse.status, await presignedResponse.text());
          results.push({
            success: false,
            file: fileData.name,
            path: fileData.relativePath,
            error: `Presigned URL failed: ${presignedResponse.status}`
          });
          continue;
        }
        
        const { presignedUrl, fileId } = await presignedResponse.json();
        
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
        
        // Upload to S3
        const formData = new FormData();
        Object.keys(presignedUrl.fields).forEach(key => {
          formData.append(key, presignedUrl.fields[key]);
        });
        formData.append('file', fileData.file);
        
        const uploadResponse = await fetch(presignedUrl.url, {
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
          // Mark upload complete
          const completeResponse = await fetch('https://datahibernate.in/api/uppy/upload-complete/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({
              fileId: fileId,
              s3Key: presignedUrl.fields.key,
              etag: uploadResponse.headers.get('ETag')
            })
          });
          
          // Upload completion confirmed
          
          if (completeResponse.ok) {
            results.push({
              success: true,
              file: fileData.name,
              path: fileData.relativePath,
              size: fileData.size
            });
          } else {
            console.error('Upload complete failed:', completeResponse.status, await completeResponse.text());
            results.push({
              success: false,
              file: fileData.name,
              path: fileData.relativePath,
              error: `Upload complete failed: ${completeResponse.status}`
            });
          }
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
    
    return results;
  };
  
  // Process all files in batches
  const processAllFiles = async () => {
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
  };
  
    processAllFiles();
  }
};
