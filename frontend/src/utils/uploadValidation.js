import { FILE_UPLOAD, MESSAGES } from '../constants';

/**
 * Comprehensive upload validation utility
 * Handles all edge cases for file uploads
 */

// Allowed file types from backend settings
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
  'audio/mp3', 'audio/wav', 'audio/flac',
  'application/pdf', 'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed'
];

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
 * Validate individual file
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

  // Check file type
  if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push({
      type: 'INVALID_FILE_TYPE',
      message: MESSAGES.INVALID_FILE_TYPE,
      details: `File "${file.name}" has type "${file.type}" which is not allowed`
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

  // Check for dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.vbs', '.js', '.jar'];
  const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (dangerousExtensions.includes(fileExt)) {
    errors.push({
      type: 'DANGEROUS_FILE',
      message: 'Dangerous file type detected',
      details: `File "${file.name}" has extension "${fileExt}" which is not allowed for security reasons`
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate file collection
 */
export const validateFileCollection = (files) => {
  const errors = [];
  const warnings = [];
  let totalSize = 0;
  let validFiles = 0;

  // Check file count
  if (files.length > FILE_UPLOAD.MAX_FILES) {
    errors.push({
      type: 'TOO_MANY_FILES',
      message: MESSAGES.TOO_MANY_FILES,
      details: `Selected ${files.length} files, maximum allowed is ${FILE_UPLOAD.MAX_FILES}`
    });
  }

  // Validate each file and calculate totals
  files.forEach((file, index) => {
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      errors.push(...fileValidation.errors);
    } else {
      validFiles++;
      totalSize += file.size;
    }
  });

  // Check total size
  if (totalSize > FILE_UPLOAD.MAX_TOTAL_SIZE) {
    errors.push({
      type: 'TOTAL_SIZE_EXCEEDED',
      message: MESSAGES.TOTAL_SIZE_EXCEEDED,
      details: `Total size is ${formatBytes(totalSize)}, maximum allowed is ${formatBytes(FILE_UPLOAD.MAX_TOTAL_SIZE)}`
    });
  }

  // Check session size
  if (totalSize > FILE_UPLOAD.MAX_SESSION_SIZE) {
    errors.push({
      type: 'SESSION_SIZE_EXCEEDED',
      message: MESSAGES.SESSION_SIZE_EXCEEDED,
      details: `Session size is ${formatBytes(totalSize)}, maximum allowed is ${formatBytes(FILE_UPLOAD.MAX_SESSION_SIZE)}`
    });
  }

  // Check memory limit
  if (totalSize > FILE_UPLOAD.MEMORY_LIMIT) {
    warnings.push({
      type: 'MEMORY_LIMIT_WARNING',
      message: 'Large upload detected',
      details: `Total size is ${formatBytes(totalSize)}. This may cause performance issues. Consider uploading in smaller batches.`
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFiles: files.length,
      validFiles,
      invalidFiles: files.length - validFiles,
      totalSize,
      averageFileSize: validFiles > 0 ? totalSize / validFiles : 0
    }
  };
};

/**
 * Pre-upload storage check
 */
export const checkStorageLimit = async (fileSize, currentUsage = 0) => {
  const totalUsage = currentUsage + fileSize;
  const freeTierLimit = 15 * 1024 * 1024 * 1024; // 15GB

  if (totalUsage > freeTierLimit) {
    return {
      canUpload: false,
      error: {
        type: 'STORAGE_LIMIT_EXCEEDED',
        message: MESSAGES.STORAGE_LIMIT_EXCEEDED,
        details: `Current usage: ${formatBytes(currentUsage)}, adding ${formatBytes(fileSize)} would exceed the ${formatBytes(freeTierLimit)} free tier limit`
      }
    };
  }

  return {
    canUpload: true,
    remainingSpace: freeTierLimit - totalUsage
  };
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
export const checkConcurrentUploads = (activeUploads, maxConcurrent = 3) => {
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

export default {
  validateFile,
  validateFileCollection,
  checkStorageLimit,
  estimateUploadTime,
  getUploadStrategy,
  validateUploadSession,
  checkConcurrentUploads,
  formatBytes
};
