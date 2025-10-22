import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Lock,
  LockOpen,
} from '@mui/icons-material';

const FileStatusSummary = ({ filteredFiles, encryptionEnabled }) => {
  const theme = useTheme();

  if (filteredFiles.length === 0) return null;

  return (
    <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          📊 File Status Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<Lock />}
            label="E2E Encryption Enabled"
            size="small"
            color="success"
            variant="outlined"
          />
        </Box>
        {(() => {
          const statusCounts = filteredFiles.reduce((acc, file) => {
            acc[file.status] = (acc[file.status] || 0) + 1;
            return acc;
          }, {});
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`Hibernated: ${statusCounts.archived || 0}`}
                size="small"
                sx={{ bgcolor: alpha('#94a3b8', 0.15), color: '#475569', fontWeight: 600 }}
              />
              <Chip
                label={`Hibernating: ${statusCounts.archiving || 0}`}
                size="small"
                sx={{ bgcolor: alpha('#a78bfa', 0.15), color: '#6b21a8', fontWeight: 600 }}
              />
              <Chip
                label={`Awake Mode: ${((statusCounts.uploaded || 0) + (statusCounts.restored || 0))}`}
                size="small"
                sx={{ bgcolor: alpha('#60a5fa', 0.15), color: '#0c4a6e', fontWeight: 600 }}
              />
            </Stack>
          );
        })()}
      </Box>
    </Paper>
  );
};

export default FileStatusSummary;

