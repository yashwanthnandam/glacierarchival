/**
 * Breadcrumbs Hook
 * Centralized breadcrumb management to eliminate duplication
 */

import { useState, useCallback, useEffect } from 'react';

export const useBreadcrumbs = (initialPath = 'root') => {
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: 'root' }]);

  /**
   * Update breadcrumbs based on current path
   */
  const updateBreadcrumbs = useCallback((folderPath) => {
    if (!folderPath || folderPath === 'root') {
      setBreadcrumbs([{ name: 'Home', path: 'root' }]);
      return;
    }

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
   * Navigate to breadcrumb path
   */
  const navigateToBreadcrumb = useCallback((path) => {
    updateBreadcrumbs(path);
    return path; // Return path for use in navigation
  }, [updateBreadcrumbs]);

  /**
   * Get breadcrumb for specific path
   */
  const getBreadcrumbForPath = useCallback((path) => {
    return breadcrumbs.find(breadcrumb => breadcrumb.path === path);
  }, [breadcrumbs]);

  /**
   * Check if path is root
   */
  const isRoot = useCallback((path) => {
    return !path || path === 'root';
  }, []);

  /**
   * Get parent path
   */
  const getParentPath = useCallback((path) => {
    if (isRoot(path)) return null;
    
    const pathParts = path.split('/');
    if (pathParts.length === 1) {
      return 'root';
    }
    
    return pathParts.slice(0, -1).join('/');
  }, [isRoot]);

  /**
   * Get path depth
   */
  const getPathDepth = useCallback((path) => {
    if (isRoot(path)) return 0;
    return path.split('/').length;
  }, [isRoot]);

  /**
   * Format path for display
   */
  const formatPathForDisplay = useCallback((path) => {
    if (isRoot(path)) return 'Home';
    return path.split('/').join(' / ');
  }, [isRoot]);

  return {
    // State
    breadcrumbs,
    
    // Actions
    updateBreadcrumbs,
    navigateToBreadcrumb,
    
    // Utilities
    getBreadcrumbForPath,
    isRoot,
    getParentPath,
    getPathDepth,
    formatPathForDisplay,
    
    // Setters
    setBreadcrumbs
  };
};

export default useBreadcrumbs;
