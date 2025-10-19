/**
 * File Navigation Hook
 * Centralized file navigation logic to eliminate duplication across components
 */

import { useState, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../constants';
import secureTokenStorage from './secureTokenStorage';

export const useFileNavigation = (initialPath = 'root') => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [folderStructure, setFolderStructure] = useState({});
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: 'root' }]);

  /**
   * Load files for current folder
   */
  const loadCurrentFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = secureTokenStorage.getAccessToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const filesResponse = await fetch(
        `${API_CONFIG.baseURL}media-files/list_optimized/?folder=${currentPath}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!filesResponse.ok) {
        throw new Error(`HTTP error! status: ${filesResponse.status}`);
      }

      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      setFolders(filesData.folders || []);

      // Load folder structure if not already loaded
      if (Object.keys(folderStructure).length === 0) {
        await loadFolderStructure();
      }

    } catch (err) {
      console.error('Error loading folder:', err);
      setError(err.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentPath, folderStructure]);

  /**
   * Load folder structure
   */
  const loadFolderStructure = useCallback(async () => {
    try {
      const token = secureTokenStorage.getAccessToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const structureResponse = await fetch(
        `${API_CONFIG.baseURL}media-files/folder_structure/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!structureResponse.ok) {
        throw new Error(`HTTP error! status: ${structureResponse.status}`);
      }

      const structureData = await structureResponse.json();
      setFolderStructure(structureData);

    } catch (err) {
      console.error('Error loading folder structure:', err);
      setError(err.message);
    }
  }, []);

  /**
   * Navigate to folder
   */
  const navigateToFolder = useCallback((folderPath) => {
    setCurrentPath(folderPath);
    updateBreadcrumbs(folderPath);
  }, []);

  /**
   * Update breadcrumbs based on current path
   */
  const updateBreadcrumbs = useCallback((folderPath) => {
    const pathParts = folderPath.split('/').filter(p => p !== 'root');
    const newBreadcrumbs = [{ name: 'Home', path: 'root' }];
    let currentPath = 'root';

    pathParts.forEach(part => {
      currentPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
      newBreadcrumbs.push({
        name: part,
        path: currentPath
      });
    });

    setBreadcrumbs(newBreadcrumbs);
  }, []);

  /**
   * Get subfolders for current path
   */
  const getSubfolders = useCallback((path = currentPath) => {
    if (path === 'root') {
      return Object.keys(folderStructure.root?.subfolders || {}).map(name => ({
        name,
        path: name,
        type: 'folder'
      }));
    }

    const pathParts = path.split('/');
    let current = folderStructure.root;

    for (const part of pathParts) {
      if (current?.subfolders?.[part]) {
        current = current.subfolders[part];
      } else {
        return [];
      }
    }

    return Object.keys(current?.subfolders || {}).map(name => ({
      name,
      path: `${path}/${name}`,
      type: 'folder'
    }));
  }, [currentPath, folderStructure]);

  /**
   * Navigate up one level
   */
  const navigateUp = useCallback(() => {
    if (currentPath === 'root') return;
    
    const pathParts = currentPath.split('/');
    if (pathParts.length === 1) {
      navigateToFolder('root');
    } else {
      const parentPath = pathParts.slice(0, -1).join('/');
      navigateToFolder(parentPath);
    }
  }, [currentPath, navigateToFolder]);

  /**
   * Refresh current folder
   */
  const refreshFolder = useCallback(() => {
    loadCurrentFolder();
  }, [loadCurrentFolder]);

  /**
   * Load files when current path changes
   */
  useEffect(() => {
    loadCurrentFolder();
  }, [loadCurrentFolder]);

  /**
   * Update breadcrumbs when current path changes
   */
  useEffect(() => {
    updateBreadcrumbs(currentPath);
  }, [currentPath, updateBreadcrumbs]);

  return {
    // State
    currentPath,
    files,
    folders,
    loading,
    error,
    folderStructure,
    breadcrumbs,
    
    // Actions
    navigateToFolder,
    navigateUp,
    refreshFolder,
    loadCurrentFolder,
    loadFolderStructure,
    getSubfolders,
    
    // Utilities
    setCurrentPath,
    setFiles,
    setError
  };
};

export default useFileNavigation;
