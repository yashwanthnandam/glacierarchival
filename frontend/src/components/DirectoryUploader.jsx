import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  CloudUpload,
  FolderOpen,
  InsertDriveFile,
  CheckCircle,
  Error as ErrorIcon,
  Close,
  Refresh,
  Stop,
  Security,
  Lock,
  LockOpen
} from '@mui/icons-material';
import StorageLimitError from './StorageLimitError';
import { uppyAPI } from '../services/api';
import uploadManager from '../services/uploadManager';
import secureTokenStorage from '../utils/secureTokenStorage';
import { 
  validateFileCollection, 
  checkStorageLimit, 
  checkConcurrentUploads,
  getUploadStrategy,
  formatBytes 
} from '../utils/uploadValidation';
import encryptionService from '../services/encryptionService';

const DirectoryUploader = ({ onUploadComplete, onUploadProgress, defaultRelativePath = '' }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadResults, setUploadResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [storageCheck, setStorageCheck] = useState(null);
  const [uploadStrategy, setUploadStrategy] = useState('standard');
  
  // State for cancellation
  const [abortController, setAbortController] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeWorkers, setActiveWorkers] = useState([]);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const uploadInProgressRef = useRef(false); // Prevent race conditions

  // Check encryption status on mount
  useEffect(() => {
    const checkEncryptionStatus = () => {
      const status = encryptionService.getEncryptionStatus();
      setEncryptionEnabled(status.enabled);
    };
    
    checkEncryptionStatus();
    
    // Listen for encryption status changes
    const interval = setInterval(checkEncryptionStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle file selection (individual files) with validation
  const handleFileSelect = useCallback(async (event) => {
    // Prevent file selection during upload
    if (uploadInProgressRef.current || isUploading) {
      console.warn('Cannot select files while upload is in progress');
      return;
    }
    
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    setUploadStatus('Validating files...');

    try {
      // Validate file collection
      const validation = validateFileCollection(selectedFiles);
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setValidationWarnings(validation.warnings);
        setUploadStatus(`Validation failed: ${validation.errors.length} errors found`);
        return;
      }

      // Check storage limits
      const storageResult = await checkStorageLimit(validation.stats.totalSize);
      if (!storageResult.canUpload) {
        setValidationErrors([storageResult.error]);
        setUploadStatus('Storage limit exceeded');
        return;
      }

      // Check concurrent uploads
      const concurrentCheck = checkConcurrentUploads(0); // TODO: Get actual active uploads
      if (!concurrentCheck.canStart) {
        setValidationErrors([concurrentCheck.error]);
        setUploadStatus('Too many concurrent uploads');
        return;
      }

      // Determine upload strategy
      const strategy = getUploadStrategy(selectedFiles);
      setUploadStrategy(strategy);

      // Individual file upload
      const fileList = [{
        directory: 'Individual Files',
        files: selectedFiles.map(file => ({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          relativePath: defaultRelativePath  // Individual files go to specified directory
        })),
        isDirectory: false
      }];

      setFiles(fileList);
      setValidationErrors([]);
      setValidationWarnings(validation.warnings);
      setStorageCheck(storageResult);
      setUploadStatus(`Ready to upload ${validation.stats.validFiles} files (${formatBytes(validation.stats.totalSize)})`);
    } catch (error) {
      console.error('File validation error:', error);
      setValidationErrors([{
        type: 'VALIDATION_ERROR',
        message: 'File validation failed',
        details: error.message
      }]);
      setUploadStatus('Validation failed');
    }
  }, [defaultRelativePath]);

  // Handle directory selection with progressive processing and validation
  const handleDirectorySelect = useCallback(async (event) => {
    // Prevent directory selection during upload
    if (uploadInProgressRef.current || isUploading) {
      console.warn('Cannot select directories while upload is in progress');
      return;
    }
    
    const all = Array.from(event.target.files);
    if (all.length === 0) return;

    setUploadStatus('Validating directory...');

    try {
      // Validate file collection first
      const validation = validateFileCollection(all);
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        setValidationWarnings(validation.warnings);
        setUploadStatus(`Validation failed: ${validation.errors.length} errors found`);
        return;
      }

      // Check storage limits
      const storageResult = await checkStorageLimit(validation.stats.totalSize);
      if (!storageResult.canUpload) {
        setValidationErrors([storageResult.error]);
        setUploadStatus('Storage limit exceeded');
        return;
      }

      // Check concurrent uploads
      const concurrentCheck = checkConcurrentUploads(0); // TODO: Get actual active uploads
      if (!concurrentCheck.canStart) {
        setValidationErrors([concurrentCheck.error]);
        setUploadStatus('Too many concurrent uploads');
        return;
      }

      // Determine upload strategy
      const strategy = getUploadStrategy(all);
      setUploadStrategy(strategy);

      setUploadStatus('Indexing selected directory...');
      
      // Progressive file processing for better UI responsiveness
      const processFilesProgressively = async (files) => {
    const fileMap = new Map();
      const batchSize = 500; // Process 500 files at a time
      const totalFiles = files.length;
      
      for (let i = 0; i < totalFiles; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        // Process current batch
        for (const file of batch) {
      const relativePath = file.webkitRelativePath;
      const pathParts = relativePath.split('/');
      const fileName = pathParts.pop();
      const directory = pathParts.join('/');

      if (!fileMap.has(directory)) {
        fileMap.set(directory, []);
      }
      fileMap.get(directory).push({
        file, // Keep file reference for actual upload, but we'll clean this up later
        name: fileName,
        size: file.size,
        type: file.type,
        relativePath: defaultRelativePath ? `${defaultRelativePath}/${directory}` : directory
      });
        }
        
        // Update progress and yield to UI thread
        const processed = Math.min(i + batchSize, totalFiles);
        setUploadStatus(`Indexing files... ${processed}/${totalFiles} (${Math.round(processed/totalFiles*100)}%)`);
        
        // Yield to browser to prevent UI freezing
        await new Promise(r => setTimeout(r, 0));
      }
      
      return fileMap;
    };

    try {
      const fileMap = await processFilesProgressively(all);

      // Convert to array format
      const fileList = [];
      fileMap.forEach((filesArr, directory) => {
        fileList.push({
          directory,
          files: filesArr,
          isDirectory: true
        });
      });

      setFiles(fileList);
      setValidationErrors([]);
      setValidationWarnings(validation.warnings);
      setStorageCheck(storageResult);
      setUploadStatus(`Ready to upload ${all.length} files from ${fileMap.size} directories`);
    } catch (error) {
      console.error('Error processing files:', error);
      setValidationErrors([{
        type: 'PROCESSING_ERROR',
        message: 'Error processing files',
        details: error.message
      }]);
      setUploadStatus('Error processing files. Please try again.');
    }
    } catch (error) {
      console.error('Directory validation error:', error);
      setValidationErrors([{
        type: 'VALIDATION_ERROR',
        message: 'Directory validation failed',
        details: error.message
      }]);
      setUploadStatus('Validation failed');
    }
  }, [defaultRelativePath]);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent drag & drop during upload
    if (uploadInProgressRef.current || isUploading) {
      console.warn('Cannot drop files while upload is in progress');
      return;
    }
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    // Check if dropped items contain directories
    const hasDirectories = Array.from(e.dataTransfer.items).some(item => 
      item.kind === 'file' && item.webkitGetAsEntry && item.webkitGetAsEntry().isDirectory
    );

    if (hasDirectories) {
      // Handle directory drop - this is complex, so we'll prompt user to use directory button
      setUploadStatus('Please use "Select Directory" button for directory uploads');
      return;
    }

    // Create a mock event object for individual file handler
    const mockEvent = {
      target: {
        files: droppedFiles
      }
    };
    
    handleFileSelect(mockEvent);
  }, [handleFileSelect]);

  // Create upload session
  const createUploadSession = async () => {
    try {
      const totalFiles = files.reduce((sum, dir) => sum + dir.files.length, 0);
      const directoryStructure = files.map(dir => ({
        directory: dir.directory,
        fileCount: dir.files.length
      }));

      setUploadStatus(`Creating upload session for ${totalFiles} files...`);

      // Add timeout to prevent hanging
      const sessionPromise = uppyAPI.createSession({
        rootDirectory: files[0]?.directory || 'upload',
        totalFiles,
        directoryStructure
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Session creation timeout')), 30000);
      });

      const response = await Promise.race([sessionPromise, timeoutPromise]);

      setSessionId(response.data.sessionId);
      return response.data.sessionId;
    } catch (error) {
      console.error('Failed to create upload session:', error);
      throw error;
    }
  };

  // Simplified retry helper
  const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // Progressive file sorting to avoid UI freezing for large file sets
  const sortFilesProgressively = async (files) => {
    const batchSize = 2000; // Sort 2000 files at a time
    const totalFiles = files.length;
    
    if (totalFiles <= batchSize) {
      // For small file sets, sort normally
      return files.sort((a, b) => a.size - b.size);
    }
    
    // For large file sets, use progressive sorting
    const sortedBatches = [];
    
    for (let i = 0; i < totalFiles; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const sortedBatch = batch.sort((a, b) => a.size - b.size);
      sortedBatches.push(sortedBatch);
      
      // Update progress and yield to UI thread
      const processed = Math.min(i + batchSize, totalFiles);
      setUploadStatus(`Sorting files... ${processed}/${totalFiles} (${Math.round(processed/totalFiles*100)}%)`);
      
      // Yield to browser to prevent UI freezing
      await new Promise(r => setTimeout(r, 0));
    }
    
    // Merge sorted batches (simple merge for better performance)
    const result = [];
    const batchIndices = new Array(sortedBatches.length).fill(0);
    
    while (result.length < totalFiles) {
      let smallestBatch = -1;
      let smallestSize = Infinity;
      
      // Find the batch with the smallest current file
      for (let i = 0; i < sortedBatches.length; i++) {
        if (batchIndices[i] < sortedBatches[i].length) {
          const currentFile = sortedBatches[i][batchIndices[i]];
          if (currentFile.size < smallestSize) {
            smallestSize = currentFile.size;
            smallestBatch = i;
          }
        }
      }
      
      if (smallestBatch >= 0) {
        result.push(sortedBatches[smallestBatch][batchIndices[smallestBatch]]);
        batchIndices[smallestBatch]++;
        
        // Yield periodically during merge
        if (result.length % 1000 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      } else {
          break;
      }
    }
    
    return result;
  };

  // Progressive placeholder creation for large file sets
  const createPlaceholdersProgressively = async (files) => {
    const batchSize = 1000; // Create 1000 placeholders at a time
    const allPlaceholderIds = [];
    const totalFiles = files.length;
    
    for (let i = 0; i < totalFiles; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchIds = uploadManager.addPlaceholdersBatch(batch);
      allPlaceholderIds.push(...batchIds);
      
      // Update progress
      const processed = Math.min(i + batchSize, totalFiles);
      setUploadStatus(`Creating placeholders... ${processed}/${totalFiles} (${Math.round(processed/totalFiles*100)}%)`);
      
      // Yield to UI thread
      await new Promise(r => setTimeout(r, 0));
    }
    
    return allPlaceholderIds;
  };

  // Upload single file with simplified logic
  const uploadFileOptimized = async (fileData, sessionId, controller) => {
    try {
      // Check for cancellation
      if (controller.signal.aborted) {
        const abortErr = new Error('Upload cancelled');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      
      let fileToUpload = fileData.file;
      let encryptionMetadata = null;
      
      // Check if encryption is enabled and encrypt file if needed
      if (encryptionService.isEnabled()) {
        try {
          console.log(`Encrypting file: ${fileData.name}`);
          const { encryptedFile, metadata } = await encryptionService.encryptFileForUpload(
            fileData.file,
            (progress, status) => {
              console.log(`Encryption progress for ${fileData.name}: ${progress}% - ${status}`);
            }
          );
          
          fileToUpload = encryptedFile;
          encryptionMetadata = metadata;
          
          console.log(`File encrypted: ${fileData.name} (${fileData.file.size} → ${encryptedFile.size} bytes)`);
        } catch (encryptionError) {
          console.error(`Encryption failed for ${fileData.name}:`, encryptionError);
          throw new Error(`Encryption failed for ${fileData.name}: ${encryptionError.message}`);
        }
      }
      
      // Get presigned URL with simple retry
      const presignedResponse = await retryOperation(async () => {
        if (controller.signal.aborted) {
          const abortErr = new Error('Upload cancelled');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return await uppyAPI.getPresignedUrl({
        filename: fileData.name,
        fileType: fileToUpload.type,
        fileSize: fileToUpload.size,
        sessionId: sessionId,
        relativePath: fileData.relativePath,
        encryptionMetadata: encryptionMetadata
        });
      });

      const { presignedUrl, fileId } = presignedResponse.data;

      // Upload to S3
      const formData = new FormData();
      Object.keys(presignedUrl.fields).forEach(key => {
        formData.append(key, presignedUrl.fields[key]);
      });
      formData.append('file', fileToUpload);

      // Simple timeout calculation (30 seconds + 1 second per MB)
      const timeout = 30000 + (fileData.size / 1024 / 1024) * 1000;
      const uploadController = new AbortController();
      const timeoutId = setTimeout(() => uploadController.abort(), timeout);

      // Listen for main cancellation
      controller.signal.addEventListener('abort', () => uploadController.abort());

      const uploadResponse = await fetch(presignedUrl.url, {
        method: 'POST',
        body: formData,
        signal: uploadController.signal
      });

      clearTimeout(timeoutId);

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Mark upload complete with simple retry
      await retryOperation(async () => {
        if (controller.signal.aborted) {
          const abortErr = new Error('Upload cancelled');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        return await uppyAPI.markUploadComplete({
        fileId,
        s3Key: presignedUrl.fields.key,
        etag: uploadResponse.headers.get('ETag')
      });
      }, 3, 500);

      return {
        success: true,
        file: fileData.name,
        path: fileData.relativePath,
        size: fileData.size
      };
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Upload cancelled') {
      return {
        success: false,
        file: fileData.name,
        path: fileData.relativePath,
          error: 'Upload cancelled'
        };
      }
      
      console.error(`Upload failed for ${fileData.name}:`, error);
      return {
                success: false,
        file: fileData.name,
        path: fileData.relativePath,
        error: error.message
      };
    }
  };


  // Cancel upload function - Fixed race conditions
  const handleCancel = useCallback(() => {
    setIsCancelling(true);
    setUploadStatus('Cancelling upload...');
    
    try {
      // Abort all active requests atomically
    if (abortController) {
      abortController.abort();
    }
    
      // Send cancel message to all Web Workers first, then terminate them
    activeWorkers.forEach(worker => {
        try {
          // Send cancel message to worker
          worker.postMessage({ type: 'cancel' });
          // Give worker a moment to process cancellation
          setTimeout(() => {
      worker.terminate();
          }, 100);
        } catch (error) {
          console.warn('Error cancelling worker:', error);
        }
    });
    setActiveWorkers([]);
    
      // Clear upload state
      setUploadResults([]);
      
      // Clear placeholders from upload manager (async, don't wait)
      uploadManager.clearAll().catch(error => {
        console.warn('Error clearing upload manager:', error);
      });
      
      // Clean up any remaining completed items
      uploadManager.cleanupCompletedItems();
      
    } catch (error) {
      console.error('Error during cancellation:', error);
    } finally {
      // End upload session to allow cleanup
      uploadManager.endUploadSession();
      
      // Always reset state, even if errors occur
    setIsUploading(false);
    setIsCancelling(false);
    setUploadStatus('Upload cancelled');
    setAbortController(null);
      uploadInProgressRef.current = false; // Reset the atomic flag
    }
  }, [abortController, activeWorkers]);

  // Listen for external cancel events
  React.useEffect(() => {
    const handleCancelEvent = () => {
      if (isUploading) {
        handleCancel();
      }
    };

    window.addEventListener('cancelAllUploads', handleCancelEvent);
    return () => {
      window.removeEventListener('cancelAllUploads', handleCancelEvent);
    };
  }, [isUploading, handleCancel]);

  // Upload all files with Web Workers for maximum performance
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    // Atomic check and set to prevent race conditions
    if (uploadInProgressRef.current || isUploading) {
      console.warn('Upload already in progress, ignoring duplicate request');
      return;
    }
    
    // Set the flag immediately to prevent race conditions
    uploadInProgressRef.current = true;

    // Clear any existing upload state before starting new upload
    try {
      await uploadManager.clearAll();
      setActiveWorkers([]);
    } catch (error) {
      console.warn('Error clearing previous upload state:', error);
    }

    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);
    setIsUploading(true);
    setIsCancelling(false);
    setUploadProgress(0);
    setUploadResults([]);
    setUploadStatus('Creating upload session...');

    try {
      // Calculate total files FIRST for stable progress tracking
      const totalFiles = files.reduce((sum, dir) => sum + dir.files.length, 0);
      
      // Start upload session with stable total to prevent cleanup during upload
      uploadManager.startUploadSession(totalFiles);
      
      // Create upload session FIRST (before any heavy processing)
      const sessionId = await createUploadSession();
      setUploadStatus('Preparing files for upload...');

      // Calculate total files WITHOUT loading all files into memory
      setUploadStatus('Preparing file list...');
      setUploadStatus(`Prepared ${totalFiles} files for upload`);
      
      // Optimized upload logic - use Web Workers for all uploads
      setUploadStatus('Starting uploads...');
      
      // Process files directly from original structure (no large array creation)
      setUploadStatus('Starting streaming upload...');
      await uploadWithWebWorkersStreamingFromStructure(files, sessionId, totalFiles, controller);

      // Check if upload was cancelled
      if (controller.signal.aborted) {
        return;
      }

      // Check if there were any failures
      const failedUploads = uploadResults.filter(r => !r.success);
      
      if (failedUploads.length > 0) {
        setUploadStatus(`Upload completed with ${failedUploads.length} failures`);
        setShowResults(true); // Show results dialog for failures
      } else {
        setUploadStatus(`Upload completed! ${uploadResults.length} files uploaded successfully`);
        // Don't show results dialog for successful uploads
      }
      
      // Clean up completed items after upload is finished
      uploadManager.cleanupCompletedItems();
      
      // Clear file references to free memory
      setFiles([]);
      setUploadResults([]);
    } catch (error) {
      if (error.name === 'AbortError') {
        setUploadStatus('Upload cancelled');
      } else {
        console.error('Upload failed:', error);
        setUploadStatus(`Upload failed: ${error.message}`);
      }
    } finally {
      // End upload session to allow cleanup
      uploadManager.endUploadSession();
      
      setIsUploading(false);
      setIsCancelling(false);
      setAbortController(null);
      uploadInProgressRef.current = false; // Reset the atomic flag
    }
  };

  // Streaming upload directly from file structure (zero memory overhead)
  const uploadWithWebWorkersStreamingFromStructure = async (filesStructure, sessionId, totalFiles, controller) => {
    const batchSize = 100; // Process 100 files at a time
    let processedFiles = 0;
    
    // Process each directory's files in batches
    for (const dir of filesStructure) {
      const dirFiles = dir.files;
      const totalBatches = Math.ceil(dirFiles.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check for cancellation before each batch
        if (controller.signal.aborted) {
          const abortErr = new Error('Upload cancelled');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, dirFiles.length);
        const batchFiles = dirFiles.slice(startIndex, endIndex);
        
        // Convert batch files to upload format
        const batchFilesForUpload = batchFiles.map(file => ({ 
          ...file, 
          directory: dir.directory 
        }));
        
        // Create placeholders for this batch only
        const batchPlaceholderIds = await createPlaceholdersProgressively(batchFilesForUpload);
        
        // Update progress
        processedFiles += batchFiles.length;
        setUploadStatus(`Uploading ${processedFiles}/${totalFiles} files (${Math.round(processedFiles/totalFiles*100)}%)`);
        
        // Process this batch
        await uploadBatchWithWebWorker(batchFilesForUpload, sessionId, controller, batchPlaceholderIds);
        
        // Clean up memory after each batch
        batchFiles.length = 0;
        batchFilesForUpload.length = 0;
        
        // Yield to UI thread between batches
        await new Promise(r => setTimeout(r, 10));
      }
    }
  };

  // Streaming upload with Web Workers (memory-efficient for large file sets)
  const uploadWithWebWorkersStreaming = async (allFiles, sessionId, totalFiles, controller, placeholderIds) => {
    const batchSize = 100; // Process 100 files at a time to limit memory usage
    const totalBatches = Math.ceil(allFiles.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check for cancellation before each batch
      if (controller.signal.aborted) {
        const abortErr = new Error('Upload cancelled');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allFiles.length);
      const batchFiles = allFiles.slice(startIndex, endIndex);
      
      // Update progress
      const processedFiles = startIndex;
      setUploadStatus(`Uploading batch ${batchIndex + 1}/${totalBatches} (${processedFiles}/${totalFiles} files)`);
      
      // Process this batch
      await uploadBatchWithWebWorker(batchFiles, sessionId, controller, placeholderIds.slice(startIndex, endIndex));
      
      // Clean up memory after each batch
      batchFiles.length = 0; // Clear the batch array
      
      // Yield to UI thread between batches
      await new Promise(r => setTimeout(r, 10));
    }
  };

  // Upload a single batch with Web Worker
  const uploadBatchWithWebWorker = async (batchFiles, sessionId, controller, batchPlaceholderIds) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker('/upload-worker.js');
      const workers = [...activeWorkers, worker];
      setActiveWorkers(workers);
      
      // Register worker with uploadManager for global cancellation
      uploadManager.registerWorker(worker);
      
      // Check for cancellation before starting
      if (controller.signal.aborted) {
        worker.terminate();
        const abortErr = new Error('Upload cancelled');
        abortErr.name = 'AbortError';
        reject(abortErr);
        return;
      }
      
      worker.postMessage({
        type: 'upload',
        files: batchFiles,
        sessionId: sessionId,
        batchSize: 50,
        accessToken: secureTokenStorage.getAccessToken()
      });
      
      // Handle cancellation by sending cancel message then terminating the worker
      const abortHandler = () => {
          worker.postMessage({ type: 'cancel' });
          setTimeout(() => {
          worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
            const abortErr = new Error('Upload cancelled');
            abortErr.name = 'AbortError';
            reject(abortErr);
          }, 100);
      };
      
      controller.signal.addEventListener('abort', abortHandler);
      
      let batchResults = [];
      
      worker.onmessage = (e) => {
        const { type, data, ...otherData } = e.data;
        
        if (type === 'progress') {
          // Update individual placeholder progress
          if (data && data.placeholderId) {
            const { placeholderId, progress, status, fileIndex } = data;
            
            // Find the actual placeholder ID based on file index
            if (fileIndex !== undefined && batchPlaceholderIds[fileIndex]) {
              uploadManager.updatePlaceholder(batchPlaceholderIds[fileIndex], { 
                progress: progress || 0, 
                status: status || 'uploading' 
              });
            }
          }
          
          // Collect batch results
          if (data && data.results) {
            batchResults = [...batchResults, ...data.results];
          }
        } else if (type === 'complete') {
          // Final results
          if (data && data.results) {
            batchResults = [...batchResults, ...data.results];
          }
          
          // Update placeholders based on actual results - only mark successful uploads as completed
          batchResults.forEach((result, index) => {
            if (batchPlaceholderIds[index]) {
              if (result.success) {
                uploadManager.updatePlaceholder(batchPlaceholderIds[index], { 
                  status: 'completed', 
                  progress: 100 
                });
              } else {
                uploadManager.updatePlaceholder(batchPlaceholderIds[index], { 
                  status: result.error === 'Upload cancelled' ? 'cancelled' : 'failed', 
                  progress: 0,
                  error: result.error 
                });
              }
            }
          });
          
          // Update upload results
          setUploadResults(prev => [...prev, ...batchResults]);
          
          // Clean up worker
          worker.terminate();
          setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
          uploadManager.unregisterWorker(worker);
          controller.signal.removeEventListener('abort', abortHandler);
          
          resolve(batchResults);
        } else if (type === 'cancelled') {
          // Worker was cancelled - mark all remaining items as cancelled
          batchPlaceholderIds.forEach(placeholderId => {
            uploadManager.updatePlaceholder(placeholderId, { 
              status: 'cancelled', 
              progress: 0, 
              error: 'Upload cancelled' 
            });
          });
          
          worker.terminate();
          setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
          uploadManager.unregisterWorker(worker);
          controller.signal.removeEventListener('abort', abortHandler);
          const abortErr = new Error('Upload cancelled');
          abortErr.name = 'AbortError';
          reject(abortErr);
        } else if (type === 'error') {
      worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
          uploadManager.unregisterWorker(worker);
          controller.signal.removeEventListener('abort', abortHandler);
          reject(new Error(data?.error || 'Unknown error'));
        }
      };
      
      worker.onerror = (error) => {
        worker.terminate();
        setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
        uploadManager.unregisterWorker(worker);
        controller.signal.removeEventListener('abort', abortHandler);
        reject(error);
      };
    });
  };

  // Upload with Web Workers (for large file sets) - DEPRECATED: Use streaming version
  const uploadWithWebWorkers = async (allFiles, sessionId, totalFiles, controller, placeholderIds) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker('/upload-worker.js');
      const workers = [...activeWorkers, worker];
      setActiveWorkers(workers);
      
      // Register worker with uploadManager for global cancellation
      uploadManager.registerWorker(worker);
      
      // Check for cancellation before starting
      if (controller.signal.aborted) {
        worker.terminate();
        const abortErr = new Error('Upload cancelled');
        abortErr.name = 'AbortError';
        reject(abortErr);
        return;
      }
      
      worker.postMessage({
        type: 'upload',
        files: allFiles,
        sessionId: sessionId,
        batchSize: 50, // Increased from 10 to 50 for better performance
        accessToken: secureTokenStorage.getAccessToken()
      });
      
      // Handle cancellation by sending cancel message then terminating the worker
      const abortHandler = () => {
          worker.postMessage({ type: 'cancel' });
          setTimeout(() => {
      worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
            const abortErr = new Error('Upload cancelled');
            abortErr.name = 'AbortError';
            reject(abortErr);
          }, 100);
      };
      
      controller.signal.addEventListener('abort', abortHandler);
      
      let allResults = [];
      
      worker.onmessage = (e) => {
        console.log('Web Worker message received:', e.data);
        const { type, data } = e.data;
        const completed = data?.completed || 0;
        const total = data?.total || 0;
        const batchResults = data?.results || [];
        
        if (type === 'progress') {
          const progress = (completed / total) * 100;
          setUploadProgress(progress);
          setUploadStatus(`Uploading ${completed}/${total} files... (Web Workers)`);
          
          // Process batch results to update placeholder statuses
          if (batchResults && batchResults.length > 0) {
            batchResults.forEach((result, index) => {
              const placeholderId = batchPlaceholderIds[completed - batchResults.length + index];
              if (placeholderId) {
            if (result.success) {
                  uploadManager.updatePlaceholder(placeholderId, { 
                    status: 'completed', 
                    progress: 100 
                  });
            } else {
                  uploadManager.updatePlaceholder(placeholderId, { 
                    status: result.error === 'Upload cancelled' ? 'cancelled' : 'failed', 
                    progress: 0, 
                    error: result.error 
                  });
                }
              }
            });
          }
          
          // Batch update placeholders - update every 10 files for smooth progress tracking
          const updateInterval = 10; // Update every 10 files for responsive progress
          const shouldUpdate = completed % updateInterval === 0 || completed === total || completed <= 10; // Always update first 10 files
          console.log(`Progress update: completed=${completed}, total=${total}, updateInterval=${updateInterval}, shouldUpdate=${shouldUpdate}`);
          if (shouldUpdate) {
            // Update placeholders based on completion status
            console.log(`Updating placeholders: completed=${completed}, total=${total}, placeholderIds.length=${placeholderIds.length}`);
            placeholderIds.forEach((id, index) => {
              if (index < completed) {
                console.log(`Marking placeholder ${index} as completed`);
                uploadManager.updatePlaceholder(id, { status: 'completed', progress: 100 });
              } else if (index < completed + 10) { // Mark next 10 files as uploading
                console.log(`Marking placeholder ${index} as uploading`);
                uploadManager.updatePlaceholder(id, { status: 'uploading', progress });
            } else {
                uploadManager.updatePlaceholder(id, { progress });
              }
            });
          }
          
          // Update results with latest batch (Web Worker now sends all accumulated results)
          if (data && data.results) {
            allResults.length = 0; // Clear existing results
            allResults.push(...data.results); // Use latest accumulated results
          }
          
          if (onUploadProgress) {
            onUploadProgress(progress, `${completed}/${total} files`);
          }
        } else if (type === 'complete') {
          controller.signal.removeEventListener('abort', abortHandler);
      worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
          uploadManager.unregisterWorker(worker);
          
          // Use final results from complete message
          if (data && data.results) {
            allResults.length = 0; // Clear existing results
            allResults.push(...data.results); // Use final results
          }
          
          // Set the results for display
          setUploadResults(allResults);
          
          // Mark placeholders based on actual results - only successful uploads as completed
          allResults.forEach((result, index) => {
            if (placeholderIds[index]) {
              if (result.success) {
                uploadManager.updatePlaceholder(placeholderIds[index], { 
                  status: 'completed', 
                  progress: 100 
                });
              } else {
                uploadManager.updatePlaceholder(placeholderIds[index], { 
                  status: result.error === 'Upload cancelled' ? 'cancelled' : 'failed', 
                  progress: 0,
                  error: result.error 
                });
              }
            }
          });
          resolve();
        } else if (type === 'cancelled') {
          // Worker was cancelled - mark all remaining items as cancelled
          const allPlaceholderIds = Object.values(batchPlaceholderIds).flat();
          allPlaceholderIds.forEach(placeholderId => {
            uploadManager.updatePlaceholder(placeholderId, { 
              status: 'cancelled', 
              progress: 0, 
              error: 'Upload cancelled' 
            });
          });
          
          controller.signal.removeEventListener('abort', abortHandler);
      worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
          uploadManager.unregisterWorker(worker);
          const abortErr = new Error('Upload cancelled');
          abortErr.name = 'AbortError';
          reject(abortErr);
        }
      };
      
      worker.onerror = (error) => {
        console.error('Web Worker error:', error);
        controller.signal.removeEventListener('abort', abortHandler);
      worker.terminate();
      setActiveWorkers(prev => prev.filter(w => w !== worker));
      uploadManager.unregisterWorker(worker);
        uploadManager.unregisterWorker(worker);
        reject(error);
      };
    });
  };


  // Reset
  const handleReset = () => {
    setFiles([]);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadResults([]);
    setShowResults(false);
    setSessionId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (directoryInputRef.current) {
      directoryInputRef.current.value = '';
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            File & Directory Upload
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload individual files or entire directories while preserving folder structure
          </Typography>

          {/* Upload Area */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: isUploading ? 'warning.main' : files.length > 0 ? 'success.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: isUploading ? 'warning.light' : files.length > 0 ? 'success.light' : 'grey.50',
              opacity: isUploading ? 0.7 : 1,
              pointerEvents: isUploading ? 'none' : 'auto',
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={isUploading}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <input
              ref={directoryInputRef}
              type="file"
              multiple
              webkitdirectory=""
              directory=""
              disabled={isUploading}
              onChange={handleDirectorySelect}
              style={{ display: 'none' }}
            />
            
            <FolderOpen sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {files.length > 0 ? 'Files Selected' : 'Select Files or Directory'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              Choose how you want to upload files
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<InsertDriveFile />}
                onClick={() => {
                  // Prevent file selection during upload
                  if (uploadInProgressRef.current || isUploading) {
                    console.warn('Cannot select files while upload is in progress');
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                disabled={isUploading}
                sx={{ minWidth: 150 }}
              >
                Select Files
              </Button>
              <Button
                variant="outlined"
                startIcon={<FolderOpen />}
                onClick={() => {
                  // Prevent directory selection during upload
                  if (uploadInProgressRef.current || isUploading) {
                    console.warn('Cannot select directories while upload is in progress');
                    return;
                  }
                  directoryInputRef.current?.click();
                }}
                disabled={isUploading}
                sx={{ minWidth: 150 }}
              >
                Select Directory
              </Button>
            </Box>
            
            <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
              Or drag & drop individual files here
            </Typography>
          </Box>

          {/* File List */}
          {files.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Selected Files ({files.reduce((sum, dir) => sum + dir.files.length, 0)} files)
                {files.some(dir => dir.isDirectory) && ' - Directory Structure Preserved'}
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {files.map((dir, dirIndex) => (
                  <React.Fragment key={dirIndex}>
                    <ListItem>
                      <ListItemIcon>
                        {dir.isDirectory ? (
                          <FolderOpen color="primary" />
                        ) : (
                          <InsertDriveFile color="secondary" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={dir.directory}
                        secondary={`${dir.files.length} files${dir.isDirectory ? ' (directory)' : ' (individual files)'}`}
                      />
                    </ListItem>
                    {dir.files.map((file, fileIndex) => (
                      <ListItem key={fileIndex} sx={{ pl: 4 }}>
                        <ListItemIcon>
                          <InsertDriveFile color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={formatFileSize(file.size)}
                        />
                      </ListItem>
                    ))}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Box sx={{ mt: 2 }}>
              {validationErrors.map((error, index) => {
                // Use StorageLimitError component for storage limit errors
                if (error.type === 'STORAGE_LIMIT_EXCEEDED') {
                  return (
                    <StorageLimitError
                      key={index}
                      error={error}
                      onDismiss={() => {
                        setValidationErrors(prev => prev.filter((_, i) => i !== index));
                      }}
                      onUpgrade={() => {
                        // Navigate to plans page
                        window.location.href = '/plans';
                      }}
                    />
                  );
                }
                
                // Use regular Alert for other errors
                return (
                  <Alert key={index} severity="error" sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {error.message}
                    </Typography>
                    {error.details && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                        {error.details}
                      </Typography>
                    )}
                  </Alert>
                );
              })}
            </Box>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <Box sx={{ mt: 2 }}>
              {validationWarnings.map((warning, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {warning.message}
                  </Typography>
                  {warning.details && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      {warning.details}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Box>
          )}

          {/* Storage Check Info */}
          {storageCheck && storageCheck.canUpload && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Storage Check: {formatBytes(storageCheck.remainingSpace)} remaining space
              </Typography>
            </Alert>
          )}

          {/* Upload Strategy Info */}
          {uploadStrategy && uploadStrategy !== 'standard' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Upload Strategy: {uploadStrategy.toUpperCase()} - Optimized for your file selection
              </Typography>
            </Alert>
          )}

          {/* Encryption Status */}
          <Alert 
            severity={encryptionEnabled ? "success" : "info"} 
            sx={{ mt: 2 }}
            icon={encryptionEnabled ? <Lock /> : <LockOpen />}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {encryptionEnabled ? '🔒 E2E Encryption Enabled' : '🔓 E2E Encryption Disabled'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {encryptionEnabled 
                ? 'Files will be encrypted with AES-GCM 256-bit before upload. Only you can decrypt them.'
                : 'Files will be uploaded without encryption. Enable E2E encryption from the dashboard for maximum security.'
              }
            </Typography>
          </Alert>

          {/* Upload Status */}
          {uploadStatus && !isUploading && (
            <Alert 
              severity={uploadStatus.includes('failed') ? 'error' : uploadStatus.includes('completed') ? 'success' : 'info'}
              sx={{ mt: 2 }}
            >
              {uploadStatus}
            </Alert>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                {uploadStatus}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                {uploadProgress.toFixed(1)}% complete
              </Typography>
            </Box>
          )}

          {/* Action Buttons */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              disabled={validationErrors.length > 0 || files.length === 0 || isUploading}
              onClick={() => {
                // Double-check atomic protection at button level
                if (uploadInProgressRef.current || isUploading) {
                  console.warn('Upload button clicked but upload already in progress');
                  return;
                }
                
                // Check validation errors
                if (validationErrors.length > 0) {
                  console.warn('Upload button clicked but validation errors exist');
                  return;
                }
                handleUpload();
              }}
              startIcon={<CloudUpload />}
              >
                {isUploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            {isUploading && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleCancel}
                disabled={isCancelling}
                startIcon={<Stop />}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Upload'}
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={() => {
                // Prevent reset during upload
                if (uploadInProgressRef.current || isUploading) {
                  console.warn('Cannot reset while upload is in progress');
                  return;
                }
                handleReset();
              }}
              disabled={isUploading}
              startIcon={<Refresh />}
            >
              Reset
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog
        open={showResults}
        onClose={() => setShowResults(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Upload Results
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${uploadResults.filter(r => r.success).length} Successful`}
                color="success"
              />
              <Chip
                icon={<ErrorIcon />}
                label={`${uploadResults.filter(r => !r.success).length} Failed`}
                color="error"
              />
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            File Details
          </Typography>
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {uploadResults.map((result, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {result.success ? (
                    <CheckCircle color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={result.file}
                  secondary={result.success ? result.path : result.error}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResults(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DirectoryUploader;
