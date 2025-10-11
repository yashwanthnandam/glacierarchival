import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  LinearProgress,
  Badge,
  Button,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  Divider
} from '@mui/material';
import {
  CloudDownload,
  Archive,
  RestoreFromTrash,
  MoreVert,
  Folder,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  Search,
  ViewModule,
  ViewList,
  FilterList,
  Sort,
  Refresh,
  Add,
  Delete,
  Edit,
  Share,
  Info,
  GetApp,
  CloudUpload
} from '@mui/icons-material';

const FileGrid = ({ 
  files = [], 
  onFileSelect, 
  onBulkAction, 
  onRefresh,
  loading = false 
}) => {
  const [viewMode, setViewMode] = useState('grid');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [contextMenu, setContextMenu] = useState(null);
  const [hoveredFile, setHoveredFile] = useState(null);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let filtered = files.filter(file => {
      const matchesSearch = file.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || file.file_type.startsWith(filterType);
      const matchesStatus = filterStatus === 'all' || file.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });

    // Sort files
    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'name':
          aValue = a.original_filename.toLowerCase();
          bValue = b.original_filename.toLowerCase();
          break;
        case 'size':
          aValue = a.file_size;
          bValue = b.file_size;
          break;
        case 'date':
          aValue = new Date(a.uploaded_at);
          bValue = new Date(b.uploaded_at);
          break;
        case 'type':
          aValue = a.file_type;
          bValue = b.file_type;
          break;
        default:
          aValue = a.original_filename.toLowerCase();
          bValue = b.original_filename.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [files, searchQuery, filterType, filterStatus, sortBy, sortOrder]);

  // Get file type icon
  const getFileIcon = (file) => {
    const type = file.file_type.toLowerCase();
    if (type.startsWith('image/')) return <Image color="primary" />;
    if (type.startsWith('video/')) return <VideoFile color="secondary" />;
    if (type.startsWith('audio/')) return <AudioFile color="success" />;
    if (type.includes('pdf') || type.includes('document')) return <Description color="error" />;
    if (type.includes('text') || type.includes('code')) return <Code color="info" />;
    if (type.includes('zip') || type.includes('archive')) return <ArchiveIcon color="warning" />;
    return <Description color="action" />;
  };

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

  // Handle file selection
  const handleFileSelect = (file, checked) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(file.id);
    } else {
      newSelected.delete(file.id);
    }
    setSelectedFiles(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  // Handle context menu
  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      file
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Handle file actions
  const handleFileAction = (action, file) => {
    if (onFileSelect) {
      onFileSelect(file, action);
    }
    handleCloseContextMenu();
  };

  // Handle bulk actions
  const handleBulkAction = (action) => {
    const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
    if (onBulkAction) {
      onBulkAction(action, selectedFileObjects);
    }
    setSelectedFiles(new Set());
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          My Files ({filteredFiles.length})
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />

          {/* View mode toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="grid">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Refresh button */}
          <IconButton onClick={onRefresh} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Filters and sorting */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            label="Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="image">Images</MenuItem>
            <MenuItem value="video">Videos</MenuItem>
            <MenuItem value="audio">Audio</MenuItem>
            <MenuItem value="application">Documents</MenuItem>
            <MenuItem value="text">Text</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="uploaded">Uploaded</MenuItem>
            <MenuItem value="archiving">Archiving</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
            <MenuItem value="restoring">Restoring</MenuItem>
            <MenuItem value="restored">Restored</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort by</InputLabel>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            label="Sort by"
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="size">Size</MenuItem>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="type">Type</MenuItem>
          </Select>
        </FormControl>

        <IconButton
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          size="small"
        >
          <Sort />
        </IconButton>
      </Box>

      {/* Bulk actions */}
      {selectedFiles.size > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ alignSelf: 'center', mr: 2 }}>
            {selectedFiles.size} file(s) selected
          </Typography>
          <Button
            size="small"
            startIcon={<CloudDownload />}
            onClick={() => handleBulkAction('download')}
          >
            Download
          </Button>
          <Button
            size="small"
            startIcon={<Archive />}
            onClick={() => handleBulkAction('archive')}
          >
            Archive
          </Button>
          <Button
            size="small"
            startIcon={<Delete />}
            onClick={() => handleBulkAction('delete')}
            color="error"
          >
            Delete
          </Button>
        </Box>
      )}

      {/* Files grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <LinearProgress sx={{ width: '100%' }} />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredFiles.map((file) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                  },
                  border: selectedFiles.has(file.id) ? 2 : 0,
                  borderColor: 'primary.main',
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
                onMouseEnter={() => setHoveredFile(file.id)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onChange={(e) => handleFileSelect(file, e.target.checked)}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar sx={{ bgcolor: 'primary.light', mr: 1 }}>
                      {getFileIcon(file)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        noWrap
                        title={file.original_filename}
                      >
                        {file.original_filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(file.file_size)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      label={file.status}
                      color={getStatusColor(file.status)}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(file.uploaded_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {file.status === 'uploaded' && (
                      <Tooltip title="Archive">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileAction('archive', file);
                          }}
                        >
                          <Archive />
                        </IconButton>
                      </Tooltip>
                    )}
                    {file.status === 'archived' && (
                      <Tooltip title="Restore">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileAction('restore', file);
                          }}
                        >
                          <RestoreFromTrash />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(file.status === 'uploaded' || file.status === 'restored') && (
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileAction('download', file);
                          }}
                        >
                          <CloudDownload />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, file);
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty state */}
      {filteredFiles.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No files found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Upload some files to get started'
            }
          </Typography>
        </Box>
      )}

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
        {contextMenu?.file && (
          <>
            <MenuItem onClick={() => handleFileAction('download', contextMenu.file)}>
              <ListItemIcon>
                <CloudDownload fontSize="small" />
              </ListItemIcon>
              <ListItemText>Download</ListItemText>
            </MenuItem>
            {contextMenu.file.status === 'uploaded' && (
              <MenuItem onClick={() => handleFileAction('archive', contextMenu.file)}>
                <ListItemIcon>
                  <Archive fontSize="small" />
                </ListItemIcon>
                <ListItemText>Archive</ListItemText>
              </MenuItem>
            )}
            {contextMenu.file.status === 'archived' && (
              <MenuItem onClick={() => handleFileAction('restore', contextMenu.file)}>
                <ListItemIcon>
                  <RestoreFromTrash fontSize="small" />
                </ListItemIcon>
                <ListItemText>Restore</ListItemText>
              </MenuItem>
            )}
            <MenuItem onClick={() => handleFileAction('info', contextMenu.file)}>
              <ListItemIcon>
                <Info fontSize="small" />
              </ListItemIcon>
              <ListItemText>Details</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleFileAction('delete', contextMenu.file)}>
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};

export default FileGrid;
