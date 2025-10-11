/**
 * Common formatting utilities used across components
 */

// Date formatting utilities
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return 'N/A';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  return new Date(dateString).toLocaleString(undefined, mergedOptions);
};

export const formatDateShort = (dateString) => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatTimeAgo = (dateString) => {
  if (!dateString) return 'N/A';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
};

// File size formatting utilities
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatFileSizeInGB = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 GB';
  
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(decimals)} GB`;
};

// Currency formatting utilities
export const formatCurrency = (amount, currency = 'INR', locale = 'en-IN') => {
  if (amount === null || amount === undefined) return 'N/A';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatCurrencyFromPaise = (paise, currency = 'INR') => {
  return formatCurrency(paise / 100, currency);
};

// Status formatting utilities
export const getStatusColor = (status) => {
  const statusColors = {
    // Payment statuses
    success: 'success',
    failed: 'error',
    pending: 'warning',
    cancelled: 'default',
    
    // File statuses
    active: 'success',
    archived: 'info',
    deleted: 'error',
    uploading: 'warning',
    processing: 'info',
    
    // Job statuses
    completed: 'success',
    running: 'info',
    failed: 'error',
    queued: 'warning',
    
    // Default
    default: 'default'
  };
  
  return statusColors[status] || 'default';
};

export const getStatusLabel = (status) => {
  const statusLabels = {
    // Payment statuses
    success: 'Success',
    failed: 'Failed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    
    // File statuses
    active: 'Active',
    archived: 'Archived',
    deleted: 'Deleted',
    uploading: 'Uploading',
    processing: 'Processing',
    
    // Job statuses
    completed: 'Completed',
    running: 'Running',
    failed: 'Failed',
    queued: 'Queued'
  };
  
  return statusLabels[status] || status;
};

// Progress formatting utilities
export const formatProgress = (current, total, decimals = 1) => {
  if (total === 0) return '0%';
  
  const percentage = (current / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
};

export const formatProgressWithCounts = (current, total) => {
  return `${current}/${total} (${formatProgress(current, total)})`;
};

// Text formatting utilities
export const truncateText = (text, maxLength = 50, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
};

export const capitalizeFirst = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const formatFileName = (filename, maxLength = 30) => {
  if (!filename) return 'Unknown';
  
  if (filename.length <= maxLength) return filename;
  
  const extension = filename.split('.').pop();
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
  const truncatedName = truncateText(nameWithoutExt, maxLength - extension.length - 1);
  
  return `${truncatedName}.${extension}`;
};

// Number formatting utilities
export const formatNumber = (number, locale = 'en-IN') => {
  if (number === null || number === undefined) return 'N/A';
  return new Intl.NumberFormat(locale).format(number);
};

export const formatPercentage = (value, total, decimals = 1) => {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(decimals)}%`;
};

// Validation utilities
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidFileSize = (fileSize, maxSizeInBytes) => {
  return fileSize <= maxSizeInBytes;
};

// Storage utilities
export const formatStorageUsage = (usedBytes, totalBytes) => {
  const usedGB = formatFileSizeInGB(usedBytes);
  const totalGB = formatFileSizeInGB(totalBytes);
  const percentage = formatProgress(usedBytes, totalBytes);
  
  return {
    used: usedGB,
    total: totalGB,
    percentage,
    formatted: `${usedGB} / ${totalGB} (${percentage})`
  };
};
