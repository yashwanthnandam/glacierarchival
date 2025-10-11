import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Breadcrumbs,
  Link,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Chip,
  LinearProgress,
  Folder,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  Delete,
  Home,
  Refresh,
  NavigateNext,
  CloudUpload,
  AccessTime
} from '../utils/muiImports';
import { useFileActions } from '../hooks/useFileActions';
import FileIcon from './FileIcon';

const SimpleFileManager = ({ onFileSelect, onFolderSelect }) => {
  const [currentPath, setCurrentPath] = useState('root');
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: 'root' }]);

  // Use shared file actions hook
  const { handleFileAction } = useFileActions(() => {
    // Refresh data after any action
    loadCurrentFolder();
  });

  // Thematic State System for "Data Hibernate"
  const getFileStateInfo = (file) => {
    const states = {
      'uploaded': {
        name: 'Awake',
        emoji: '☀️',
        color: 'success',
        icon: <CloudUpload />,
        tooltip: 'Your file is active and instantly accessible.',
        description: 'Ready for instant access'
      },
      'uploading': {
        name: 'Waking Up',
        emoji: '🔄',
        color: 'info',
        icon: <CloudUpload />,
        tooltip: 'Your file is getting ready and uploading securely.',
        description: 'Uploading securely...'
      },
      'archiving': {
        name: 'Falling Asleep',
        emoji: '🌙',
        color: 'warning',
        icon: <Archive />,
        tooltip: 'Your file is going into hibernation to save cost.',
        description: 'Moving to hibernation...'
      },
      'restoring': {
        name: 'Waking from Sleep',
        emoji: '🌅',
        color: 'info',
        icon: <RestoreFromTrash />,
        tooltip: 'Your file is waking up — this may take a few hours.',
        description: 'Restoring from hibernation...'
      },
      'archived': {
        name: 'Hibernating',
        emoji: '❄️',
        color: 'default',
        icon: <Archive />,
        tooltip: 'Your file is sleeping safely at low cost.',
        description: 'Safely hibernating'
      },
      'failed': {
        name: 'Failed',
        emoji: '⚠️',
        color: 'error',
        icon: <Delete />,
        tooltip: 'Something went wrong with this file.',
        description: 'Action failed'
      }
    };
    
    return states[file.status] || states['uploaded'];
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Load files and folders for current path
  const loadCurrentFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      
      // Load files
      const filesResponse = await fetch(
        `http://localhost:8001/api/media-files/list_optimized/?folder=${currentPath}&page=1&page_size=100`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (!filesResponse.ok) {
        throw new Error(`Failed to load files: ${filesResponse.status}`);
      }
      
      const filesData = await filesResponse.json();
      setFiles(filesData.files);
      
      // Load folder structure to get subfolders
      const foldersResponse = await fetch(
        'http://localhost:8001/api/media-files/folder_structure/',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        
        // Extract subfolders for current path
        const currentFolders = getSubfolders(foldersData, currentPath);
        setFolders(currentFolders);
      }
      
    } catch (error) {
      console.error('Error loading folder:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Get subfolders for current path
  const getSubfolders = (folderStructure, path) => {
    if (path === 'root') {
      return Object.keys(folderStructure.root?.subfolders || {}).map(name => ({
        name,
        path: name,
        fileCount: folderStructure.root.subfolders[name]?.fileCount || 0,
        size: folderStructure.root.subfolders[name]?.size || 0
      }));
    }
    
    // For nested paths, traverse the structure
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
      fileCount: current.subfolders[name]?.fileCount || 0,
      size: current.subfolders[name]?.size || 0
    }));
  };

  // Handle folder navigation
  const handleFolderClick = (folderPath, folderName) => {
    setCurrentPath(folderPath);
    
    // Update breadcrumbs
    const pathParts = folderPath.split('/').filter(p => p !== 'root');
    const newBreadcrumbs = [{ name: 'Home', path: 'root' }];
    
    let currentPath = 'root';
    pathParts.forEach(part => {
      currentPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
      newBreadcrumbs.push({ name: part, path: currentPath });
    });
    
    setBreadcrumbs(newBreadcrumbs);
    
    if (onFolderSelect) {
      onFolderSelect(folderPath, folderName);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (path) => {
    const breadcrumb = breadcrumbs.find(b => b.path === path);
    if (breadcrumb) {
      handleFolderClick(path, breadcrumb.name);
    }
  };

  // Handle file action
  const handleFileActionClick = async (file, action) => {
    try {
      const result = await handleFileAction(file, action);
      if (result?.success) {
        setSnackbar({ open: true, message: result.message });
      }
    } catch (error) {
      console.error('File action failed:', error);
      setSnackbar({ open: true, message: `Failed to ${action} file` });
    }
  };

  // Load initial data
  useEffect(() => {
    loadCurrentFolder();
  }, [loadCurrentFolder]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">File Manager</Typography>
          <Button
            startIcon={<Refresh />}
            onClick={loadCurrentFolder}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
        </Box>
        
        {/* Breadcrumbs */}
        <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
          {breadcrumbs.map((crumb, index) => (
            <Link
              key={crumb.path}
              component="button"
              onClick={() => handleBreadcrumbClick(crumb.path)}
              sx={{ 
                textDecoration: 'none',
                color: index === breadcrumbs.length - 1 ? 'text.primary' : 'primary.main',
                fontWeight: index === breadcrumbs.length - 1 ? 'bold' : 'normal'
              }}
            >
              {crumb.name === 'Home' ? <Home fontSize="small" sx={{ mr: 0.5 }} /> : crumb.name}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            {/* Hibernation Summary */}
            {files.length > 0 && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  💤 Data Hibernation Status
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {(() => {
                    const stats = files.reduce((acc, file) => {
                      acc[file.status] = (acc[file.status] || 0) + 1;
                      return acc;
                    }, {});
                    
                    return Object.entries(stats).map(([status, count]) => {
                      const stateInfo = getFileStateInfo({ status });
                      return (
                        <Chip
                          key={status}
                          label={`${stateInfo.emoji} ${stateInfo.name}: ${count}`}
                          color={stateInfo.color}
                          variant="outlined"
                          size="small"
                        />
                      );
                    });
                  })()}
                </Box>
              </Paper>
            )}
            
            <Paper sx={{ maxHeight: '100%', overflow: 'auto' }}>
              <List>
              {/* Folders */}
              {folders.map((folder) => (
                <ListItem
                  key={folder.path}
                  button
                  onClick={() => handleFolderClick(folder.path, folder.name)}
                  sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <ListItemIcon>
                    <Folder color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={folder.name}
                    secondary={`${folder.fileCount} files • ${formatFileSize(folder.size)}`}
                  />
                </ListItem>
              ))}
              
              {/* Files */}
              {files.map((file) => {
                const stateInfo = getFileStateInfo(file);
                const isTransitional = ['uploading', 'archiving', 'restoring'].includes(file.status);
                
                return (
                  <ListItem
                    key={file.id}
                    sx={{ 
                      '&:hover': { bgcolor: 'action.hover' },
                      opacity: isTransitional ? 0.7 : 1
                    }}
                  >
                    <ListItemIcon>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileIcon file={file} size="small" />
                        <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
                          {stateInfo.emoji}
                        </Typography>
                      </Box>
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {file.original_filename}
                          </Typography>
                          {isTransitional && (
                            <LinearProgress 
                              sx={{ width: 60, height: 4 }} 
                              variant="indeterminate"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(file.file_size)}
                          </Typography>
                          <Chip 
                            label={stateInfo.name}
                            size="small" 
                            color={stateInfo.color}
                            icon={stateInfo.icon}
                            variant={isTransitional ? 'outlined' : 'filled'}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {stateInfo.description}
                          </Typography>
                        </Box>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {/* Download - Always available */}
                        <Tooltip title="Download">
                          <IconButton
                            size="small"
                            onClick={() => handleFileActionClick(file, 'download')}
                            disabled={isTransitional}
                          >
                            <CloudDownload fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        {/* Hibernate (for awake files) */}
                        {file.status === 'uploaded' && (
                          <Tooltip title="Put to Hibernate (Save Cost)">
                            <IconButton
                              size="small"
                              onClick={() => handleFileActionClick(file, 'archive')}
                              sx={{ color: 'primary.main' }}
                            >
                              <Archive fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {/* Wake Up (for hibernating files) */}
                        {file.status === 'archived' && (
                          <Tooltip title="Wake Up from Hibernation">
                            <IconButton
                              size="small"
                              onClick={() => handleFileActionClick(file, 'restore')}
                              sx={{ color: 'warning.main' }}
                            >
                              <RestoreFromTrash fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {/* Delete - Always available */}
                        <Tooltip title="Delete Forever">
                          <IconButton
                            size="small"
                            onClick={() => handleFileActionClick(file, 'delete')}
                            sx={{ color: 'error.main' }}
                            disabled={isTransitional}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
              
              {/* Empty state */}
              {folders.length === 0 && files.length === 0 && !loading && (
                <ListItem>
                  <ListItemText
                    primary="No files or folders"
                    secondary="This directory is empty"
                    sx={{ textAlign: 'center' }}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
          </>
        )}
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default SimpleFileManager;
