import { FILE_UPLOAD, MESSAGES, FEATURE_FLAGS } from '../constants';

/**
 * Comprehensive upload validation utility
 * Handles all edge cases for file uploads
 */

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Fast validation for individual file - optimized for large collections
 */
export const validateFileFast = (file) => {
  // Quick size check without expensive formatting
  if (file.size > FILE_UPLOAD.MAX_FILE_SIZE) {
    return {
      isValid: false,
      errors: [{
        type: 'FILE_SIZE_EXCEEDED',
        message: MESSAGES.FILE_SIZE_EXCEEDED,
        details: `File "${file.name}" exceeds 5GB limit`
      }]
    };
  }

  // Quick filename length check
  if (file.name.length > 255) {
    return {
      isValid: false,
      errors: [{
        type: 'FILENAME_TOO_LONG',
        message: 'Filename too long',
        details: `File "${file.name}" exceeds 255 character limit`
      }]
    };
  }

  return { isValid: true, errors: [] };
};

/**
 * Validate individual file (legacy - kept for compatibility)
 */
export const validateFile = (file) => {
  const errors = [];

  // Check file size
  if (file.size > FILE_UPLOAD.MAX_FILE_SIZE) {
    errors.push({
      type: 'FILE_SIZE_EXCEEDED',
      message: MESSAGES.FILE_SIZE_EXCEEDED,
      details: `File "${file.name}" is ${formatBytes(file.size)}, maximum allowed is ${formatBytes(FILE_UPLOAD.MAX_FILE_SIZE)}`
    });
  }

  // Check filename length
  if (file.name.length > 255) {
    errors.push({
      type: 'FILENAME_TOO_LONG',
      message: 'Filename too long',
      details: `File "${file.name}" has ${file.name.length} characters, maximum allowed is 255`
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate file collection - optimized for large file counts
 */
export const validateFileCollection = (files) => {
  const errors = [];
  const warnings = [];
  let totalSize = 0;
  let validFiles = 0;
  let invalidFiles = 0;

  // Early exit: Check file count first (fastest check)
  if (files.length > FILE_UPLOAD.MAX_FILES) {
    errors.push({
      type: 'TOO_MANY_FILES',
      message: MESSAGES.TOO_MANY_FILES,
      details: `Selected ${files.length} files, maximum allowed is ${FILE_UPLOAD.MAX_FILES}`
    });
    return {
      isValid: false,
      errors,
      warnings,
      stats: {
        totalFiles: files.length,
        validFiles: 0,
        invalidFiles: files.length,
        totalSize: 0,
        averageFileSize: 0
      }
    };
  }

  // For large collections (>1000 files), use fast validation
  const useFastValidation = files.length > 1000;
  const validationFunction = useFastValidation ? validateFileFast : validateFile;

  // Batch processing for very large collections to prevent UI blocking
  const batchSize = files.length > 10000 ? 5000 : files.length;
  let processedFiles = 0;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    // Process batch
    for (const file of batch) {
      const fileValidation = validationFunction(file);
      if (!fileValidation.isValid) {
        errors.push(...fileValidation.errors);
        invalidFiles++;
      } else {
        validFiles++;
        totalSize += file.size;
      }
    }
    
    processedFiles += batch.length;
    
    // Yield to UI thread for large collections
    if (files.length > 5000 && processedFiles % 5000 === 0) {
      // This will be handled by the calling code with setTimeout
    }
  }

  // Check total size limits (only if we have valid files)
  if (validFiles > 0) {
    if (totalSize > FILE_UPLOAD.MAX_TOTAL_SIZE) {
      errors.push({
        type: 'TOTAL_SIZE_EXCEEDED',
        message: MESSAGES.TOTAL_SIZE_EXCEEDED,
        details: `Total size is ${formatBytes(totalSize)}, maximum allowed is ${formatBytes(FILE_UPLOAD.MAX_TOTAL_SIZE)}`
      });
    }

    if (totalSize > FILE_UPLOAD.MAX_SESSION_SIZE) {
      errors.push({
        type: 'SESSION_SIZE_EXCEEDED',
        message: MESSAGES.SESSION_SIZE_EXCEEDED,
        details: `Session size is ${formatBytes(totalSize)}, maximum allowed is ${formatBytes(FILE_UPLOAD.MAX_SESSION_SIZE)}`
      });
    }

    // Memory warning for large uploads
    if (totalSize > FILE_UPLOAD.MEMORY_LIMIT) {
      warnings.push({
        type: 'MEMORY_LIMIT_WARNING',
        message: 'Large upload detected',
        details: `Uploading ${formatBytes(totalSize)}. This may take a while.`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFiles: files.length,
      validFiles,
      invalidFiles,
      totalSize,
      averageFileSize: validFiles > 0 ? totalSize / validFiles : 0
    }
  };
};

/**
 * Pre-upload storage check using API
 */
export const checkStorageLimit = async (fileSize) => {
  try {
    // Import API here to avoid circular dependencies
    const { hibernationAPI } = await import('../services/api');
    
    // Get current storage usage from API
    const response = await hibernationAPI.getStorageUsage();
    const storageData = response.data;
    
    const totalUsage = storageData.current_usage_bytes + fileSize;
    
    if (totalUsage > storageData.limit_bytes) {
      const currentUsageGB = storageData.current_usage_gb;
      const fileSizeGB = fileSize / (1024**3);
      const remainingGB = storageData.remaining_gb;
      
      return {
        canUpload: false,
        error: {
          type: 'STORAGE_LIMIT_EXCEEDED',
          message: `Storage limit exceeded! You've used ${currentUsageGB}GB of your ${storageData.limit_gb}GB ${storageData.plan_type === 'free_tier' ? 'free tier' : storageData.plan_name}. This upload would add ${fileSizeGB.toFixed(1)}GB, but you only have ${remainingGB}GB remaining.`,
          details: `Current usage: ${formatBytes(storageData.current_usage_bytes)}, adding ${formatBytes(fileSize)} would exceed the ${formatBytes(storageData.limit_bytes)} limit`,
          currentUsageGB: currentUsageGB,
          fileSizeGB: fileSizeGB.toFixed(1),
          remainingGB: remainingGB,
          planType: storageData.plan_type,
          planName: storageData.plan_name,
          limitGB: storageData.limit_gb,
          upgradeRequired: true
        }
      };
    }

    return {
      canUpload: true,
      remainingSpace: storageData.remaining_bytes - fileSize,
      storageData: storageData
    };
    
  } catch (error) {
    console.error('Error checking storage limit:', error);
    
    // Fallback to basic check if API fails
    const freeTierLimit = 15 * 1024 * 1024 * 1024; // 15GB
    const fileSizeGB = fileSize / (1024**3);
    
    if (fileSize > freeTierLimit) {
      return {
        canUpload: false,
        error: {
          type: 'STORAGE_LIMIT_EXCEEDED',
          message: `File size ${fileSizeGB.toFixed(1)}GB exceeds the 15GB free tier limit. Please upgrade to a hibernation plan.`,
          details: `File size: ${formatBytes(fileSize)}, Free tier limit: ${formatBytes(freeTierLimit)}`,
          fileSizeGB: fileSizeGB.toFixed(1),
          upgradeRequired: true
        }
      };
    }
    
    return {
      canUpload: true,
      remainingSpace: freeTierLimit - fileSize
    };
  }
};

/**
 * Estimate upload time
 */
export const estimateUploadTime = (fileSize, connectionSpeed = 10) => {
  // Assume 10 Mbps average connection speed
  const bytesPerSecond = (connectionSpeed * 1024 * 1024) / 8; // Convert Mbps to bytes/sec
  const seconds = fileSize / bytesPerSecond;
  
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} minutes`;
  } else {
    return `${Math.round(seconds / 3600)} hours`;
  }
};

/**
 * Get upload strategy based on file characteristics
 */
export const getUploadStrategy = (files) => {
  const stats = validateFileCollection(files).stats;
  
  if (stats.totalSize > FILE_UPLOAD.MEMORY_LIMIT) {
    return 'streaming'; // Use streaming upload for large files
  } else if (stats.totalFiles > 100) {
    return 'batched'; // Use batched upload for many files
  } else {
    return 'standard'; // Use standard upload
  }
};

/**
 * Validate upload session
 */
export const validateUploadSession = (sessionData) => {
  const errors = [];

  if (!sessionData.totalFiles || sessionData.totalFiles <= 0) {
    errors.push({
      type: 'INVALID_SESSION',
      message: 'Invalid upload session',
      details: 'Session must have at least one file'
    });
  }

  if (sessionData.totalFiles > FILE_UPLOAD.MAX_FILES) {
    errors.push({
      type: 'TOO_MANY_FILES',
      message: MESSAGES.TOO_MANY_FILES,
      details: `Session has ${sessionData.totalFiles} files, maximum allowed is ${FILE_UPLOAD.MAX_FILES}`
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check for concurrent upload limits
 */
export const checkConcurrentUploads = (activeUploads, maxConcurrent = 8) => {
  if (activeUploads >= maxConcurrent) {
    return {
      canStart: false,
      error: {
        type: 'CONCURRENT_UPLOAD_LIMIT',
        message: MESSAGES.CONCURRENT_UPLOAD_LIMIT,
        details: `Currently ${activeUploads} uploads in progress, maximum allowed is ${maxConcurrent}`
      }
    };
  }

  return {
    canStart: true,
    remainingSlots: maxConcurrent - activeUploads
  };
};

/**
 * Minimal validation - only checks what's actually needed
 * Backend handles most validation, frontend only prevents browser issues
 */
export const validateFileCollectionMinimal = async (files, onProgress) => {
  const errors = [];
  const warnings = [];
  const totalFiles = files.length;

  // 1. CRITICAL: Prevent browser freeze (backend allows 1000, but we limit to 100k for browser)
  if (totalFiles > FILE_UPLOAD.MAX_FILES) {
    errors.push({
      type: 'TOO_MANY_FILES',
      message: 'Too many files selected',
      details: `Selected ${totalFiles} files, maximum allowed is ${FILE_UPLOAD.MAX_FILES} to prevent browser slowdown`
    });
    return {
      isValid: false,
      errors,
      warnings,
      stats: { totalFiles, validFiles: 0, invalidFiles: totalFiles, totalSize: 0, averageFileSize: 0 }
    };
  }

  // 2. CRITICAL: Skip size summation if flag disabled or selection very large
  if (!FEATURE_FLAGS.ENABLE_CLIENT_STORAGE_PRECHECK || totalFiles > 10000) {
    return {
      isValid: true,
      errors,
      warnings,
      stats: {
        totalFiles,
        validFiles: totalFiles,
        invalidFiles: 0,
        totalSize: 0,
        averageFileSize: 0,
      }
    };
  }

  let totalSize = 0;
  const batchSize = totalFiles > 10000 ? 5000 : totalFiles;
  let processedFiles = 0;

  for (let i = 0; i < totalFiles; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    for (const file of batch) {
      totalSize += file.size;
    }
    
    processedFiles += batch.length;
    
    // Update progress for large collections
    if (onProgress && totalFiles > 1000) {
      onProgress(processedFiles, totalFiles);
    }
    
    // Yield to UI thread for large collections
    if (totalFiles > 5000) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // 3. CRITICAL: Check storage limit (prevents failed uploads)
  if (totalSize > FILE_UPLOAD.MAX_TOTAL_SIZE) {
    errors.push({
      type: 'TOTAL_SIZE_EXCEEDED',
      message: 'Upload too large',
      details: `Total size ${formatBytes(totalSize)} exceeds ${formatBytes(FILE_UPLOAD.MAX_TOTAL_SIZE)} limit`
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFiles,
      validFiles: totalFiles, // Assume all valid (backend will reject invalid ones)
      invalidFiles: 0,
      totalSize,
      averageFileSize: totalFiles > 0 ? totalSize / totalFiles : 0
    }
  };
};

export default {
  validateFile,
  validateFileFast,
  validateFileCollection,
  validateFileCollectionMinimal,
  checkStorageLimit,
  estimateUploadTime,
  getUploadStrategy,
  validateUploadSession,
  checkConcurrentUploads,
  formatBytes
};
