import React, { useState, useEffect } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Pause,
  PlayArrow,
  Cancel,
  ExpandMore,
  ExpandLess,
  Speed,
  Schedule,
  Storage
} from '@mui/icons-material';

const AdvancedProgressBar = ({ 
  uploadJob, 
  onCancel, 
  onPause, 
  onResume,
  showDetails = true 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (uploadJob && uploadJob.status === 'in_progress') {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (uploadJob.uploadedSize && elapsed > 0) {
          const speed = uploadJob.uploadedSize / elapsed;
          setUploadSpeed(speed);
          
          if (uploadJob.totalSize && speed > 0) {
            const remaining = (uploadJob.totalSize - uploadJob.uploadedSize) / speed;
            setEstimatedTime(remaining);
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [uploadJob, startTime]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity) return 'Calculating...';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'primary';
      case 'paused':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'in_progress':
        return <PlayArrow color="primary" />;
      case 'paused':
        return <Pause color="warning" />;
      case 'cancelled':
        return <Cancel color="disabled" />;
      default:
        return <PlayArrow color="action" />;
    }
  };

  if (!uploadJob) return null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* Main Progress Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getStatusIcon(uploadJob.status)}
              <Typography variant="h6" component="span">
                Upload Progress
              </Typography>
              <Chip
                label={uploadJob.status}
                color={getStatusColor(uploadJob.status)}
                size="small"
              />
            </Box>
            
            <LinearProgress
              variant="determinate"
              value={uploadJob.progress || 0}
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                }
              }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {uploadJob.progress || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {uploadJob.completedFiles || 0} / {uploadJob.totalFiles || 0} files
              </Typography>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {uploadJob.status === 'in_progress' && (
              <Tooltip title="Pause Upload">
                <IconButton onClick={() => onPause && onPause()}>
                  <Pause />
                </IconButton>
              </Tooltip>
            )}
            
            {uploadJob.status === 'paused' && (
              <Tooltip title="Resume Upload">
                <IconButton onClick={() => onResume && onResume()}>
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            )}
            
            {['in_progress', 'paused'].includes(uploadJob.status) && (
              <Tooltip title="Cancel Upload">
                <IconButton onClick={() => onCancel && onCancel()} color="error">
                  <Cancel />
                </IconButton>
              </Tooltip>
            )}
            
            {showDetails && (
              <Tooltip title={expanded ? "Hide Details" : "Show Details"}>
                <IconButton onClick={() => setExpanded(!expanded)}>
                  {expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Detailed Information */}
        <Collapse in={expanded}>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {/* Upload Speed */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Speed color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Upload Speed
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatSpeed(uploadSpeed)}
                </Typography>
              </Box>
            </Box>

            {/* Estimated Time */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Estimated Time
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatTime(estimatedTime)}
                </Typography>
              </Box>
            </Box>

            {/* Data Transferred */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storage color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Data Transferred
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatBytes(uploadJob.uploadedSize || 0)} / {formatBytes(uploadJob.totalSize || 0)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Failed Files */}
          {uploadJob.failedFiles > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Failed Files ({uploadJob.failedFiles})
              </Typography>
              <List dense>
                {uploadJob.failedFilesList?.slice(0, 5).map((file, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon>
                      <Error color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.filename}
                      secondary={file.error}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
                {uploadJob.failedFiles > 5 && (
                  <ListItem>
                    <ListItemText
                      primary={`... and ${uploadJob.failedFiles - 5} more failed files`}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}

          {/* Job Details */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Job Details
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Job ID: {uploadJob.job_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Started: {new Date(uploadJob.startTime).toLocaleTimeString()}
              </Typography>
              {uploadJob.duration && (
                <Typography variant="body2" color="text.secondary">
                  Duration: {formatTime(uploadJob.duration / 1000)}
                </Typography>
              )}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default AdvancedProgressBar;
