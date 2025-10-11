import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFileActions } from '../hooks/useFileActions';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Breadcrumbs,
  Link,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Checkbox,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Snackbar
} from '@mui/material';
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
import FileIcon from './FileIcon';
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  MoreVert,
  Add,
  Edit,
  Delete,
  Refresh,
  Home,
  NavigateNext,
  CreateNewFolder
} from '@mui/icons-material';

const FolderTree = ({ 
  files = [], 
  onFileSelect, 
  onFolderSelect,
  onBulkAction,
  selectedFiles = new Set(),
  onFileSelectionChange,
  loading = false 
}) => {
  const [expanded, setExpanded] = useState(['root']);
  const [selected, setSelected] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [createDialog, setCreateDialog] = useState({ open: false, type: 'folder' });
  const [newItemName, setNewItemName] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Home', path: 'root' }]);

  // State for optimized loading
  const [folderStructure, setFolderStructure] = useState({});
  const [currentFolderFiles, setCurrentFolderFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [pagination, setPagination] = useState({ current_page: 1, total_pages: 1 });
  
  // State for file manager functionality
  const [currentPath, setCurrentPath] = useState('root');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'size', 'date', 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  
  // Drag and drop state
  const [activeId, setActiveId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Create refresh function for file actions
  const refreshData = useCallback(() => {
    // Trigger a re-render by updating a state
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Use shared file actions hook
  const { handleFileAction } = useFileActions(refreshData);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Keyboard shortcuts
  useHotkeys('ctrl+a', () => handleSelectAll(), { preventDefault: true });
  useHotkeys('delete', () => handleBulkOperation('delete'), { preventDefault: true });
  useHotkeys('ctrl+d', () => handleBulkOperation('download'), { preventDefault: true });
  useHotkeys('escape', () => handleClearSelection(), { preventDefault: true });

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      // Handle file/folder move operation
      const activeItem = findItemById(active.id);
      const overItem = findItemById(over.id);
      
      if (activeItem && overItem) {
        if (overItem.type === 'folder') {
          // Move to folder
          handleMoveToFolder(activeItem, overItem);
        } else {
          // Reorder items
          handleReorderItems(active.id, over.id);
        }
      }
    }
    
    setActiveId(null);
  };

  const findItemById = (id) => {
    const currentFolder = folderStructure[currentPath];
    if (!currentFolder) return null;

    // Check files
    const file = currentFolder.files.find(f => f.id === id);
    if (file) return { ...file, type: 'file' };

    // Check folders
    const folderEntry = Object.entries(currentFolder.folders).find(([name, path]) => path === id);
    if (folderEntry) {
      const [name, path] = folderEntry;
      return { id: path, name, type: 'folder', path };
    }

    return null;
  };

  const handleMoveToFolder = async (item, targetFolder) => {
    try {
      if (item.type === 'file') {
        // Move file to folder
        // TODO: Implement actual file move API call
        setSnackbar({ open: true, message: `Moved ${item.displayName} to ${targetFolder.name}` });
      } else {
        // Move folder to folder
        // TODO: Implement actual folder move API call
        setSnackbar({ open: true, message: `Moved folder ${item.name} to ${targetFolder.name}` });
      }
    } catch (error) {
      console.error('Move operation failed:', error);
      setSnackbar({ open: true, message: 'Move operation failed' });
    }
  };

  const handleReorderItems = (activeId, overId) => {
    // Handle reordering of items in the current directory
    setSnackbar({ open: true, message: 'Items reordered' });
  };

  // Load folder structure from API (much faster)
  const loadFolderStructure = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8001/api/media-files/folder_structure/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFolderStructure(data);
    } catch (error) {
      console.error('Failed to load folder structure:', error);
    }
  }, []);

  // Load files for current folder from API
  const loadCurrentFolderFiles = useCallback(async (folderPath = 'root', page = 1) => {
    try {
      setIsLoadingFiles(true);
      const response = await fetch(
        `http://localhost:8001/api/media-files/list_optimized/?folder=${folderPath}&page=${page}&page_size=50`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setCurrentFolderFiles(data.files);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load folder files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const initializeFolderTree = async () => {
      await loadFolderStructure();
      
      // Always load files for the current folder (root by default)
      await loadCurrentFolderFiles(currentPath);
      
      // Check if root folder is empty and auto-navigate to first non-empty folder
      const rootFilesResponse = await fetch(
        'http://localhost:8001/api/media-files/list_optimized/?folder=root&page=1&page_size=1',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (rootFilesResponse.ok) {
        const rootData = await rootFilesResponse.json();
        if (rootData.files.length === 0) {
          // Root is empty, get folder structure and find first subfolder
          const folderResponse = await fetch('http://localhost:8001/api/media-files/folder_structure/', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (folderResponse.ok) {
            const folderData = await folderResponse.json();
            if (folderData?.root?.subfolders) {
              const subfolderNames = Object.keys(folderData.root.subfolders);
              if (subfolderNames.length > 0) {
                const firstFolder = subfolderNames[0];
                setCurrentPath(firstFolder);
                setBreadcrumbs([{ name: 'Root', path: 'root' }, { name: firstFolder, path: firstFolder }]);
                loadCurrentFolderFiles(firstFolder);
                return;
              }
            }
          }
        }
      }
      
      // Default: load root folder
      loadCurrentFolderFiles('root');
    };
    
    initializeFolderTree();
  }, [loadFolderStructure, loadCurrentFolderFiles]);

  // Get file icon
  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'uploaded': return 'success';
      case 'archiving': return 'warning';
      case 'archived': return 'info';
      case 'restoring': return 'warning';
      case 'restored': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle tree expansion (simplified for API-based loading)
  const handleToggle = useCallback((folderPath) => {
    setExpanded(prev => 
      prev.includes(folderPath) 
        ? prev.filter(id => id !== folderPath)
        : [...prev, folderPath]
    );
  }, []);

  // Handle node selection
  const handleSelect = (folderPath) => {
    setSelected(prev => 
      prev.includes(folderPath) 
        ? prev.filter(id => id !== folderPath)
        : [...prev, folderPath]
    );
  };

  // Handle folder click - navigate to directory
  const handleFolderClick = useCallback((folderPath, folderName) => {
    setCurrentPath(folderPath);
    
    if (onFolderSelect) {
      onFolderSelect(folderPath, folderName);
    }
    
    // Update breadcrumbs
    const pathParts = folderPath.split('/').filter(p => p !== 'root');
    const newBreadcrumbs = [{ name: 'Home', path: 'root' }];
    
    let currentPath = 'root';
    pathParts.forEach(part => {
      currentPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
      newBreadcrumbs.push({ name: part, path: currentPath });
    });
    
    setBreadcrumbs(newBreadcrumbs);
    
    // Load files for this folder (optimized)
    loadCurrentFolderFiles(folderPath);
  }, [loadCurrentFolderFiles, onFolderSelect]);

  // Handle item selection
  const handleItemSelect = (itemId, itemType) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    const currentFolder = folderStructure[currentPath];
    if (!currentFolder) return;

    const allItems = new Set();
    
    // Add all files
    currentFolder.files.forEach(file => allItems.add(file.id));
    
    // Add all subfolders
    Object.values(currentFolder.folders).forEach(folderPath => {
      allItems.add(folderPath);
    });

    setSelectedItems(allItems);
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  // Handle bulk operations
  const handleBulkOperation = async (operation) => {
    if (selectedItems.size === 0) return;

    const selectedFiles = [];
    const selectedFolders = [];

    // Separate files and folders
    selectedItems.forEach(itemId => {
      const currentFolder = folderStructure[currentPath];
      if (!currentFolder) return;

      // Check if it's a file
      const file = currentFolder.files.find(f => f.id === itemId);
      if (file) {
        selectedFiles.push(file);
      } else {
        // It's a folder
        selectedFolders.push(itemId);
      }
    });

    try {
      switch (operation) {
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${selectedFiles.length} files and ${selectedFolders.length} folders?`)) {
            // Delete files
            for (const file of selectedFiles) {
              if (onFileSelect) {
                await onFileSelect(file, 'delete');
              }
            }
            // TODO: Delete folders
          }
          break;
        
        case 'archive':
          if (window.confirm(`Are you sure you want to archive ${selectedFiles.length} files?`)) {
            for (const file of selectedFiles) {
              if (onFileSelect) {
                await onFileSelect(file, 'archive');
              }
            }
          }
          break;
        
        case 'download':
          for (const file of selectedFiles) {
            if (onFileSelect) {
              await onFileSelect(file, 'download');
            }
          }
          break;
        
        default:
      }
      
      // Clear selection after operation
      handleClearSelection();
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  };

  // Handle file click
  const handleFileClick = (file) => {
    if (onFileSelect) {
      onFileSelect(file, 'view');
    }
  };

  // Handle file selection
  const handleFileSelection = (file, checked) => {
    if (onFileSelectionChange) {
      onFileSelectionChange(file, checked);
    }
  };

  // Handle context menu
  const handleContextMenu = (event, item, type) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      item,
      type
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Handle create dialog
  const handleCreateDialog = (type) => {
    setCreateDialog({ open: true, type });
    setNewItemName('');
  };

  const handleCreateItem = () => {
    // Implementation for creating new folder/file
    setCreateDialog({ open: false, type: 'folder' });
    setNewItemName('');
  };

  // Render folder tree item
  const renderFolderItem = (folderName, folder, level = 0) => {
    // Safety check for folder object
    if (!folder || typeof folder !== 'object') {
      return null;
    }
    
    const isExpanded = expanded.includes(folderName);
    const isSelected = selected.includes(folderName);

    return (
      <Box key={folderName} sx={{ ml: level * 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            cursor: 'pointer'
          }}
          onClick={() => handleFolderClick(folderName, folderName)}
          onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(folderName);
            }}
            sx={{ mr: 0.5 }}
          >
            {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
          </IconButton>
          {isExpanded ? <FolderOpen color="primary" /> : <Folder color="primary" />}
          <Typography variant="body2" sx={{ ml: 1, flexGrow: 1 }}>
            {folderName}
          </Typography>
          <Chip
            label={`${folder.files || 0} files`}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
            color="default"
          />
          <Typography variant="caption" color="text.secondary">
            {folder.size && folder.size > 0 ? formatFileSize(folder.size) : '0 B'}
          </Typography>
        </Box>
        
        <Collapse in={isExpanded}>
          <Box>
            {/* Render subfolders */}
            {folder.subfolders && Object.entries(folder.subfolders).map(([folderName, subFolder]) => 
              renderFolderItem(folderName, subFolder, level + 1)
            )}
            
            {/* Show file count indicator */}
            {folder.files > 0 && (
              <Box sx={{ ml: (level + 1) * 2, py: 0.5, px: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {folder.files} file{folder.files !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

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
        onClick={() => onSelect(item.id, item.type)}
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
          {item.type === 'folder' ? (
            <Folder color="primary" />
          ) : (
            <FileIcon file={item.file} size="small" />
          )}
        </ListItemIcon>
        
        <ListItemText
          primary={item.name}
          secondary={
            item.type === 'folder' 
              ? `${item.fileCount} files • ${formatFileSize(item.size)}`
              : `${formatFileSize(item.size)} • ${item.status || 'uploaded'}`
          }
        />
        
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* Individual file action buttons */}
            {item.type === 'file' && (
              <>
                {/* Debug info */}
                {/* Download button */}
                <Tooltip title="Download">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileAction(item.file, 'download');
                    }}
                    sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                  >
                    <CloudDownload fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                {/* Archive button (for uploaded files) - Always show for testing */}
                {((item.file?.status === 'uploaded' || item.file?.status === 'archived') || !item.file?.status) && (
                  <Tooltip title="Archive to Glacier">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileAction(item.file, 'archive');
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <Archive fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {/* Restore button (for archived files) - Always show for testing */}
                {((item.file?.status === 'archived' || item.file?.status === 'uploaded') || !item.file?.status) && (
                  <Tooltip title="Restore from Glacier">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileAction(item.file, 'restore');
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <RestoreFromTrash fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                
                {/* Delete button */}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileAction(item.file, 'delete');
                    }}
                    sx={{ bgcolor: 'background.paper', boxShadow: 1, color: 'error.main' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            {/* Context menu button */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(e, item);
              }}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  // Render current directory contents in list view (optimized)
  const renderCurrentDirectory = () => {
    if (isLoadingFiles) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Loading files...</Typography>
        </Box>
      );
    }

    // Convert API files to display format
    const allItems = currentFolderFiles.map(file => ({
      id: file.id,
      name: file.original_filename,
      type: 'file',
      file: file,
      size: file.file_size,
      status: file.status
    }));

    // Sort items
    allItems.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return (
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Toolbar */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            {selectedItems.size > 0 ? `${selectedItems.size} selected` : `${allItems.length} items`}
          </Typography>
          
          {selectedItems.size > 0 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => handleBulkOperation('download')}>
                Download
              </Button>
              <Button size="small" onClick={() => handleBulkOperation('archive')}>
                Archive
              </Button>
              <Button size="small" color="error" onClick={() => handleBulkOperation('delete')}>
                Delete
              </Button>
              <Button size="small" onClick={handleClearSelection}>
                Clear
              </Button>
            </Box>
          )}
          
          <Button size="small" onClick={handleSelectAll}>
            Select All
          </Button>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              label="Sort by"
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="size">Size</MenuItem>
              <MenuItem value="type">Type</MenuItem>
            </Select>
          </FormControl>
          
          <IconButton size="small" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </IconButton>
        </Box>

        {/* Items list with drag and drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <List>
              {allItems.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  onSelect={handleItemSelect}
                  onDoubleClick={(item) => {
                    if (item.type === 'folder') {
                      handleFolderClick(item.path, item.name);
                    } else {
                      handleFileClick(item.file);
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
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 3 }}>
                <Typography variant="body2">
                  {findItemById(activeId)?.name || 'Unknown item'}
                  </Typography>
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
        
        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Page {pagination.current_page} of {pagination.total_pages} ({pagination.total_files} files)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                disabled={!pagination.has_previous}
                onClick={() => loadCurrentFolderFiles(currentPath, pagination.current_page - 1)}
              >
                Previous
              </Button>
              <Button
                size="small"
                disabled={!pagination.has_next}
                onClick={() => loadCurrentFolderFiles(currentPath, pagination.current_page + 1)}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">File Manager</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Tree View">
              <IconButton 
                size="small" 
                onClick={() => setViewMode('tree')}
                color={viewMode === 'tree' ? 'primary' : 'default'}
              >
                <FolderOpen />
              </IconButton>
            </Tooltip>
            <Tooltip title="List View">
              <IconButton 
                size="small" 
                onClick={() => setViewMode('list')}
                color={viewMode === 'list' ? 'primary' : 'default'}
              >
                <List />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="New Folder">
              <IconButton size="small" onClick={() => handleCreateDialog('folder')}>
                <CreateNewFolder />
              </IconButton>
            </Tooltip>
            <Tooltip title="New File">
              <IconButton size="small" onClick={() => handleCreateDialog('file')}>
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => window.location.reload()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Breadcrumbs */}
        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
          {breadcrumbs.map((crumb, index) => (
            <Link
              key={crumb.path}
              color={index === breadcrumbs.length - 1 ? 'text.primary' : 'inherit'}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (index < breadcrumbs.length - 1) {
                  handleFolderClick(crumb.path, crumb.name);
                }
              }}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              {index === 0 && <Home fontSize="small" sx={{ mr: 0.5 }} />}
              {crumb.name}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      {/* Main content area */}
      <Box sx={{ flexGrow: 1, display: 'flex' }}>
        {viewMode === 'tree' ? (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        {folderStructure.root ? renderFolderItem('root', folderStructure.root) : (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography>Loading folder structure...</Typography>
          </Box>
        )}
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            {renderCurrentDirectory()}
          </Box>
        )}
      </Box>

      {/* Context menu */}
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
            <MenuItem onClick={() => handleFileAction(contextMenu.item, 'download')}>
              <CloudDownload fontSize="small" sx={{ mr: 1 }} />
              Download
            </MenuItem>
            {contextMenu.item.status === 'uploaded' && (
              <MenuItem onClick={() => handleFileAction(contextMenu.item, 'archive')}>
                <Archive fontSize="small" sx={{ mr: 1 }} />
                Archive
              </MenuItem>
            )}
            {contextMenu.item.status === 'archived' && (
              <MenuItem onClick={() => handleFileAction(contextMenu.item, 'restore')}>
                <RestoreFromTrash fontSize="small" sx={{ mr: 1 }} />
                Restore
              </MenuItem>
            )}
            <MenuItem onClick={() => handleFileAction(contextMenu.item, 'info')}>
              <Description fontSize="small" sx={{ mr: 1 }} />
              Details
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleFileAction(contextMenu.item, 'delete')}>
              <Delete fontSize="small" sx={{ mr: 1 }} color="error" />
              Delete
            </MenuItem>
          </>
        )}
        
        {contextMenu?.type === 'folder' && contextMenu?.item && (
          <>
            <MenuItem onClick={() => handleCreateDialog('folder')}>
              <CreateNewFolder fontSize="small" sx={{ mr: 1 }} />
              New Folder
            </MenuItem>
            <MenuItem onClick={() => handleCreateDialog('file')}>
              <Add fontSize="small" sx={{ mr: 1 }} />
              New File
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleFileAction(contextMenu.item, 'rename')}>
              <Edit fontSize="small" sx={{ mr: 1 }} />
              Rename
            </MenuItem>
            <MenuItem onClick={() => handleFileAction(contextMenu.item, 'delete')}>
              <Delete fontSize="small" sx={{ mr: 1 }} color="error" />
              Delete
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Create dialog */}
      <Dialog open={createDialog.open} onClose={() => setCreateDialog({ open: false, type: 'folder' })}>
        <DialogTitle>
          Create New {createDialog.type === 'folder' ? 'Folder' : 'File'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={`${createDialog.type === 'folder' ? 'Folder' : 'File'} Name`}
            fullWidth
            variant="outlined"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog({ open: false, type: 'folder' })}>
            Cancel
          </Button>
          <Button onClick={handleCreateItem} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default FolderTree;
