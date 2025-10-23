// Simplified application constants
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://datahibernate.in/api/',
  timeout: 30000,
  withCredentials: true, // Send cookies with cross-origin requests
};

// Detect device capabilities for adaptive upload configuration
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4; // Less than 4GB RAM

export const UPLOAD_CONFIG = {
  timeout: 300000, // 5 minutes
  
  // Adaptive batch sizes based on device
  bulkBatchSize: isMobile || hasLowMemory ? 1000 : 1500, // Files per bulk presigned URL request
  webWorkerBatchSize: isMobile || hasLowMemory ? 1000 : 1500, // Increased for better bulk processing
  mainBatchSize: isMobile || hasLowMemory ? 1000 : 1500, // Files per main processing batch
  
  // Adaptive concurrency based on device
  // These are MAX values - actual concurrency adapts to file size in worker
  maxConcurrentUploads: isMobile ? 12 : hasLowMemory ? 16 : 24, // Maximum concurrent uploads
  minConcurrentUploads: 6, // Minimum concurrent uploads for very large files
  
  maxConcurrentWorkers: 4, // Maximum Web Workers running simultaneously
};

// Lightweight feature flags for costly client-side operations
export const FEATURE_FLAGS = {
  // When true, we compute total size on the client to do a storage precheck
  // For extremely large selections this can be expensive; disable to defer to backend
  ENABLE_CLIENT_STORAGE_PRECHECK: false,
  // When false, we avoid showing per-directory total sizes in the picker UI
  SHOW_DIRECTORY_TOTAL_SIZES: false,
};

export const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  VERIFY_EMAIL: '/verify-email',
};

export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024, // 5GB - aligned with backend MAX_FILE_SIZE
  MAX_TOTAL_SIZE: 15 * 1024 * 1024 * 1024, // 15GB - aligned with free tier limit
  MAX_FILES: 100000, // 100K files limit - prevents browser slowdown
  MAX_SESSION_SIZE: 50 * 1024 * 1024 * 1024, // 50GB - maximum session size
  CHUNK_SIZE: 8 * 1024 * 1024, // 8MB chunks for large files
  MEMORY_LIMIT: 100 * 1024 * 1024, // 100MB memory limit for processing
};

export const JOB_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const MEDIA_FILE_STATUS = {
  UPLOADED: 'uploaded',
  ARCHIVING: 'archiving',
  ARCHIVED: 'archived',
  RESTORING: 'restoring',
  RESTORED: 'restored',
  FAILED: 'failed',
};

export const STATUS_COLORS = {
  [JOB_STATUS.PENDING]: 'default',
  [JOB_STATUS.IN_PROGRESS]: 'warning',
  [JOB_STATUS.COMPLETED]: 'success',
  [JOB_STATUS.FAILED]: 'error',
  [JOB_STATUS.CANCELLED]: 'default',
  [MEDIA_FILE_STATUS.UPLOADED]: 'default',
  [MEDIA_FILE_STATUS.ARCHIVING]: 'warning',
  [MEDIA_FILE_STATUS.ARCHIVED]: 'success',
  [MEDIA_FILE_STATUS.RESTORING]: 'info',
  [MEDIA_FILE_STATUS.RESTORED]: 'success',
  [MEDIA_FILE_STATUS.FAILED]: 'error',
};

export const POLLING_INTERVALS = {
  JOB_PROGRESS: 2000, // 2 seconds
  DASHBOARD_REFRESH: 5000, // 5 seconds
};

export const MESSAGES = {
  UPLOAD_SUCCESS: 'Files uploaded successfully',
  UPLOAD_FAILED: 'Upload failed',
  ARCHIVE_SUCCESS: 'File archived successfully',
  ARCHIVE_FAILED: 'Archive failed',
  RESTORE_SUCCESS: 'File restored successfully',
  RESTORE_FAILED: 'Restore failed',
  DOWNLOAD_SUCCESS: 'Download started',
  DOWNLOAD_FAILED: 'Download failed',
  S3_CONFIG_REQUIRED: 'S3 configuration required. Please configure S3 settings first.',
  FILE_TOO_LARGE: 'File too large',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Server error. Please try again later.',
  
  // Edge case error messages
  FILE_SIZE_EXCEEDED: 'File size exceeds the maximum limit of 5GB',
  TOTAL_SIZE_EXCEEDED: 'Total upload size exceeds the limit of 15GB',
  SESSION_SIZE_EXCEEDED: 'Upload session size exceeds the limit of 50GB',
  STORAGE_LIMIT_EXCEEDED: 'Storage limit exceeded. Please subscribe to a hibernation plan to continue.',
  MEMORY_LIMIT_EXCEEDED: 'File processing exceeds memory limit. Please upload smaller files.',
  TOO_MANY_FILES: 'Too many files selected. Maximum 100,000 files per upload.',
  INVALID_FILE_TYPE: 'File type not allowed. Please check allowed file types.',
  UPLOAD_CANCELLED: 'Upload cancelled by user',
  UPLOAD_TIMEOUT: 'Upload timeout. Please try again with smaller files.',
  NETWORK_TIMEOUT: 'Network timeout. Please check your connection.',
  PARTIAL_UPLOAD_FAILED: 'Some files failed to upload. Please retry failed files.',
  CONCURRENT_UPLOAD_LIMIT: 'Too many concurrent uploads. Please wait for current uploads to complete.',
};

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
};

// Token validation utilities
export const TOKEN_UTILS = {
  isValidJWT: (token) => {
    if (!token || typeof token !== 'string') return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      const now = Date.now() / 1000;
      
      // Check if token is expired
      if (payload.exp && payload.exp < now) return false;
      
      // Check if token has required fields
      return !!(payload.user_id && payload.exp);
    } catch (error) {
      return false;
    }
  },
  
  getTokenPayload: (token) => {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1]));
    } catch (error) {
      return null;
    }
  },
  
  isTokenExpired: (token) => {
    const payload = TOKEN_UTILS.getTokenPayload(token);
    if (!payload || !payload.exp) return true;
    return payload.exp < Date.now() / 1000;
  }
};