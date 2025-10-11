import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Checkbox,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Folder,
  FolderOpen,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  Delete,
  Home,
  Refresh,
  NavigateNext,
  CloudUpload,
  AccessTime,
  MoreVert,
  ExpandMore,
  ChevronRight,
  Add,
  CreateNewFolder,
  Edit,
  Info,
  Share
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFileActions } from '../hooks/useFileActions';
import FileIcon from './FileIcon';

const WindowsFileManager = ({ onFileSelect, onFolderSelect }) => {
  const [currentPath, setCurrentPath] = useState('root');
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: 'root' }]);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'size', 'date', 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [activeId, setActiveId] = useState(null);

  // Use shared file actions hook
  const { handleFileAction } = useFileActions(() => {
    loadCurrentFolder();
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Handle folder expand/collapse
  const handleFolderToggle = (folderPath) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // Handle item selection
  const handleItemSelect = (itemId, itemType, event) => {
    if (event?.ctrlKey || event?.metaKey) {
      // Multi-select with Ctrl/Cmd
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      // Single select
      setSelectedItems(new Set([itemId]));
    }
  };

  // Handle context menu
  const handleContextMenu = (event, item, type) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      item,
      type
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
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

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      // Handle reordering logic here
    }
    
    setActiveId(null);
  };

  // Create flat list of all items (folders + files) for virtualization
  const allItems = useMemo(() => {
    const items = [];
    
    // Add folders first
    folders.forEach(folder => {
      items.push({
        id: `folder-${folder.path}`,
        type: 'folder',
        name: folder.name,
        path: folder.path,
        fileCount: folder.fileCount,
        size: folder.size,
        isExpanded: expandedFolders.has(folder.path)
      });
    });
    
    // Add files
    files.forEach(file => {
      items.push({
        id: `file-${file.id}`,
        type: 'file',
        name: file.original_filename,
        file: file,
        size: file.file_size,
        status: file.status
      });
    });
    
    // Sort items
    return items.sort((a, b) => {
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = new Date(a.file?.uploaded_at || 0) - new Date(b.file?.uploaded_at || 0);
          break;
        case 'type':
          comparison = (a.file?.file_type || '').localeCompare(b.file?.file_type || '');
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [folders, files, expandedFolders, sortBy, sortOrder]);

  // Sortable item component
  const SortableItem = ({ item, isSelected, onSelect, onDoubleClick, onContextMenu }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    if (item.type === 'folder') {
      const isExpanded = expandedFolders.has(item.path);
      
      return (
        <ListItem
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' }
          }}
          onClick={(e) => onSelect(item.id, item.type, e)}
          onDoubleClick={() => onDoubleClick(item)}
          onContextMenu={(e) => onContextMenu(e, item)}
        >
          <Checkbox
            checked={isSelected}
            onChange={() => onSelect(item.id, item.type)}
            onClick={(e) => e.stopPropagation()}
            size="small"
          />
          
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFolderToggle(item.path);
                }}
                sx={{ p: 0.5 }}
              >
                {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
              {isExpanded ? <FolderOpen color="primary" /> : <Folder color="primary" />}
            </Box>
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Typography variant="body1" component="span">
                {item.name}
              </Typography>
            }
            secondary={
              <Typography variant="body2" component="span" color="text.secondary">
                {`${item.fileCount} files • ${formatFileSize(item.size)}`}
              </Typography>
            }
          />
          
          <ListItemSecondaryAction>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e, item);
              }}
            >
              <MoreVert />
            </IconButton>
          </ListItemSecondaryAction>
        </ListItem>
      );
    } else {
      const stateInfo = getFileStateInfo(item.file);
      const isTransitional = ['uploading', 'archiving', 'restoring'].includes(item.file.status);
      
      return (
        <ListItem
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            opacity: isTransitional ? 0.7 : 1
          }}
          onClick={(e) => onSelect(item.id, item.type, e)}
          onDoubleClick={() => onDoubleClick(item)}
          onContextMenu={(e) => onContextMenu(e, item)}
        >
          <Checkbox
            checked={isSelected}
            onChange={() => onSelect(item.id, item.type)}
            onClick={(e) => e.stopPropagation()}
            size="small"
          />
          
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileIcon file={item.file} size="small" />
              <Typography variant="body2" sx={{ fontSize: '1.2em' }}>
                {stateInfo.emoji}
              </Typography>
            </Box>
          </ListItemIcon>
          
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" component="span" sx={{ fontWeight: 500 }}>
                  {item.name}
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
              <Typography variant="body2" component="span" color="text.secondary">
                {formatFileSize(item.size)} • {stateInfo.name} • {stateInfo.description}
              </Typography>
            }
          />
          
          <ListItemSecondaryAction>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {/* Download - Always available */}
              <Tooltip title="Download">
                <IconButton
                  size="small"
                  onClick={() => handleFileActionClick(item.file, 'download')}
                  disabled={isTransitional}
                >
                  <CloudDownload fontSize="small" />
                </IconButton>
              </Tooltip>
              
              {/* Hibernate (for awake files) */}
              {item.file.status === 'uploaded' && (
                <Tooltip title="Put to Hibernate (Save Cost)">
                  <IconButton
                    size="small"
                    onClick={() => handleFileActionClick(item.file, 'archive')}
                    sx={{ color: 'primary.main' }}
                  >
                    <Archive fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              
              {/* Wake Up (for hibernating files) */}
              {item.file.status === 'archived' && (
                <Tooltip title="Wake Up from Hibernation">
                  <IconButton
                    size="small"
                    onClick={() => handleFileActionClick(item.file, 'restore')}
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
                  onClick={() => handleFileActionClick(item.file, 'delete')}
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
          <Typography variant="h6">Windows File Manager</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<Refresh />}
              onClick={loadCurrentFolder}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              startIcon={<Add />}
              size="small"
            >
              New Folder
            </Button>
          </Box>
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
            
            {/* Simple List with Drag and Drop */}
            <Paper sx={{ maxHeight: '100%', overflow: 'auto' }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={(allItems || []).map(item => item.id)} strategy={verticalListSortingStrategy}>
                  <List>
                    {(allItems || []).map((item) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        onSelect={handleItemSelect}
                        onDoubleClick={(item) => {
                          if (item.type === 'folder') {
                            handleFolderClick(item.path, item.name);
                          } else {
                            // Handle file double-click
                          }
                        }}
                        onContextMenu={(e, item) => {
                          handleContextMenu(e, item.type === 'folder' ? { path: item.path, name: item.name } : item.file, item.type);
                        }}
                      />
                    ))}
                  </List>
                </SortableContext>
                
                <DragOverlay>
                  {activeId ? (
                    <div>
                      {allItems.find(item => item.id === activeId)?.name}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </Paper>
          </>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        open={!!contextMenu}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.type === 'file' && contextMenu?.item && (
          <>
            <MenuItem onClick={() => handleFileActionClick(contextMenu.item, 'download')}>
              <CloudDownload fontSize="small" sx={{ mr: 1 }} />
              Download
            </MenuItem>
            {contextMenu.item.status === 'uploaded' && (
              <MenuItem onClick={() => handleFileActionClick(contextMenu.item, 'archive')}>
                <Archive fontSize="small" sx={{ mr: 1 }} />
                Hibernate
              </MenuItem>
            )}
            {contextMenu.item.status === 'archived' && (
              <MenuItem onClick={() => handleFileActionClick(contextMenu.item, 'restore')}>
                <RestoreFromTrash fontSize="small" sx={{ mr: 1 }} />
                Wake Up
              </MenuItem>
            )}
            <MenuItem onClick={() => handleFileActionClick(contextMenu.item, 'info')}>
              <Info fontSize="small" sx={{ mr: 1 }} />
              Properties
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleFileActionClick(contextMenu.item, 'delete')}>
              <Delete fontSize="small" sx={{ mr: 1 }} color="error" />
              Delete
            </MenuItem>
          </>
        )}
        
        {contextMenu?.type === 'folder' && contextMenu?.item && (
          <>
            <MenuItem onClick={() => handleFolderClick(contextMenu.item.path, contextMenu.item.name)}>
              <FolderOpen fontSize="small" sx={{ mr: 1 }} />
              Open
            </MenuItem>
            <MenuItem>
              <CreateNewFolder fontSize="small" sx={{ mr: 1 }} />
              New Folder
            </MenuItem>
            <MenuItem>
              <Edit fontSize="small" sx={{ mr: 1 }} />
              Rename
            </MenuItem>
            <MenuItem>
              <Share fontSize="small" sx={{ mr: 1 }} />
              Share
            </MenuItem>
            <Divider />
            <MenuItem>
              <Delete fontSize="small" sx={{ mr: 1 }} color="error" />
              Delete
            </MenuItem>
          </>
        )}
      </Menu>

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

export default WindowsFileManager;
