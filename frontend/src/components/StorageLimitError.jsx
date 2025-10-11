import React from 'react';
import {
  Alert,
  Box,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Chip
} from '../utils/muiImports';
import { useNavigate } from 'react-router-dom';

const StorageLimitError = ({ error, onDismiss, onUpgrade }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('/plans');
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!error) return null;

  const isStorageLimitError = error.type === 'STORAGE_LIMIT_EXCEEDED';
  const isPlanLimitError = error.currentPlan || error.plan_required;

  return (
    <Alert 
      severity="error" 
      sx={{ 
        mb: 3,
        borderRadius: 3,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.05)',
      }}
      action={
        <Stack direction="row" spacing={1}>
          <Button 
            color="inherit" 
            size="small" 
            onClick={handleDismiss}
            sx={{
              fontWeight: 600,
              borderRadius: 2,
              px: 2,
              py: 1,
            }}
          >
            Dismiss
          </Button>
          {(isStorageLimitError || isPlanLimitError) && (
            <Button 
              variant="contained" 
              size="small" 
              onClick={handleUpgrade}
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                px: 2,
                py: 1,
                bgcolor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.dark',
                }
              }}
            >
              Upgrade Plan
            </Button>
          )}
        </Stack>
      }
    >
      <Box>
        <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
          {error.message}
        </Typography>
        
        {/* Storage Usage Details */}
        {(error.currentUsageGB || error.current_usage_gb) && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Current Usage:
              </Typography>
              <Chip 
                label={`${error.currentUsageGB || error.current_usage_gb}GB`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </Stack>
            
            {error.remainingGB !== undefined && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Remaining Space:
                </Typography>
                <Chip 
                  label={`${error.remainingGB}GB`}
                  size="small"
                  color={parseFloat(error.remainingGB) > 0 ? 'success' : 'error'}
                  variant="outlined"
                />
              </Stack>
            )}
            
            {/* Progress Bar */}
            {error.plan_limit_gb && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Storage Usage
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {error.current_usage_gb}GB / {error.plan_limit_gb}GB
                  </Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={(error.current_usage_gb / error.plan_limit_gb) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: parseFloat(error.current_usage_gb) / parseFloat(error.plan_limit_gb) > 0.8 ? 'error.main' : 'primary.main',
                    }
                  }}
                />
              </Box>
            )}
          </Box>
        )}
        
        {/* Upgrade Message */}
        {(isStorageLimitError || isPlanLimitError) && (
          <Typography variant="body2" sx={{ mt: 2, opacity: 0.8 }}>
            {error.upgrade_message || 'Upgrade to a hibernation plan to get more storage space and continue uploading.'}
          </Typography>
        )}
      </Box>
    </Alert>
  );
};

export default StorageLimitError;
