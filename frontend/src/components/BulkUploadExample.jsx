import React, { useState } from 'react';
import { Button, Box, Typography, LinearProgress } from '@mui/material';
import uploadManager from '../services/uploadManager';

/**
 * Example component demonstrating how to use the new bulk upload functionality
 * This shows how to upload multiple files efficiently using bulk presigned URLs
 */
const BulkUploadExample = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] = useState(null);

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleBulkUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    
    // Subscribe to upload manager state updates
    const unsubscribe = uploadManager.subscribe((state) => {
      setUploadState(state);
    });

    try {
      // Use the new bulk upload method
      await uploadManager.bulkUpload(files, 'bulk-uploads');
      
      console.log('Bulk upload completed!');
      setFiles([]);
    } catch (error) {
      console.error('Bulk upload failed:', error);
    } finally {
      setUploading(false);
      unsubscribe();
    }
  };

  const handleIndividualUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    
    // Subscribe to upload manager state updates
    const unsubscribe = uploadManager.subscribe((state) => {
      setUploadState(state);
    });

    try {
      // Use the traditional individual upload method
      for (const file of files) {
        await uploadManager.addFile(file, { relativePath: 'individual-uploads' });
      }
      
      console.log('Individual uploads completed!');
      setFiles([]);
    } catch (error) {
      console.error('Individual uploads failed:', error);
    } finally {
      setUploading(false);
      unsubscribe();
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Bulk Upload Performance Test
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        This example demonstrates the performance difference between bulk and individual uploads.
        Select multiple files and try both methods to see the difference.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ marginBottom: '16px' }}
        />
        
        {files.length > 0 && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Selected {files.length} files ({files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2)} MB total)
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleBulkUpload}
          disabled={files.length === 0 || uploading}
          color="primary"
        >
          Bulk Upload (Optimized)
        </Button>
        
        <Button
          variant="outlined"
          onClick={handleIndividualUpload}
          disabled={files.length === 0 || uploading}
        >
          Individual Upload (Legacy)
        </Button>
      </Box>

      {uploading && uploadState && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Upload Progress: {uploadState.uploadCompleted}/{uploadState.uploadTotal} files completed
          </Typography>
          
          <LinearProgress 
            variant="determinate" 
            value={(uploadState.uploadCompleted / uploadState.uploadTotal) * 100}
            sx={{ mb: 1 }}
          />
          
          <Typography variant="caption" color="text.secondary">
            {uploadState.uploadInProgress} uploading, {uploadState.uploadFailed} failed
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Performance Benefits of Bulk Upload:
        </Typography>
        <ul>
          <li><strong>Single API call</strong> instead of N calls for N files</li>
          <li><strong>Bulk database insert</strong> instead of individual inserts</li>
          <li><strong>Reduced network overhead</strong> and faster initialization</li>
          <li><strong>Better user experience</strong> with faster upload start</li>
          <li><strong>Concurrent uploads</strong> to S3 with pre-generated URLs</li>
        </ul>
      </Box>
    </Box>
  );
};

export default BulkUploadExample;
