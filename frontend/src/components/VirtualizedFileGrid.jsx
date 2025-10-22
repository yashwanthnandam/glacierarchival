import React, { memo, useMemo } from 'react';
import { FixedSizeGrid } from 'react-window/dist/index.cjs';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Tooltip,
  LinearProgress,
  Stack,
  Checkbox,
  Fade,
  alpha,
} from '@mui/material';
import {
  FolderOpen,
  InsertDriveFile,
  Lock,
} from '@mui/icons-material';
import { getFileStateConfig as getCentralizedFileStateConfig } from '../utils/fileStateConfig';
import { keyframes } from '@mui/system';

// Glow animation for transitional states
const glow = keyframes`
  0%, 100% { box-shadow: 0 0 10px rgba(167, 139, 250, 0.2); }
  50% { box-shadow: 0 0 20px rgba(167, 139, 250, 0.4); }
`;

// Memoized Cell component for better performance
const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
  const {
    items,
    columnsPerRow,
    selectedFolders,
    selectedFiles,
    toggleFolderSelection,
    toggleFileSelection,
    onFolderClick,
    onFileClick,
    handleFolderToggle,
    formatFileSize,
    getFolderStatus,
  } = data;

  const index = rowIndex * columnsPerRow + columnIndex;
  if (index >= items.length) return null;

  const item = items[index];
  const isFolder = item.type === 'folder';
  const isSelected = isFolder ? selectedFolders.has(item.path) : selectedFiles.has(item.id);

  if (isFolder) {
    const folderStatus = getFolderStatus(item.path);
    
    return (
      <div style={{ ...style, padding: 8 }}>
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
              ...(isSelected && {
                borderColor: '#60a5fa',
                bgcolor: alpha('#60a5fa', 0.1),
              }),
            }}
            onClick={(e) => {
              if (e.target.type === 'checkbox') return;
              onFolderClick(item.path);
              handleFolderToggle(item.path);
            }}
          >
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
                checked={isSelected}
                onChange={() => toggleFolderSelection(item.path)}
                size="small"
                sx={{
                  color: '#60a5fa',
                  '&.Mui-checked': { color: '#60a5fa' },
                }}
              />
            </Box>
            <CardContent sx={{ px: 1.5, py: 1.5 }}>
              <Stack spacing={1.5}>
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
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    {item.fileCount} files • {formatFileSize(item.size)}
                  </Typography>
                </Box>
                {folderStatus && (
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
                )}
              </Stack>
            </CardContent>
          </Card>
        </Fade>
      </div>
    );
  }

  // File rendering
  const file = item;
  const stateConfig = getCentralizedFileStateConfig(file.status);
  const isTransitional = ['archiving', 'restoring'].includes(file.status);

  return (
    <div style={{ ...style, padding: 8 }}>
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
            ...(isSelected && {
              borderColor: stateConfig.color,
              bgcolor: alpha(stateConfig.color, 0.1),
            }),
          }}
          onClick={(e) => {
            if (e.target.type === 'checkbox') return;
            onFileClick(file);
          }}
        >
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
              checked={isSelected}
              onChange={() => toggleFileSelection(file.id)}
              size="small"
              sx={{
                color: stateConfig.color,
                '&.Mui-checked': { color: stateConfig.color },
              }}
            />
          </Box>
          <CardContent>
            <Stack spacing={1.5}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 80,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${alpha(stateConfig.color, 0.1)} 0%, ${alpha(stateConfig.color, 0.05)} 100%)`,
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
              <Stack spacing={0}>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                  {formatFileSize(file.file_size)}
                </Typography>
              </Stack>
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
    </div>
  );
});

Cell.displayName = 'VirtualizedCell';

// Main virtualized grid component
const VirtualizedFileGrid = memo(({
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
  // Combine folders and files into single array
  const allItems = useMemo(() => {
    const folders = currentFolderSubfolders.map(folder => ({
      ...folder,
      type: 'folder',
    }));
    const files = filteredFiles.map(file => ({
      ...file,
      type: 'file',
    }));
    return [...folders, ...files];
  }, [currentFolderSubfolders, filteredFiles]);

  // Calculate grid dimensions based on screen size
  const getGridDimensions = (width) => {
    if (width < 600) return { columns: 2, itemWidth: 180 }; // xs
    if (width < 900) return { columns: 3, itemWidth: 200 }; // sm
    if (width < 1200) return { columns: 4, itemWidth: 220 }; // md
    if (width < 1536) return { columns: 5, itemWidth: 240 }; // lg
    return { columns: 6, itemWidth: 240 }; // xl
  };

  if (allItems.length === 0) return null;

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      <AutoSizer>
        {({ height, width }) => {
          const { columns, itemWidth } = getGridDimensions(width);
          const rowCount = Math.ceil(allItems.length / columns);
          const itemHeight = 280; // Height of each card

          return (
            <FixedSizeGrid
              columnCount={columns}
              columnWidth={itemWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={itemHeight}
              width={width}
              itemData={{
                items: allItems,
                columnsPerRow: columns,
                selectedFolders,
                selectedFiles,
                toggleFolderSelection,
                toggleFileSelection,
                onFolderClick,
                onFileClick,
                handleFolderToggle,
                formatFileSize,
                getFolderStatus,
              }}
            >
              {Cell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </Box>
  );
});

VirtualizedFileGrid.displayName = 'VirtualizedFileGrid';

export default VirtualizedFileGrid;

