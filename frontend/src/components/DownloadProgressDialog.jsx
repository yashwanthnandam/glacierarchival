import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  Chip
} from '@mui/material';
import { CloudDownload, Lock, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';

const DownloadProgressDialog = ({ open, onClose, downloadInfo }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && downloadInfo) {
      setProgress(0);
      setStatus('Starting download...');
      setIsDecrypting(false);
      setError(null);
      setSuccess(false);
    }
  }, [open, downloadInfo]);

  const handleClose = () => {
    if (!isDecrypting) {
      onClose();
    }
  };

  const simulateProgress = () => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 10;
      if (currentProgress >= 90) {
        currentProgress = 90;
        clearInterval(interval);
        // Don't automatically set success - let the parent component handle it
        setStatus('Preparing download...');
      }
      setProgress(currentProgress);
    }, 300);
  };

  useEffect(() => {
    if (open && downloadInfo) {
      simulateProgress();
    }
  }, [open, downloadInfo]);

  // Listen for success from parent component
  useEffect(() => {
    if (downloadInfo?.downloadComplete) {
      setProgress(100);
      setSuccess(true);
      setStatus('Download complete!');
    }
  }, [downloadInfo?.downloadComplete]);

  if (!downloadInfo) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudDownload color="primary" />
          <Typography variant="h6">Downloading File</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            {downloadInfo.isBulkDownload ? `Bulk Download (${downloadInfo.fileCount} files)` : downloadInfo.filename}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {downloadInfo.isBulkDownload 
              ? `${downloadInfo.fileCount} files • Total size: ${(downloadInfo.file_size / (1024 * 1024)).toFixed(2)} MB`
              : `Size: ${(downloadInfo.file_size / (1024 * 1024)).toFixed(2)} MB`
            }
          </Typography>
        </Box>

        {downloadInfo.is_encrypted && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<Lock />}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              🔒 Encrypted File{downloadInfo.isBulkDownload ? 's' : ''}
            </Typography>
            <Typography variant="body2">
              {downloadInfo.isBulkDownload 
                ? 'Some files will be automatically decrypted during download.'
                : 'This file will be automatically decrypted during download.'
              }
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip label="AES-GCM 256-bit" size="small" color="primary" />
              <Chip label="E2E Encrypted" size="small" color="success" />
            </Box>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Download Failed
            </Typography>
            <Typography variant="body2">
              {error}
            </Typography>
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Download Complete
            </Typography>
            <Typography variant="body2">
              {downloadInfo.isBulkDownload 
                ? (downloadInfo.is_encrypted ? 'Files downloaded and decrypted successfully!' : 'Files downloaded successfully!')
                : (downloadInfo.is_encrypted ? 'File downloaded and decrypted successfully!' : 'File downloaded successfully!')
              }
            </Typography>
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {status}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {progress.toFixed(1)}% complete
          </Typography>
        </Box>

        {isDecrypting && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Decrypting file...
            </Typography>
            <LinearProgress 
              variant="indeterminate" 
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isDecrypting}>
          {success ? 'Close' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadProgressDialog;
