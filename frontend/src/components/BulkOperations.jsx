import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Menu,
  MenuItem,
  Divider,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Grid,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  Stack,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material';
import {
  SelectAll,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  Delete,
  Share,
  Edit,
  MoreVert,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Info,
  Schedule,
  Speed,
  Storage,
  Folder,
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  Close,
  Refresh,
  Pause,
  PlayArrow,
  Stop,
  CloudUpload,
  CloudDone,
  CloudSync,
  CloudOff
} from '@mui/icons-material';
import AdvancedProgressBar from './AdvancedProgressBar';

const BulkOperations = ({ 
  files = [], 
  selectedFiles = new Set(), 
  onSelectionChange,
  onBulkAction,
  loading = false 
}) => {
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, action: null });
  const [operationProgress, setOperationProgress] = useState({});
  const [operationStatus, setOperationStatus] = useState('idle');
  const [operationResults, setOperationResults] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Get selected file objects
  const selectedFileObjects = files.filter(file => selectedFiles.has(file.id));

  // Calculate statistics
  const stats = {
    total: selectedFileObjects.length,
    totalSize: selectedFileObjects.reduce((sum, file) => sum + file.file_size, 0),
    byStatus: selectedFileObjects.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1;
      return acc;
    }, {}),
    byType: selectedFileObjects.reduce((acc, file) => {
      const type = file.file_type.split('/')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  };

  // Handle select all
  const handleSelectAll = (checked) => {
    if (checked) {
      const allFileIds = new Set(files.map(f => f.id));
      onSelectionChange(allFileIds);
    } else {
      onSelectionChange(new Set());
    }
  };

  // Handle individual file selection
  const handleFileSelect = (fileId, checked) => {
    const newSelection = new Set(selectedFiles);
    if (checked) {
      newSelection.add(fileId);
    } else {
      newSelection.delete(fileId);
    }
    onSelectionChange(newSelection);
  };

  // Handle bulk action
  const handleBulkAction = (action) => {
    setActionDialog({ open: true, action });
  };

  // Execute bulk operation
  const executeBulkOperation = async (action, options = {}) => {
    setOperationStatus('in_progress');
    setOperationProgress({});
    setOperationResults([]);

    try {
      const results = [];
      let completed = 0;
      const total = selectedFileObjects.length;

      // Initialize progress for all files
      selectedFileObjects.forEach(file => {
        setOperationProgress(prev => ({
          ...prev,
          [file.id]: { status: 'pending', progress: 0 }
        }));
      });

      // Execute the actual operation for all files at once
      if (onBulkAction) {
        try {
          // Simulate progress for bulk operations
          const progressInterval = setInterval(() => {
            setOperationProgress(prev => {
              const updated = { ...prev };
              selectedFileObjects.forEach(file => {
                if (updated[file.id]?.status === 'pending' || updated[file.id]?.status === 'in_progress') {
                  const currentProgress = updated[file.id]?.progress || 0;
                  const newProgress = Math.min(95, currentProgress + Math.random() * 20);
                  updated[file.id] = { 
                    status: 'in_progress', 
                    progress: newProgress 
                  };
                }
              });
              return updated;
            });
          }, 200);

          const result = await onBulkAction(action, selectedFileObjects, options);
          
          // Clear progress simulation and mark all files as completed
          clearInterval(progressInterval);
          selectedFileObjects.forEach(file => {
            setOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'completed', progress: 100 }
            }));
            results.push({ file, result, status: 'success' });
          });
          
          completed = selectedFileObjects.length;
        } catch (error) {
          // Mark all files as failed
          selectedFileObjects.forEach(file => {
            setOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'error', progress: 0 }
            }));
            results.push({ file, error: error.message, status: 'error' });
          });
        }
      }

      setOperationResults(results);
      setOperationStatus('completed');
    } catch (error) {
      setOperationStatus('error');
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

  // Get file type icon
  const getFileIcon = (file) => {
    const type = file.file_type.toLowerCase();
    if (type.startsWith('image/')) return <Image color="primary" />;
    if (type.startsWith('video/')) return <VideoFile color="secondary" />;
    if (type.startsWith('audio/')) return <AudioFile color="success" />;
    if (type.includes('pdf') || type.includes('document')) return <Description color="error" />;
    if (type.includes('text') || type.includes('code')) return <Code color="info" />;
    if (type.includes('zip') || type.includes('archive')) return <ArchiveIcon color="warning" />;
    return <InsertDriveFile color="action" />;
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

  // Get operation icon
  const getOperationIcon = (action) => {
    switch (action) {
      case 'download': return <CloudDownload />;
      case 'archive': return <Archive />;
      case 'restore': return <RestoreFromTrash />;
      case 'delete': return <Delete />;
      case 'share': return <Share />;
      case 'rename': return <Edit />;
      default: return <MoreVert />;
    }
  };

  // Get operation color
  const getOperationColor = (action) => {
    switch (action) {
      case 'download': return 'primary';
      case 'archive': return 'info';
      case 'restore': return 'warning';
      case 'delete': return 'error';
      case 'share': return 'success';
      case 'rename': return 'default';
      default: return 'default';
    }
  };

  // Available bulk actions
  const bulkActions = [
    { id: 'download', label: 'Download', icon: <CloudDownload />, color: 'primary' },
    { id: 'archive', label: 'Put to Sleep', icon: <Archive />, color: 'info' },
    { id: 'restore', label: 'Restore', icon: <RestoreFromTrash />, color: 'warning' },
    { id: 'share', label: 'Share', icon: <Share />, color: 'success' },
    { id: 'delete', label: 'Delete', icon: <Delete />, color: 'error' }
  ];

  // Filter actions based on file statuses
  const availableActions = bulkActions.filter(action => {
    if (action.id === 'archive') {
      return selectedFileObjects.some(f => f.status === 'uploaded');
    }
    if (action.id === 'restore') {
      return selectedFileObjects.some(f => f.status === 'archived');
    }
    return true;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Selection Summary */}
      {selectedFiles.size > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checkbox
                checked={selectedFiles.size === files.length}
                indeterminate={selectedFiles.size > 0 && selectedFiles.size < files.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
              <Typography variant="h6">
                {selectedFiles.size} file(s) selected
              </Typography>
              <Chip
                label={formatFileSize(stats.totalSize)}
                size="small"
                variant="outlined"
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              {availableActions.map((action) => (
                <Button
                  key={action.id}
                  size="small"
                  startIcon={action.icon}
                  onClick={() => handleBulkAction(action.id)}
                  color={action.color}
                  variant="outlined"
                >
                  {action.label}
                </Button>
              ))}
              <Button
                size="small"
                onClick={() => onSelectionChange(new Set())}
                startIcon={<Close />}
              >
                Clear
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* File List with Selection */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Files ({files.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<SelectAll />}
              onClick={() => handleSelectAll(true)}
            >
              Select All
            </Button>
            <Button
              size="small"
              onClick={() => onSelectionChange(new Set())}
            >
              Clear Selection
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedFiles.size === files.length}
                    indeterminate={selectedFiles.size > 0 && selectedFiles.size < files.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((file) => (
                  <TableRow key={file.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onChange={(e) => handleFileSelect(file.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getFileIcon(file)}
                        <Typography variant="body2">
                          {file.original_filename}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={file.file_type.split('/')[0]}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatFileSize(file.file_size)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={file.status}
                        color={getStatusColor(file.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(file.uploaded_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={files.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Bulk Operation Dialog */}
      <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, action: null })} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getOperationIcon(actionDialog.action)}
            <Typography variant="h6">
              {actionDialog.action?.charAt(0).toUpperCase() + actionDialog.action?.slice(1)} Files
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            You are about to {actionDialog.action} {selectedFiles.size} file(s):
          </Typography>
          
          <List dense>
            {selectedFileObjects.slice(0, 10).map((file) => (
              <ListItem key={file.id}>
                <ListItemIcon>
                  {getFileIcon(file)}
                </ListItemIcon>
                <ListItemText
                  primary={file.original_filename}
                  secondary={formatFileSize(file.file_size)}
                />
              </ListItem>
            ))}
            {selectedFileObjects.length > 10 && (
              <ListItem>
                <ListItemText
                  primary={`... and ${selectedFileObjects.length - 10} more files`}
                />
              </ListItem>
            )}
          </List>

          {operationStatus === 'in_progress' && (
            <Box sx={{ mt: 2 }}>
              <AdvancedProgressBar
                uploadJob={{
                  status: 'in_progress',
                  progress: Math.round(
                    selectedFileObjects.reduce((sum, file) => 
                      sum + (operationProgress[file.id]?.progress || 0), 0
                    ) / selectedFileObjects.length
                  ),
                  completedFiles: selectedFileObjects.filter(file => 
                    operationProgress[file.id]?.status === 'completed'
                  ).length,
                  totalFiles: selectedFileObjects.length,
                  totalSize: selectedFileObjects.reduce((sum, file) => sum + file.file_size, 0),
                  uploadedSize: selectedFileObjects.reduce((sum, file) => 
                    sum + (file.file_size * (operationProgress[file.id]?.progress || 0) / 100), 0
                  )
                }}
                showDetails={true}
              />
              
              <List dense sx={{ mt: 2 }}>
                {selectedFileObjects.map((file) => (
                  <ListItem key={file.id}>
                    <ListItemIcon>
                      {operationProgress[file.id]?.status === 'completed' ? (
                        <CheckCircle color="success" />
                      ) : operationProgress[file.id]?.status === 'error' ? (
                        <Error color="error" />
                      ) : operationProgress[file.id]?.status === 'in_progress' ? (
                        <Schedule color="warning" />
                      ) : (
                        <Schedule color="disabled" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={file.original_filename}
                      secondary={
                        operationProgress[file.id]?.status === 'in_progress' ? (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={operationProgress[file.id]?.progress || 0}
                              sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {Math.round(operationProgress[file.id]?.progress || 0)}%
                            </Typography>
                          </Box>
                        ) : operationProgress[file.id]?.status === 'error' ? (
                          'Failed'
                        ) : operationProgress[file.id]?.status === 'completed' ? (
                          'Completed'
                        ) : (
                          'Pending'
                        )
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {operationStatus === 'completed' && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Operation completed successfully!
              </Alert>
              <Typography variant="body2" gutterBottom>
                Results:
              </Typography>
              <List dense>
                {operationResults.map((result, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {result.status === 'success' ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Error color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={result.file.original_filename}
                      secondary={result.status === 'success' ? 'Success' : result.error}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {operationStatus === 'error' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Operation failed. Please try again.
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, action: null })}>
            Close
          </Button>
          {operationStatus === 'idle' && (
            <Button
              variant="contained"
              onClick={() => executeBulkOperation(actionDialog.action)}
              color={getOperationColor(actionDialog.action)}
            >
              {actionDialog.action?.charAt(0).toUpperCase() + actionDialog.action?.slice(1)}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkOperations;
