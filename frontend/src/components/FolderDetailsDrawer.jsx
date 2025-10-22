import React, { memo } from 'react';
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  Divider,
  alpha,
} from '@mui/material';
import {
  FolderOpen,
  ChevronRight,
} from '@mui/icons-material';

const FolderDetailsDrawer = memo(({ 
  open, 
  onClose, 
  currentFolder 
}) => {
  if (currentFolder === 'root') return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Box sx={{ width: { xs: 320, sm: 360 }, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Folder Details
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <ChevronRight />
          </IconButton>
        </Box>
        <Box sx={{
          height: 120,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha('#60a5fa', 0.1)} 0%, ${alpha('#a78bfa', 0.1)} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FolderOpen sx={{ fontSize: 64, color: '#60a5fa' }} />
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
          {currentFolder}
        </Typography>
        <Divider />
      </Box>
    </Drawer>
  );
});

FolderDetailsDrawer.displayName = 'FolderDetailsDrawer';

export default FolderDetailsDrawer;

