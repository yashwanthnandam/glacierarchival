/**
 * File State Configuration Utility
 * Centralized file state management to eliminate duplication across components
 */

export const FILE_STATES = {
  UPLOADED: 'uploaded',
  ARCHIVING: 'archiving', 
  ARCHIVED: 'archived',
  RESTORING: 'restoring',
  RESTORED: 'restored',
  FAILED: 'failed'
};

export const FILE_STATE_CONFIG = {
  [FILE_STATES.UPLOADED]: {
    name: 'Awake',
    emoji: '☀️',
    color: '#4CAF50',
    description: 'File is active and accessible',
    actionText: 'Archive',
    actionIcon: 'AcUnit',
    canArchive: true,
    canRestore: false,
    canDownload: true,
    canDelete: true
  },
  [FILE_STATES.ARCHIVING]: {
    name: 'Falling Asleep',
    emoji: '🌙',
    color: '#FF9800',
    description: 'File is being archived to cold storage',
    actionText: 'Cancel',
    actionIcon: 'Stop',
    canArchive: false,
    canRestore: false,
    canDownload: false,
    canDelete: false,
    isProcessing: true
  },
  [FILE_STATES.ARCHIVED]: {
    name: 'Hibernating',
    emoji: '❄️',
    color: '#2196F3',
    description: 'File is in cold storage (cheaper)',
    actionText: 'Restore',
    actionIcon: 'CloudUpload',
    canArchive: false,
    canRestore: true,
    canDownload: false,
    canDelete: true
  },
  [FILE_STATES.RESTORING]: {
    name: 'Waking Up',
    emoji: '🌅',
    color: '#9C27B0',
    description: 'File is being restored from cold storage',
    actionText: 'Cancel',
    actionIcon: 'Stop',
    canArchive: false,
    canRestore: false,
    canDownload: false,
    canDelete: false,
    isProcessing: true
  },
  [FILE_STATES.RESTORED]: {
    name: 'Awake',
    emoji: '☀️',
    color: '#4CAF50',
    description: 'File is restored and accessible',
    actionText: 'Archive',
    actionIcon: 'AcUnit',
    canArchive: true,
    canRestore: false,
    canDownload: true,
    canDelete: true
  },
  [FILE_STATES.FAILED]: {
    name: 'Error',
    emoji: '⚠️',
    color: '#F44336',
    description: 'Operation failed',
    actionText: 'Retry',
    actionIcon: 'Refresh',
    canArchive: true,
    canRestore: true,
    canDownload: false,
    canDelete: true,
    isError: true
  }
};

/**
 * Get file state configuration
 * @param {string} status - File status
 * @returns {Object} State configuration object
 */
export const getFileStateConfig = (status) => {
  return FILE_STATE_CONFIG[status] || FILE_STATE_CONFIG[FILE_STATES.UPLOADED];
};

/**
 * Get file state info (legacy compatibility)
 * @param {Object} file - File object
 * @returns {Object} State info object
 */
export const getFileStateInfo = (file) => {
  const config = getFileStateConfig(file.status);
  return {
    name: config.name,
    emoji: config.emoji,
    color: config.color,
    description: config.description,
    actionText: config.actionText,
    actionIcon: config.actionIcon,
    canArchive: config.canArchive,
    canRestore: config.canRestore,
    canDownload: config.canDownload,
    canDelete: config.canDelete,
    isProcessing: config.isProcessing || false,
    isError: config.isError || false
  };
};

/**
 * Check if file can perform action
 * @param {Object} file - File object
 * @param {string} action - Action to check
 * @returns {boolean} Whether action is allowed
 */
export const canPerformAction = (file, action) => {
  const config = getFileStateConfig(file.status);
  
  switch (action) {
    case 'archive':
      return config.canArchive;
    case 'restore':
      return config.canRestore;
    case 'download':
      return config.canDownload;
    case 'delete':
      return config.canDelete;
    default:
      return false;
  }
};

/**
 * Get appropriate action text for file
 * @param {Object} file - File object
 * @returns {string} Action text
 */
export const getActionText = (file) => {
  return getFileStateConfig(file.status).actionText;
};

/**
 * Get appropriate action icon for file
 * @param {Object} file - File object
 * @returns {string} Action icon name
 */
export const getActionIcon = (file) => {
  return getFileStateConfig(file.status).actionIcon;
};

/**
 * Check if file is in processing state
 * @param {Object} file - File object
 * @returns {boolean} Whether file is processing
 */
export const isFileProcessing = (file) => {
  return getFileStateConfig(file.status).isProcessing || false;
};

/**
 * Check if file is in error state
 * @param {Object} file - File object
 * @returns {boolean} Whether file has error
 */
export const isFileError = (file) => {
  return getFileStateConfig(file.status).isError || false;
};

export default {
  FILE_STATES,
  FILE_STATE_CONFIG,
  getFileStateConfig,
  getFileStateInfo,
  canPerformAction,
  getActionText,
  getActionIcon,
  isFileProcessing,
  isFileError
};
