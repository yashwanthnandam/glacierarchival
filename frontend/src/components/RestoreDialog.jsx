import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import { RestoreFromTrash, Schedule, Speed, AttachMoney } from '@mui/icons-material';
import { mediaAPI } from '../services/api';

const RestoreDialog = ({ open, onClose, file, onRestoreSuccess }) => {
  const [restoreTiers, setRestoreTiers] = useState([]);
  const [selectedTier, setSelectedTier] = useState('Standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      fetchRestoreTiers();
    }
  }, [open]);

  const fetchRestoreTiers = async () => {
    try {
      const response = await mediaAPI.getRestoreTiers();
      setRestoreTiers(response.data);
    } catch (error) {
      console.error('Error fetching restore tiers:', error);
    }
  };

  const handleRestore = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const response = await mediaAPI.restoreFile(file.id, selectedTier);
      
      if (onRestoreSuccess) {
        onRestoreSuccess(response.data);
      }
      
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'Expedited':
        return <Speed color="success" />;
      case 'Standard':
        return <Schedule color="primary" />;
      case 'Bulk':
        return <AttachMoney color="secondary" />;
      default:
        return <Schedule color="primary" />;
    }
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'Expedited':
        return 'success';
      case 'Standard':
        return 'primary';
      case 'Bulk':
        return 'secondary';
      default:
        return 'primary';
    }
  };

  const formatTime = (hours) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${hours} hours`;
    } else {
      return `${Math.round(hours / 24)} days`;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreFromTrash color="primary" />
          <Typography variant="h6" component="span">
            Restore File
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {file && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              <strong>File:</strong> {file.original_filename}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Size:</strong> {(file.file_size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> Restoring from Glacier takes time. Choose your preferred restore tier:
          </Typography>
        </Alert>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Restore Tier</InputLabel>
          <Select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            label="Restore Tier"
          >
            {restoreTiers.map((tier) => (
              <MenuItem key={tier.tier} value={tier.tier}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  {getTierIcon(tier.tier)}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1">
                      {tier.tier}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tier.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={formatTime(tier.estimated_hours)}
                    color={getTierColor(tier.tier)}
                    size="small"
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedTier && (
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Selected Tier:</strong> {selectedTier}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Estimated Time:</strong> {formatTime(restoreTiers.find(t => t.tier === selectedTier)?.estimated_hours || 4)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Description:</strong> {restoreTiers.find(t => t.tier === selectedTier)?.description}
            </Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              Initiating restore...
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleRestore}
          variant="contained"
          startIcon={<RestoreFromTrash />}
          disabled={loading || !selectedTier}
        >
          {loading ? 'Initiating...' : 'Start Restore'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RestoreDialog;
