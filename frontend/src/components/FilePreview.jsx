import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Tooltip,
  Badge,
  Stack
} from '@mui/material';
import {
  Close,
  CloudDownload,
  Archive,
  RestoreFromTrash,
  Share,
  Edit,
  Delete,
  Info,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  InsertDriveFile,
  CalendarToday,
  Storage,
  Speed,
  CheckCircle,
  Error,
  Warning,
  Schedule,
  CloudUpload,
  CloudDone,
  CloudSync,
  CloudOff
} from '@mui/icons-material';

const FilePreview = ({ 
  open, 
  file, 
  onClose, 
  onAction,
  loading = false 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (file && open) {
      generatePreview();
    }
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [file, open]);

  // Generate preview URL for images and videos
  const generatePreview = async () => {
    if (!file) return;

    setPreviewLoading(true);
    try {
      // For now, we'll use a placeholder. In a real app, you'd fetch the actual file
      if (file.file_type.startsWith('image/')) {
        // Simulate image preview
        setPreviewUrl('/api/placeholder/400/300');
      } else if (file.file_type.startsWith('video/')) {
        // Simulate video preview
        setPreviewUrl('/api/placeholder/400/300');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Get file type icon
  const getFileIcon = (file) => {
    const type = file.file_type.toLowerCase();
    if (type.startsWith('image/')) return <Image color="primary" sx={{ fontSize: 48 }} />;
    if (type.startsWith('video/')) return <VideoFile color="secondary" sx={{ fontSize: 48 }} />;
    if (type.startsWith('audio/')) return <AudioFile color="success" sx={{ fontSize: 48 }} />;
    if (type.includes('pdf') || type.includes('document')) return <Description color="error" sx={{ fontSize: 48 }} />;
    if (type.includes('text') || type.includes('code')) return <Code color="info" sx={{ fontSize: 48 }} />;
    if (type.includes('zip') || type.includes('archive')) return <ArchiveIcon color="warning" sx={{ fontSize: 48 }} />;
    return <InsertDriveFile color="action" sx={{ fontSize: 48 }} />;
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploaded': return <CloudDone color="success" />;
      case 'archiving': return <CloudSync color="warning" />;
      case 'archived': return <Archive color="info" />;
      case 'restoring': return <CloudSync color="warning" />;
      case 'restored': return <CloudDone color="success" />;
      case 'failed': return <CloudOff color="error" />;
      default: return <CloudUpload color="action" />;
    }
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

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Handle action
  const handleAction = (action) => {
    if (onAction) {
      onAction(file, action);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  if (!file) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {getFileIcon(file)}
            <Box>
              <Typography variant="h6" noWrap sx={{ maxWidth: 400 }}>
                {file.original_filename}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip
                  icon={getStatusIcon(file.status)}
                  label={file.status}
                  color={getStatusColor(file.status)}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(file.file_size)}
                </Typography>
              </Box>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Preview" />
            <Tab label="Details" />
            <Tab label="History" />
            <Tab label="Actions" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Box>
              {/* File Preview */}
              <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
                {previewLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <LinearProgress sx={{ width: '100%' }} />
                    <Typography variant="body2" color="text.secondary">
                      Loading preview...
                    </Typography>
                  </Box>
                ) : file.file_type.startsWith('image/') ? (
                  <Box>
                    <img
                      src={previewUrl || '/api/placeholder/400/300'}
                      alt={file.original_filename}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 400,
                        objectFit: 'contain',
                        borderRadius: 8
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <Box sx={{ display: 'none', mt: 2 }}>
                      <Alert severity="info">
                        Preview not available for this image
                      </Alert>
                    </Box>
                  </Box>
                ) : file.file_type.startsWith('video/') ? (
                  <Box>
                    <video
                      controls
                      style={{
                        maxWidth: '100%',
                        maxHeight: 400,
                        borderRadius: 8
                      }}
                    >
                      <source src={previewUrl || '/api/placeholder/400/300'} type={file.file_type} />
                      Your browser does not support the video tag.
                    </video>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {getFileIcon(file)}
                    <Typography variant="h6" color="text.secondary">
                      Preview not available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This file type cannot be previewed
                    </Typography>
                  </Box>
                )}
              </Paper>

              {/* Quick Actions */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownload />}
                    fullWidth
                    onClick={() => handleAction('download')}
                  >
                    Download
                  </Button>
                </Grid>
                {file.status === 'uploaded' && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      variant="outlined"
                      startIcon={<Archive />}
                      fullWidth
                      onClick={() => handleAction('archive')}
                    >
                      Archive
                    </Button>
                  </Grid>
                )}
                {file.status === 'archived' && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Button
                      variant="outlined"
                      startIcon={<RestoreFromTrash />}
                      fullWidth
                      onClick={() => handleAction('restore')}
                    >
                      Restore
                    </Button>
                  </Grid>
                )}
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="outlined"
                    startIcon={<Share />}
                    fullWidth
                    onClick={() => handleAction('share')}
                  >
                    Share
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              {/* File Details */}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        File Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <InsertDriveFile />
                          </ListItemIcon>
                          <ListItemText
                            primary="Filename"
                            secondary={file.original_filename}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Storage />
                          </ListItemIcon>
                          <ListItemText
                            primary="Size"
                            secondary={formatFileSize(file.file_size)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <Description />
                          </ListItemIcon>
                          <ListItemText
                            primary="Type"
                            secondary={file.file_type}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <CalendarToday />
                          </ListItemIcon>
                          <ListItemText
                            primary="Uploaded"
                            secondary={formatDate(file.uploaded_at)}
                          />
                        </ListItem>
                        {file.archived_at && (
                          <ListItem>
                            <ListItemIcon>
                              <Archive />
                            </ListItemIcon>
                            <ListItemText
                              primary="Archived"
                              secondary={formatDate(file.archived_at)}
                            />
                          </ListItem>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Status & Metadata
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            {getStatusIcon(file.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary="Status"
                            secondary={file.status}
                          />
                          <Chip
                            label={file.status}
                            color={getStatusColor(file.status)}
                            size="small"
                          />
                        </ListItem>
                        {file.checksum && (
                          <ListItem>
                            <ListItemIcon>
                              <CheckCircle />
                            </ListItemIcon>
                            <ListItemText
                              primary="Checksum"
                              secondary={file.checksum}
                            />
                          </ListItem>
                        )}
                        {file.glacier_archive_id && (
                          <ListItem>
                            <ListItemIcon>
                              <Archive />
                            </ListItemIcon>
                            <ListItemText
                              primary="Glacier ID"
                              secondary={file.glacier_archive_id}
                            />
                          </ListItem>
                        )}
                        {file.restore_tier && (
                          <ListItem>
                            <ListItemIcon>
                              <Speed />
                            </ListItemIcon>
                            <ListItemText
                              primary="Restore Tier"
                              secondary={file.restore_tier}
                            />
                          </ListItem>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {file.description && (
                <Card sx={{ mt: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Description
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {file.description}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              {/* File History */}
              <Typography variant="h6" gutterBottom>
                File History
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CloudUpload color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="File uploaded"
                    secondary={formatDate(file.uploaded_at)}
                  />
                </ListItem>
                {file.status === 'archived' && (
                  <ListItem>
                    <ListItemIcon>
                      <Archive color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="File archived"
                      secondary={file.archived_at ? formatDate(file.archived_at) : 'Recently'}
                    />
                  </ListItem>
                )}
                {file.status === 'restored' && (
                  <ListItem>
                    <ListItemIcon>
                      <RestoreFromTrash color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="File restored"
                      secondary="Recently"
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}

          {activeTab === 3 && (
            <Box>
              {/* Available Actions */}
              <Typography variant="h6" gutterBottom>
                Available Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <CloudDownload color="primary" sx={{ fontSize: 48, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Download
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Download this file to your device
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<CloudDownload />}
                        fullWidth
                        onClick={() => handleAction('download')}
                      >
                        Download
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                {file.status === 'uploaded' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Archive color="info" sx={{ fontSize: 48, mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Archive
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Move file to Glacier for long-term storage
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<Archive />}
                          fullWidth
                          onClick={() => handleAction('archive')}
                        >
                          Archive
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {file.status === 'archived' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <RestoreFromTrash color="warning" sx={{ fontSize: 48, mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Restore
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Restore file from Glacier (takes 3-5 hours)
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<RestoreFromTrash />}
                          fullWidth
                          onClick={() => handleAction('restore')}
                        >
                          Restore
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Share color="success" sx={{ fontSize: 48, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Share
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Generate a shareable link
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<Share />}
                        fullWidth
                        onClick={() => handleAction('share')}
                      >
                        Share
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Edit color="action" sx={{ fontSize: 48, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Rename
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Change the filename
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<Edit />}
                        fullWidth
                        onClick={() => handleAction('rename')}
                      >
                        Rename
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Delete color="error" sx={{ fontSize: 48, mb: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Delete
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Permanently delete this file
                      </Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        fullWidth
                        onClick={() => handleAction('delete')}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FilePreview;
