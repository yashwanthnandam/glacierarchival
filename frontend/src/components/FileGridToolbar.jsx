import React, { memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Tooltip,
  Stack,
  Checkbox,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Home,
  NavigateNext,
  Info,
  CloudUpload,
  CreateNewFolder,
  Refresh,
  CloudDownload,
  Bedtime,
  WbSunny,
  Delete,
} from '@mui/icons-material';

const FileGridToolbar = memo(({
  currentFolder,
  onFolderSelect,
  showFolderDetails,
  setShowFolderDetails,
  searchQuery,
  setSearchQuery,
  setShowUploadArea,
  hasUploadOperations,
  onCreateFolder,
  getSelectedCount,
  filteredFiles,
  currentFolderSubfolders,
  selectAll,
  clearSelection,
  onRefresh,
  handleBulkDownload,
  handleBulkHibernate,
  handleBulkWakeUp,
  handleBulkDelete,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: alpha('#ffffff', 0.5),
      }}
    >
      {/* Breadcrumb + Actions */}
      <Box sx={{ px: 0, pt: 1.5, pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'nowrap', gap: 1, overflowX: 'auto' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
            <Home
              fontSize="small"
              sx={{ color: 'text.secondary', cursor: 'pointer' }}
              onClick={() => {
                onFolderSelect('root');
              }}
            />
            {currentFolder !== 'root' &&
              currentFolder.split('/').filter((p) => p !== 'root').map((part, index, arr) => {
                const pathToHere = arr.slice(0, index + 1).join('/');
                return (
                  <React.Fragment key={pathToHere}>
                    <NavigateNext fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography
                      variant="body2"
                      sx={{ 
                        color: index === arr.length - 1 ? 'primary.main' : 'text.secondary',
                        fontWeight: index === arr.length - 1 ? 600 : 400,
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                        whiteSpace: 'nowrap'
                      }}
                      onClick={() => {
                        onFolderSelect(pathToHere);
                      }}
                    >
                      {part}
                    </Typography>
                  </React.Fragment>
                );
              })}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
            {currentFolder !== 'root' && (
              <Tooltip title="Folder Details">
                <IconButton size="small" onClick={() => setShowFolderDetails(true)}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* In-panel Search */}
            <TextField
              size="small"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: { xs: 160, md: 240 } }}
            />
            {/* Upload */}
            <Tooltip title="Upload Files">
              <Button
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => setShowUploadArea(true)}
                disabled={hasUploadOperations}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Upload
              </Button>
            </Tooltip>
            {/* New Folder */}
            <Tooltip title="Create Folder">
              <Button
                size="small"
                startIcon={<CreateNewFolder />}
                onClick={onCreateFolder}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                New Folder
              </Button>
            </Tooltip>
            {/* Select All */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              <Checkbox
                checked={getSelectedCount() > 0 && getSelectedCount() === (filteredFiles.length + currentFolderSubfolders.length)}
                indeterminate={getSelectedCount() > 0 && getSelectedCount() < (filteredFiles.length + currentFolderSubfolders.length)}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAll();
                  } else {
                    clearSelection();
                  }
                }}
                size="small"
                sx={{
                  color: 'primary.main',
                  '&.Mui-checked': { color: 'primary.main' },
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', ml: 0.5 }}>
                Select All
              </Typography>
            </Box>
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} size="small" sx={{ flex: '0 0 auto' }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>

            {getSelectedCount() > 0 && (
              <>
                <Tooltip title={`Download ${getSelectedCount()} items`}>
                  <IconButton
                    onClick={handleBulkDownload}
                    size="small"
                    sx={{
                      bgcolor: alpha('#3b82f6', 0.1),
                      '&:hover': { bgcolor: alpha('#3b82f6', 0.2) },
                    }}
                  >
                    <CloudDownload sx={{ color: '#3b82f6' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Hibernate ${getSelectedCount()} items`}>
                  <IconButton
                    onClick={handleBulkHibernate}
                    size="small"
                    sx={{
                      bgcolor: alpha('#a78bfa', 0.1),
                      '&:hover': { bgcolor: alpha('#a78bfa', 0.2) },
                    }}
                  >
                    <Bedtime sx={{ color: '#a78bfa' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Wake up ${getSelectedCount()} items`}>
                  <IconButton
                    onClick={handleBulkWakeUp}
                    size="small"
                    sx={{
                      bgcolor: alpha('#fbbf24', 0.1),
                      '&:hover': { bgcolor: alpha('#fbbf24', 0.2) },
                    }}
                  >
                    <WbSunny sx={{ color: '#fbbf24' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Delete ${getSelectedCount()} items`}>
                  <IconButton
                    onClick={handleBulkDelete}
                    size="small"
                    sx={{
                      bgcolor: alpha('#ef4444', 0.1),
                      '&:hover': { bgcolor: alpha('#ef4444', 0.2) },
                    }}
                  >
                    <Delete sx={{ color: '#ef4444' }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
});

FileGridToolbar.displayName = 'FileGridToolbar';

export default FileGridToolbar;

