import React, { memo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  IconButton,
  Slide,
  Stack,
  LinearProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  InsertDriveFile,
  CloudDownload,
  Bedtime,
  WbSunny,
  Share,
  Delete,
  ChevronRight,
  CloudUpload,
} from '@mui/icons-material';
import { getFileStateConfig as getCentralizedFileStateConfig } from '../utils/fileStateConfig';

const FileDetailsPanel = memo(({
  selectedFile,
  onClose,
  formatFileSize,
  formatDate,
  handleDownload,
  handleArchive,
  handleRestore,
  handleDelete,
  loadFiles,
  uploadManagerState,
}) => {
  const theme = useTheme();

  if (!selectedFile) return null;

  return (
    <Slide direction="left" in={!!selectedFile} mountOnEnter unmountOnExit>
      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', lg: 320 },
          height: { xs: 'auto', lg: '100%' },
          maxHeight: { xs: '400px', lg: 'none' },
          borderRadius: 0,
          borderLeft: { xs: 'none', lg: `1px solid ${alpha(theme.palette.divider, 0.1)}` },
          borderTop: { xs: `1px solid ${alpha(theme.palette.divider, 0.1)}`, lg: 'none' },
          background: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          p: 3,
          gap: 2,
          flexShrink: 0,
          overflow: 'auto',
        }}
      >
        {/* Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            File Details
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <ChevronRight />
          </IconButton>
        </Box>

        {/* File Preview */}
        <Box
          sx={{
            height: 150,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha('#60a5fa', 0.1)} 0%, ${alpha(
              '#a78bfa',
              0.1
            )} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <InsertDriveFile sx={{ fontSize: 64, color: '#60a5fa' }} />
        </Box>

        {/* File Name */}
        <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
          {selectedFile.original_filename}
        </Typography>

        <Divider />

        {/* File Properties */}
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Size
            </Typography>
            <Typography variant="body2">{formatFileSize(selectedFile.file_size)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Uploaded
            </Typography>
            <Typography variant="body2">{formatDate(selectedFile.uploaded_at)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Chip
              icon={getCentralizedFileStateConfig(selectedFile.status).icon}
              label={getCentralizedFileStateConfig(selectedFile.status).label}
              size="small"
              sx={{
                mt: 0.5,
                bgcolor: alpha(getCentralizedFileStateConfig(selectedFile.status).color, 0.1),
                color: getCentralizedFileStateConfig(selectedFile.status).color,
                fontWeight: 600,
              }}
            />
          </Box>
          {selectedFile.glacier_archive_id && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Archive ID
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  fontFamily: 'monospace',
                  bgcolor: alpha('#f1f5f9', 0.5),
                  p: 1,
                  borderRadius: 1,
                  wordBreak: 'break-all',
                }}
              >
                {selectedFile.glacier_archive_id}
              </Typography>
            </Box>
          )}
        </Stack>

        {/* File Upload Status (if folder containing this file is uploading) */}
        {(() => {
          const items = uploadManagerState.items || [];
          const folderPath = selectedFile?.relative_path || '';
          if (!folderPath) return null;
          // Filter only upload operations to prevent jumping totals
          const uploadItems = items.filter(i => i.operationType === 'upload' || !i.operationType);
          const related = uploadItems.filter(i => {
            const rp = i.relativePath || '';
            return rp === folderPath || rp.startsWith(folderPath + '/') || rp.startsWith(folderPath);
          });
          const total = related.length;
          const completed = related.filter(i => i.status === 'completed').length;
          const inProgress = related.filter(i => i.status === 'uploading').length;
          const queued = related.filter(i => i.status === 'queued').length;
          const hasActivity = total > 0 && (inProgress > 0 || queued > 0);
          const avgProgress = total > 0 ? Math.round(related.reduce((s, i) => s + (i.progress || 0), 0) / total) : 0;
          const pct = total > 0 ? Math.max(avgProgress, Math.round((completed / total) * 100)) : 0;
          const starting = inProgress === 0 && queued > 0;
          if (!hasActivity && pct === 0) return null;
          return (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Upload Status
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                <CloudUpload sx={{ color: '#60a5fa' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {starting ? 'Starting uploads…' : `Uploading ${Math.max(Math.floor((total - completed) / 100) * 100, 0)} of ${total} files`}
                </Typography>
              </Stack>
              {starting ? (
                <LinearProgress variant="indeterminate" sx={{ mt: 1, height: 8, borderRadius: 4 }} />
              ) : (
                <>
                  <LinearProgress variant="determinate" value={pct} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {pct}% complete • {inProgress} in progress • {queued} queued • {completed} completed
                  </Typography>
                </>
              )}
            </Box>
          );
        })()}

        <Divider />

        {/* Actions */}
        <Stack spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CloudDownload />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
            onClick={() => handleDownload(selectedFile)}
          >
            Download
          </Button>
          {selectedFile.status === 'uploaded' && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Bedtime />}
              onClick={async () => {
                try {
                  await handleArchive(selectedFile);
                  loadFiles(true); // Refresh the file list with cache busting
                } catch (error) {
                  console.error('Hibernate failed:', error);
                }
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#a78bfa',
                borderColor: '#a78bfa',
              }}
            >
              Hibernate
            </Button>
          )}
          {selectedFile.status === 'archived' && (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<WbSunny />}
              onClick={async () => {
                try {
                  await handleRestore(selectedFile);
                  await loadFiles(true);
                } catch (error) {
                  console.error('Wake failed:', error);
                }
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: '#fbbf24',
                borderColor: '#fbbf24',
              }}
            >
              Wake Up
            </Button>
          )}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Share />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Share
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={async () => {
              try {
                await handleDelete(selectedFile);
                onClose();
                loadFiles(true); // Refresh the file list with cache busting
              } catch (error) {
                console.error('Delete failed:', error);
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Delete
          </Button>
        </Stack>
      </Paper>
    </Slide>
  );
});

FileDetailsPanel.displayName = 'FileDetailsPanel';

export default FileDetailsPanel;

