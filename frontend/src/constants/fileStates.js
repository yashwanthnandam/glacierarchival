// Thematic naming constants for Hibernate metaphor
export const FILE_STATES = {
  // Technical states
  UPLOADED: 'uploaded',
  ARCHIVED: 'archived',
  RESTORING: 'restoring',
  RESTORED: 'restored',
  UPLOADING: 'uploading',
  ARCHIVING: 'archiving',
  FAILED: 'failed',
  PENDING: 'pending',
  
  // User-facing labels with emojis
  AWAKE: {
    label: 'Awake',
    emoji: '☀️',
    description: 'Files you use often — ready instantly',
    tooltip: 'Your file is active and instantly accessible.',
    color: '#4caf50', // Green
    technical: 'Active (S3 Standard)'
  },
  
  HIBERNATING: {
    label: 'Hibernating',
    emoji: '❄️',
    description: 'Sleeping safely, costs less',
    tooltip: 'Your file is sleeping safely at low cost.',
    color: '#2196f3', // Blue
    technical: 'Frozen (Glacier Deep Archive)'
  },
  
  WAKING_UP_UPLOAD: {
    label: 'Waking Up',
    emoji: '🔄',
    description: 'Getting ready and uploading securely',
    tooltip: 'Your file is getting ready and uploading securely.',
    color: '#9c27b0', // Purple
    technical: 'Uploading'
  },
  
  FALLING_ASLEEP: {
    label: 'Falling Asleep',
    emoji: '🌙',
    description: 'Going into hibernation to save cost',
    tooltip: 'Your file is going into hibernation to save cost.',
    color: '#ff9800', // Orange
    technical: 'Archiving'
  },
  
  WAKING_FROM_SLEEP: {
    label: 'Waking from Sleep',
    emoji: '🌅',
    description: 'Waking up — this may take a few hours',
    tooltip: 'Your file is waking up — this may take a few hours.',
    color: '#ff5722', // Deep Orange
    technical: 'Restoring (Glacier)'
  },
  
  FAILED: {
    label: 'Failed',
    emoji: '❌',
    description: 'An operation on this file has failed',
    tooltip: 'An operation on this file has failed.',
    color: '#f44336', // Red
    technical: 'Failed'
  },
  
  PENDING: {
    label: 'Pending',
    emoji: '⏳',
    description: 'This file is awaiting an operation',
    tooltip: 'This file is awaiting an operation.',
    color: '#607d8b', // Blue Grey
    technical: 'Pending'
  }
};

// State mapping from technical to user-facing
export const STATE_MAPPING = {
  [FILE_STATES.UPLOADED]: FILE_STATES.AWAKE,
  [FILE_STATES.ARCHIVED]: FILE_STATES.HIBERNATING,
  [FILE_STATES.RESTORING]: FILE_STATES.WAKING_FROM_SLEEP,
  [FILE_STATES.RESTORED]: FILE_STATES.AWAKE,
  [FILE_STATES.UPLOADING]: FILE_STATES.WAKING_UP_UPLOAD,
  [FILE_STATES.ARCHIVING]: FILE_STATES.FALLING_ASLEEP,
  [FILE_STATES.FAILED]: FILE_STATES.FAILED,
  [FILE_STATES.PENDING]: FILE_STATES.PENDING
};

// Action labels
export const FILE_ACTIONS = {
  HIBERNATE: {
    label: 'Hibernate File',
    emoji: '❄️',
    description: 'Put file to sleep to save cost',
    tooltip: 'Move file to hibernation — saves up to 95% on storage cost'
  },
  
  WAKE_UP: {
    label: 'Wake Up',
    emoji: '☀️',
    description: 'Restore file from hibernation',
    tooltip: 'Wake up your file — may take 3-12 hours depending on tier'
  },
  
  SUGGEST_HIBERNATE: {
    label: 'Suggest Hibernation',
    emoji: '💤',
    description: 'Looks like this file is resting! Hibernate to save space?',
    tooltip: 'This file hasn\'t been used recently — hibernating will save money'
  }
};

