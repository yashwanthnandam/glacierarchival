import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  Archive,
  TrendingDown,
  Money,
  Schedule,
  Info,
  Close
} from '@mui/icons-material';
import { 
  shouldSuggestHibernation, 
  getHibernationSuggestion,
  FILE_ACTIONS 
} from '../constants/fileStates';

const HibernationSuggestion = ({ file, onHibernate, onDismiss }) => {
  if (!shouldSuggestHibernation(file)) {
    return null;
  }

  const suggestion = getHibernationSuggestion(file);
  const daysSinceAccess = Math.floor((Date.now() - new Date(file.last_accessed).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card sx={{ mb: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Archive color="warning" />
              <Typography variant="h6">
                💤 Hibernation Suggestion
              </Typography>
              <Chip 
                label={`${daysSinceAccess} days unused`} 
                size="small" 
                color="warning"
              />
            </Box>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              {suggestion}
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Save up to 95% on storage costs!</strong>
                <br />
                Hibernating this file will move it to Deep Archive storage, 
                reducing your monthly bill significantly.
              </Typography>
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={<Archive />}
                onClick={() => onHibernate(file)}
                size="small"
              >
                {FILE_ACTIONS.HIBERNATE.label}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                onClick={() => onDismiss(file)}
              >
                Maybe Later
              </Button>
            </Box>
          </Box>
          
          <Tooltip title="Dismiss suggestion">
            <IconButton 
              size="small" 
              onClick={() => onDismiss(file)}
              sx={{ color: 'inherit' }}
            >
              <Close />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default HibernationSuggestion;
