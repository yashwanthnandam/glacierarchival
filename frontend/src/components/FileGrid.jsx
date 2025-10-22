import React, { memo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Tooltip,
  LinearProgress,
  Grid,
  Stack,
  Checkbox,
  Fade,
  alpha,
} from '@mui/material';
import {
  FolderOpen,
  InsertDriveFile,
  AcUnit,
  Schedule,
  WbSunny,
  Lock,
} from '@mui/icons-material';
import { getFileStateConfig as getCentralizedFileStateConfig } from '../utils/fileStateConfig';
import { keyframes } from '@mui/system';

// Glow animation for transitional states
const glow = keyframes`
  0%, 100% { box-shadow: 0 0 10px rgba(167, 139, 250, 0.2); }
  50% { box-shadow: 0 0 20px rgba(167, 139, 250, 0.4); }
`;

const FileGrid = memo(({
  currentFolderSubfolders,
  filteredFiles,
  selectedFolders,
  selectedFiles,
  toggleFolderSelection,
  toggleFileSelection,
  onFolderClick,
  onFileClick,
  handleFolderToggle,
  formatFileSize,
  getFolderStatus,
}) => {
  return (
    <Grid container spacing={2}>
      {/* Render subfolders first */}
      {currentFolderSubfolders.map((folder) => (
        <Grid item xs={12} sm={6} md={3} lg={2} xl={2} key={`folder-${folder.path}`}>
          <Fade in timeout={300}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: 'background.paper',
                border: `1px solid ${alpha('#60a5fa', 0.2)}`,
                position: 'relative',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 24px ${alpha('#60a5fa', 0.2)}`,
                  borderColor: '#60a5fa',
                },
                ...(selectedFolders.has(folder.path) && {
                  borderColor: '#60a5fa',
                  bgcolor: alpha('#60a5fa', 0.1),
                }),
              }}
              onClick={(e) => {
                // Don't navigate if clicking on checkbox
                if (e.target.type === 'checkbox') return;
                
                onFolderClick(folder.path);
                handleFolderToggle(folder.path);
              }}
            >
              {/* Selection Checkbox */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedFolders.has(folder.path)}
                  onChange={() => toggleFolderSelection(folder.path)}
                  size="small"
                  sx={{
                    color: '#60a5fa',
                    '&.Mui-checked': {
                      color: '#60a5fa',
                    },
                  }}
                />
              </Box>
              <CardContent sx={{ px: 1.5, py: 1.5 }}>
                <Stack spacing={1.5}>
                  {/* Folder Icon */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 80,
                      borderRadius: 2,
                      background: `linear-gradient(135deg, ${alpha('#60a5fa', 0.1)}, ${alpha('#a78bfa', 0.1)})`,
                    }}
                  >
                    <FolderOpen sx={{ fontSize: 48, color: '#60a5fa' }} />
                  </Box>
                  
                  {/* Folder Info */}
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        mb: 0.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {folder.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                      {folder.fileCount} files • {formatFileSize(folder.size)}
                    </Typography>
                  </Box>

                  {/* Folder Status Indicator */}
                  {(() => {
                    const folderStatus = getFolderStatus(folder.path);
                    if (!folderStatus) return null;
                    
                    return (
                      <Chip
                        icon={folderStatus.icon}
                        label={folderStatus.label}
                        size="small"
                        sx={{
                          bgcolor: alpha(folderStatus.color, 0.1),
                          color: folderStatus.color,
                          fontWeight: 600,
                          borderRadius: 1.5,
                          border: `1px solid ${alpha(folderStatus.color, 0.3)}`,
                          fontSize: '0.75rem',
                          height: 24,
                        }}
                      />
                    );
                  })()}
                </Stack>
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      ))}
      
      {/* Then render files */}
      {filteredFiles.map((file) => {
        const stateConfig = getCentralizedFileStateConfig(file.status);
        const isTransitional = ['archiving', 'restoring'].includes(file.status);

        return (
          <Grid item xs={12} sm={6} md={3} lg={2} xl={2} key={file.id}>
            <Fade in timeout={300}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  background: 'background.paper',
                  border: `1px solid ${alpha(stateConfig.color, 0.2)}`,
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${alpha(stateConfig.color, 0.2)}`,
                    borderColor: stateConfig.color,
                  },
                  ...(stateConfig.glow && {
                    animation: `${glow} 2s infinite`,
                    boxShadow: `0 0 20px ${alpha(stateConfig.color, 0.3)}`,
                  }),
                  ...(selectedFiles.has(file.id) && {
                    borderColor: stateConfig.color,
                    bgcolor: alpha(stateConfig.color, 0.1),
                  }),
                }}
                onClick={(e) => {
                  // Don't open file details if clicking on checkbox
                  if (e.target.type === 'checkbox') return;
                  
                  onFileClick(file);
                }}
              >
                {/* Selection Checkbox */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    size="small"
                    sx={{
                      color: stateConfig.color,
                      '&.Mui-checked': {
                        color: stateConfig.color,
                      },
                    }}
                  />
                </Box>
                <CardContent>
                  <Stack spacing={1.5}>
                    {/* File Icon with State */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 80,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(
                          stateConfig.color,
                          0.1
                        )} 0%, ${alpha(stateConfig.color, 0.05)} 100%)`,
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <InsertDriveFile
                        sx={{
                          fontSize: 48,
                          color: stateConfig.color,
                          ...(stateConfig.animation && {
                            animation: `${stateConfig.animation} 2s infinite`,
                          }),
                        }}
                      />
                      {isTransitional && (
                        <LinearProgress
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            bgcolor: alpha(stateConfig.color, 0.1),
                            '& .MuiLinearProgress-bar': {
                              bgcolor: stateConfig.color,
                            },
                          }}
                        />
                      )}
                    </Box>

                    {/* File Name */}
                    <Tooltip title={file.original_filename}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.original_filename}
                        </Typography>
                        {file.is_encrypted && (
                          <Tooltip title="Encrypted with E2E encryption">
                            <Lock sx={{ fontSize: 12, color: 'success.main' }} />
                          </Tooltip>
                        )}
                      </Box>
                    </Tooltip>

                    {/* File Info */}
                    <Stack spacing={0}>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                        {formatFileSize(file.file_size)}
                      </Typography>
                    </Stack>

                    {/* Status Chip */}
                    <Chip
                      icon={stateConfig.icon}
                      label={stateConfig.label}
                      size="small"
                      sx={{
                        bgcolor: alpha(stateConfig.color, 0.1),
                        color: stateConfig.color,
                        fontWeight: 600,
                        borderRadius: 1.5,
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        );
      })}
    </Grid>
  );
});

FileGrid.displayName = 'FileGrid';

export default FileGrid;

