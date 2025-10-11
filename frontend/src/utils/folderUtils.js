/**
 * Folder Utilities
 * Centralized folder management utilities to eliminate duplication
 */

/**
 * Get subfolders from folder structure
 * @param {Object} folderStructure - The folder structure object
 * @param {string} path - Current path
 * @returns {Array} Array of subfolder objects
 */
export const getSubfolders = (folderStructure, path) => {
  if (!folderStructure || !folderStructure.root) {
    return [];
  }

  if (path === 'root') {
    return Object.keys(folderStructure.root.subfolders || {}).map(name => ({
      name,
      path: name,
      type: 'folder',
      size: folderStructure.root.subfolders[name]?.size || 0,
      fileCount: folderStructure.root.subfolders[name]?.fileCount || 0
    }));
  }

  const pathParts = path.split('/');
  let current = folderStructure.root;

  // Navigate to the correct folder
  for (const part of pathParts) {
    if (current?.subfolders?.[part]) {
      current = current.subfolders[part];
    } else {
      return [];
    }
  }

  // Return subfolders
  return Object.keys(current?.subfolders || {}).map(name => ({
    name,
    path: `${path}/${name}`,
    type: 'folder',
    size: current.subfolders[name]?.size || 0,
    fileCount: current.subfolders[name]?.fileCount || 0
  }));
};

/**
 * Get folder info from folder structure
 * @param {Object} folderStructure - The folder structure object
 * @param {string} path - Folder path
 * @returns {Object} Folder info object
 */
export const getFolderInfo = (folderStructure, path) => {
  if (!folderStructure || !folderStructure.root) {
    return { size: 0, fileCount: 0, subfolderCount: 0 };
  }

  if (path === 'root') {
    return {
      size: folderStructure.root.size || 0,
      fileCount: folderStructure.root.fileCount || 0,
      subfolderCount: Object.keys(folderStructure.root.subfolders || {}).length
    };
  }

  const pathParts = path.split('/');
  let current = folderStructure.root;

  for (const part of pathParts) {
    if (current?.subfolders?.[part]) {
      current = current.subfolders[part];
    } else {
      return { size: 0, fileCount: 0, subfolderCount: 0 };
    }
  }

  return {
    size: current.size || 0,
    fileCount: current.fileCount || 0,
    subfolderCount: Object.keys(current.subfolders || {}).length
  };
};

/**
 * Check if folder exists in structure
 * @param {Object} folderStructure - The folder structure object
 * @param {string} path - Folder path
 * @returns {boolean} Whether folder exists
 */
export const folderExists = (folderStructure, path) => {
  if (!folderStructure || !folderStructure.root) {
    return false;
  }

  if (path === 'root') {
    return true;
  }

  const pathParts = path.split('/');
  let current = folderStructure.root;

  for (const part of pathParts) {
    if (current?.subfolders?.[part]) {
      current = current.subfolders[part];
    } else {
      return false;
    }
  }

  return true;
};

/**
 * Get folder path parts
 * @param {string} path - Folder path
 * @returns {Array} Array of path parts
 */
export const getPathParts = (path) => {
  if (!path || path === 'root') {
    return [];
  }
  return path.split('/').filter(part => part !== 'root');
};

/**
 * Get parent folder path
 * @param {string} path - Current folder path
 * @returns {string|null} Parent folder path or null if root
 */
export const getParentPath = (path) => {
  if (!path || path === 'root') {
    return null;
  }

  const pathParts = path.split('/');
  if (pathParts.length === 1) {
    return 'root';
  }

  return pathParts.slice(0, -1).join('/');
};

/**
 * Get folder name from path
 * @param {string} path - Folder path
 * @returns {string} Folder name
 */
export const getFolderName = (path) => {
  if (!path || path === 'root') {
    return 'Home';
  }

  const pathParts = path.split('/');
  return pathParts[pathParts.length - 1];
};

/**
 * Build folder path from parts
 * @param {Array} parts - Path parts
 * @returns {string} Built path
 */
export const buildPath = (parts) => {
  if (!parts || parts.length === 0) {
    return 'root';
  }

  const filteredParts = parts.filter(part => part && part !== 'root');
  return filteredParts.length === 0 ? 'root' : filteredParts.join('/');
};

/**
 * Check if path is root
 * @param {string} path - Path to check
 * @returns {boolean} Whether path is root
 */
export const isRootPath = (path) => {
  return !path || path === 'root';
};

/**
 * Get folder depth
 * @param {string} path - Folder path
 * @returns {number} Folder depth
 */
export const getFolderDepth = (path) => {
  if (isRootPath(path)) {
    return 0;
  }
  return path.split('/').length;
};

/**
 * Format path for display
 * @param {string} path - Path to format
 * @returns {string} Formatted path
 */
export const formatPathForDisplay = (path) => {
  if (isRootPath(path)) {
    return 'Home';
  }
  return path.split('/').join(' / ');
};

/**
 * Sort folders by name
 * @param {Array} folders - Array of folder objects
 * @returns {Array} Sorted folders
 */
export const sortFoldersByName = (folders) => {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Sort folders by size
 * @param {Array} folders - Array of folder objects
 * @returns {Array} Sorted folders
 */
export const sortFoldersBySize = (folders) => {
  return [...folders].sort((a, b) => (b.size || 0) - (a.size || 0));
};

/**
 * Sort folders by file count
 * @param {Array} folders - Array of folder objects
 * @returns {Array} Sorted folders
 */
export const sortFoldersByFileCount = (folders) => {
  return [...folders].sort((a, b) => (b.fileCount || 0) - (a.fileCount || 0));
};

export default {
  getSubfolders,
  getFolderInfo,
  folderExists,
  getPathParts,
  getParentPath,
  getFolderName,
  buildPath,
  isRootPath,
  getFolderDepth,
  formatPathForDisplay,
  sortFoldersByName,
  sortFoldersBySize,
  sortFoldersByFileCount
};
