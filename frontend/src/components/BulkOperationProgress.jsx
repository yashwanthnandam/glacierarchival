import React, { memo } from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Stack,
  Fade,
  alpha,
} from '@mui/material';
import {
  Delete,
  CheckCircle,
  Error,
  Bedtime,
  WbSunny,
} from '@mui/icons-material';

const BulkOperationProgress = memo(({ 
  uploadManagerState, 
  bulkOperationStatus,
  bulkOperationType,
}) => {
  // Delete Progress
  const deleteOps = uploadManagerState.deleteOperations || [];
  const activeDeleteOp = deleteOps.find(op => op && op.status === 'deleting');
  
  if (activeDeleteOp) {
    const total = activeDeleteOp.totalFiles || 0;
    const completed = activeDeleteOp.completedFiles || 0;
    const hasActivity = total > 0;
    
    if (hasActivity) {
      const overall = total > 0 ? Math.round((completed / total) * 100) : 0;
      const remaining = total - completed;
      
      return (
        <Fade in={true} timeout={150}>
          <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
            <Paper sx={{ 
              p: 2, 
              border: `1px solid ${alpha('#f59e0b', 0.2)}`,
              background: `linear-gradient(135deg, ${alpha('#f59e0b', 0.05)} 0%, ${alpha('#f59e0b', 0.02)} 100%)`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease'
            }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ 
                  p: 1, 
                  borderRadius: '50%', 
                  bgcolor: alpha('#f59e0b', 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Delete sx={{ color: '#f59e0b', fontSize: 20 }} />
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#f59e0b' }}>
                    🗑️ Deleting {remaining} of {total} files
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {completed} completed • {remaining} remaining
                  </Typography>
                </Box>
                
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600,
                    color: '#f59e0b',
                    bgcolor: alpha('#f59e0b', 0.1),
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1
                  }}
                >
                  {overall}%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={overall} 
                sx={{ 
                  mt: 1.5, 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: alpha('#f59e0b', 0.1),
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#f59e0b',
                    borderRadius: 4
                  }
                }} 
              />
            </Paper>
          </Box>
        </Fade>
      );
    }
  }

  // Completion/Error Status
  if (bulkOperationStatus === 'completed') {
    let message = 'Operation completed successfully!';
    let IconComp = CheckCircle;
    let color = '#374151';
    let bg = '#f3f4f6';
    let border = '#6b7280';

    if (bulkOperationType === 'delete') {
      message = 'Deletion Completed Successfully!';
      IconComp = CheckCircle;
      color = '#374151';
      bg = '#f3f4f6';
      border = '#6b7280';
    } else if (bulkOperationType === 'hibernate') {
      message = 'Hibernation Completed Successfully!';
      IconComp = Bedtime;
      color = '#6d28d9';
      bg = '#f5f3ff';
      border = '#a78bfa';
    } else if (bulkOperationType === 'restore') {
      message = 'Restore Initiated Successfully!';
      IconComp = WbSunny;
      color = '#b45309';
      bg = '#fffbeb';
      border = '#f59e0b';
    }

    return (
      <Box sx={{ px: { xs: 2, md: 3 }, mb: 4 }}>
        <Paper sx={{ p: 2.5, bgcolor: alpha(bg, 0.6), border: '1px solid', borderColor: border }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconComp sx={{ color }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color }}>
              {message}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (bulkOperationStatus === 'error') {
    let message = 'Operation failed';
    let IconComp = Error;
    let color = '#991b1b';
    let bg = '#fee2e2';
    let border = '#ef4444';

    if (bulkOperationType === 'delete') {
      message = 'Some files failed to delete';
    } else if (bulkOperationType === 'hibernate') {
      message = 'Hibernation failed - Active hibernation plan required';
    } else if (bulkOperationType === 'restore') {
      message = 'Restore failed';
    }

    return (
      <Box sx={{ px: { xs: 2, md: 3 }, mb: 4 }}>
        <Paper sx={{ p: 2.5, bgcolor: alpha(bg, 0.3), border: '1px solid', borderColor: border }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconComp sx={{ color }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color }}>
              {message}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (bulkOperationStatus === 'partial') {
    let message = 'Operation completed with some failures';
    let IconComp = Error;
    let color = '#b45309';
    let bg = '#fffbeb';
    let border = '#f59e0b';

    if (bulkOperationType === 'hibernate') {
      message = 'Hibernation completed with some failures - Check hibernation plan';
    }

    return (
      <Box sx={{ px: { xs: 2, md: 3 }, mb: 4 }}>
        <Paper sx={{ p: 2.5, bgcolor: alpha(bg, 0.3), border: '1px solid', borderColor: border }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconComp sx={{ color }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color }}>
              {message}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return null;
});

BulkOperationProgress.displayName = 'BulkOperationProgress';

export default BulkOperationProgress;

