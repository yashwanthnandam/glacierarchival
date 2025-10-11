import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Alert,
  LinearProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  RestoreFromTrash,
  Schedule,
  Speed,
  Money,
  Info,
  Warning
} from '@mui/icons-material';
import { RESTORE_TIERS } from '../constants/fileStates';

const ThematicRestoreDialog = ({ open, onClose, onConfirm, file, loading = false }) => {
  const [selectedTier, setSelectedTier] = useState('Standard');

  const handleConfirm = () => {
    onConfirm(selectedTier);
  };

  const getTierInfo = (tierKey) => {
    return RESTORE_TIERS[tierKey.toUpperCase()];
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'EXPEDITED': return '#4caf50';
      case 'STANDARD': return '#2196f3';
      case 'BULK': return '#ff9800';
      default: return '#757575';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreFromTrash color="primary" />
          <Typography variant="h6">
            Wake Up Your File
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{file?.original_filename}</strong> is currently hibernating ❄️
            <br />
            Choose how quickly you want to wake it up:
          </Typography>
        </Alert>

        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
          >
            {Object.entries(RESTORE_TIERS).map(([key, tier]) => (
              <Card 
                key={key} 
                sx={{ 
                  mb: 2, 
                  border: selectedTier === tier.technical ? 2 : 1,
                  borderColor: selectedTier === tier.technical ? getTierColor(key) : 'divider'
                }}
              >
                <CardContent>
                  <FormControlLabel
                    value={tier.technical}
                    control={<Radio />}
                    label={
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6">
                            {tier.emoji} {tier.label}
                          </Typography>
                          <Chip 
                            label={tier.time} 
                            size="small" 
                            sx={{ bgcolor: getTierColor(key), color: 'white' }}
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {tier.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Money fontSize="small" />
                          <Typography variant="caption">
                            Cost: {tier.cost}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ width: '100%', alignItems: 'flex-start' }}
                  />
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        <Alert severity="warning">
          <Typography variant="body2">
            <strong>Important:</strong> Once you start waking up your file, 
            it will be available for download in {getTierInfo(selectedTier).time}.
            <br />
            You'll receive a notification when it's ready! 🔔
          </Typography>
        </Alert>

        {loading && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Waking up your file...
            </Typography>
            <LinearProgress />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          color="primary"
          disabled={loading}
          startIcon={<RestoreFromTrash />}
        >
          {loading ? 'Waking Up...' : `Wake Up (${getTierInfo(selectedTier).time})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThematicRestoreDialog;