// Restore tier options with thematic naming
export const RESTORE_TIERS = {
  EXPEDITED: {
    label: 'Quick Wake-Up',
    emoji: '⚡',
    time: '1-5 minutes',
    description: 'Fastest restore option',
    cost: 'High',
    technical: 'Expedited'
  },
  
  STANDARD: {
    label: 'Standard Wake-Up',
    emoji: '🌅',
    time: '3-5 hours',
    description: 'Default restore option',
    cost: 'Standard',
    technical: 'Standard'
  },
  
  BULK: {
    label: 'Slow Wake-Up',
    emoji: '🌄',
    time: '5-12 hours',
    description: 'Cheapest restore option',
    cost: 'Lowest',
    technical: 'Bulk'
  }
};

// Helper functions
export const getFileStateInfo = (technicalState) => {
  return STATE_MAPPING[technicalState] || FILE_STATES.AWAKE;
};

export const getFileStateEmoji = (technicalState) => {
  return getFileStateInfo(technicalState).emoji;
};

export const getFileStateLabel = (technicalState) => {
  return getFileStateInfo(technicalState).label;
};

export const getFileStateColor = (technicalState) => {
  return getFileStateInfo(technicalState).color;
};

export const getFileStateTooltip = (technicalState) => {
  return getFileStateInfo(technicalState).tooltip;
};

// Check if file should be suggested for hibernation
export const shouldSuggestHibernation = (file) => {
  if (file.status !== FILE_STATES.UPLOADED) return false;
  
  // Check if file hasn't been accessed recently
  const lastAccessed = new Date(file.last_accessed);
  const daysSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
  
  // Suggest hibernation if not accessed for 30+ days and file is >10MB
  return daysSinceAccess > 30 && file.file_size > 10485760;
};

// Get hibernation suggestion message
export const getHibernationSuggestion = (file) => {
  const daysSinceAccess = Math.floor((Date.now() - new Date(file.last_accessed).getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceAccess > 90) {
    return `This file has been sleeping for ${daysSinceAccess} days! 💤 Hibernate it to save money.`;
  } else if (daysSinceAccess > 30) {
    return `This file hasn't been used for ${daysSinceAccess} days. 🌙 Consider hibernating it.`;
  } else {
    return `This file is active and ready to use! ☀️`;
  }
};

// State transition helpers
export const isTransitionalState = (status) => {
  return [FILE_STATES.UPLOADING, FILE_STATES.ARCHIVING, FILE_STATES.RESTORING].includes(status);
};

export const isStableState = (status) => {
  return [FILE_STATES.UPLOADED, FILE_STATES.ARCHIVED].includes(status);
};

export const canHibernate = (status) => {
  return status === FILE_STATES.UPLOADED;
};

export const canWakeUp = (status) => {
  return status === FILE_STATES.ARCHIVED;
};

export const canDownload = (status) => {
  return [FILE_STATES.UPLOADED, FILE_STATES.RESTORED].includes(status);
};

// Progress messages for transitional states
export const getProgressMessage = (status, progress = 0) => {
  const stateInfo = getFileStateInfo(status);
  
  switch (status) {
    case FILE_STATES.UPLOADING:
      return `🔄 Your file is waking up... ${Math.round(progress)}% complete`;
    case FILE_STATES.ARCHIVING:
      return `🌙 Your file is falling asleep... ${Math.round(progress)}% complete`;
    case FILE_STATES.RESTORING:
      return `🌅 Your file is waking from sleep... ${Math.round(progress)}% complete`;
    default:
      return stateInfo.tooltip;
  }
};

// Large file upload suggestion
export const shouldSuggestDirectHibernation = (fileSize) => {
  // Suggest hibernation for files larger than 1GB
  return fileSize > 1073741824; // 1GB in bytes
};

export const getLargeFileSuggestion = (fileSize) => {
  const sizeInGB = (fileSize / 1073741824).toFixed(1);
  return `This is a large file (${sizeInGB} GB) — would you like to put it directly to Hibernate Mode (❄️) to save cost?`;
};
