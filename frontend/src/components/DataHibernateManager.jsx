import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  Tooltip,
  LinearProgress,
  Avatar,
  Fade,
  Slide,
  Button,
  ButtonGroup,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Drawer,
  TextField,
  Card,
  CardContent,
  Grid,
  Stack,
  Checkbox,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
// Import centralized file state configuration
import { getFileStateConfig as getCentralizedFileStateConfig } from '../utils/fileStateConfig';
import {
  Folder,
  FolderOpen,
  InsertDriveFile,
  CloudUpload,
  CreateNewFolder,
  Delete,
  AcUnit,
  WbSunny,
  Bedtime,
  CloudDownload,
  Info,
  Search,
  ExpandMore,
  ChevronRight,
  Refresh,
  DragIndicator,
  CheckCircle,
  Schedule,
  Storage,
  Error,
  Settings,
  Share,
  Home,
  NavigateNext,
  Close,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { mediaAPI } from '../services/api';
import { useFileActions } from '../hooks/useFileActions';
import DirectoryUploader from './DirectoryUploader';
import DownloadProgressDialog from './DownloadProgressDialog';

// Enhanced Upload Progress Bar Component with Better UX
const UploadProgressBar = memo(({ uploadManagerState }) => {
  const state = uploadManagerState;
  if (!state) return null;
  
  // Use upload-only counters to avoid denominator jumping when other operations run
  const total = state.uploadTotal ?? state.total ?? 0;
  const completed = state.uploadCompleted ?? state.completed ?? 0;
  const active = state.uploadInProgress ?? state.inProgress ?? 0;
  const queued = state.uploadQueued ?? state.queued ?? 0;
  const failed = state.uploadFailed ?? state.failed ?? 0;
  
  // Count cancelled uploads from items
  const cancelled = state.items ? state.items.filter(item => 
    item.operationType === 'upload' && item.status === 'cancelled'
  ).length : 0;
  
  // Simplified logic - show if there are any items and it's not only delete operations
  const hasItems = state.items && state.items.length > 0;
  const hasOnlyDeleteOperations = hasItems && state.items.every(item => 
    item.operationType === 'delete'
  );
  
  // Show if there are items and it's not only delete operations
  if (!hasItems || hasOnlyDeleteOperations || total === 0) return null;
  
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;
  
  // State declarations moved up to prevent hoisting issues
  const [showCompleted, setShowCompleted] = useState(true);
  const [lastCompletedStatus, setLastCompletedStatus] = useState(null);
  const [debouncedStatus, setDebouncedStatus] = useState('uploading');
  const [debouncedStatusText, setDebouncedStatusText] = useState('');
  const [lastActiveTime, setLastActiveTime] = useState(Date.now());
  
  // Enhanced status determination with better UX - Optimized to prevent flickering
  let status = 'uploading';
  let statusText = '';
  let statusColor = '#60a5fa';
  let progressColor = '#60a5fa';
  
  if (active === 0 && queued === 0 && completed > 0) {
    status = 'completed';
    // Use green for success, orange only for failures to reduce flickering
    statusColor = failed > 0 ? '#f59e0b' : '#6b7280';
    progressColor = failed > 0 ? '#f59e0b' : '#6b7280';
    
    if (cancelled > 0) {
      statusText = `⏹️ Upload cancelled! ${completed} files uploaded, ${cancelled} cancelled`;
      statusColor = '#6b7280';
      progressColor = '#6b7280';
    } else if (failed > 0) {
      statusText = `✅ Upload completed! ${completed} successful, ${failed} failed`;
    } else {
      statusText = `🎉 Upload completed! All ${completed} files uploaded successfully`;
    }
  } else if (active === 0 && queued > 0 && completed > 0 && queued > 50 && (Date.now() - lastActiveTime) > 2000) {
    // Only show stalled if there are significantly queued files AND no active uploads
    // AND no recent activity (2 seconds) - prevents flickering during batch transitions
    status = 'stalled';
    statusColor = '#f59e0b';
    progressColor = '#f59e0b';
    statusText = `⏸️ Upload paused: ${queued} files pending`;
  } else if (completed === 0 && queued > 0) {
    status = 'starting';
    statusText = '🚀 Preparing upload...';
  } else if (active > 0) {
    status = 'uploading';
    statusText = `📤 Uploading ${remaining} of ${total} files`;
  }
  
  // Auto-hide completed uploads after 3 seconds - Fixed to prevent flickering
  
  // Update last active time when uploads are active
  useEffect(() => {
    if (active > 0) {
      setLastActiveTime(Date.now());
    }
  }, [active]);
  
  // Debounce status changes to prevent rapid flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStatus(status);
      setDebouncedStatusText(statusText);
    }, 300); // 300ms debounce for smoother updates
    
    return () => clearTimeout(timer);
  }, [status, statusText]);
  
  useEffect(() => {
    if (debouncedStatus === 'completed') {
      // Only start timer if this is a new completion (not already completed)
      if (lastCompletedStatus !== 'completed') {
        setLastCompletedStatus('completed');
        const timer = setTimeout(() => {
          setShowCompleted(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else {
      // Reset when status changes away from completed
      if (lastCompletedStatus === 'completed') {
        setLastCompletedStatus(null);
        setShowCompleted(true);
      }
    }
  }, [debouncedStatus, lastCompletedStatus]);
  
  if (status === 'completed' && !showCompleted) return null;
  
  return (
    <Fade in={true} timeout={150}>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
        <Paper sx={{ 
          p: 2, 
          border: `1px solid ${alpha(statusColor, 0.2)}`,
          background: `linear-gradient(135deg, ${alpha(statusColor, 0.05)} 0%, ${alpha(statusColor, 0.02)} 100%)`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'all 0.15s ease'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '50%', 
              bgcolor: alpha(statusColor, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CloudUpload sx={{ color: statusColor, fontSize: 20 }} />
            </Box>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: statusColor }}>
                {debouncedStatusText || statusText}
              </Typography>
            </Box>
            
            <Stack direction="row" spacing={1} alignItems="center">
              {(status === 'uploading' || status === 'starting') && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  sx={{ minWidth: 'auto', px: 2 }}
                  onClick={async () => {
                    try {
                      await uploadManager.cancelAllUploads();
                    } catch (error) {
                      console.error('Error cancelling uploads:', error);
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
              
              {status !== 'starting' && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600,
                    color: statusColor,
                    bgcolor: alpha(statusColor, 0.1),
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1
                  }}
                >
                  {percentage}%
                </Typography>
              )}
            </Stack>
          </Stack>
          
          <LinearProgress 
            variant={status === 'starting' ? 'indeterminate' : 'determinate'}
            value={percentage} 
            sx={{ 
              mt: 1.5, 
              height: 8, 
              borderRadius: 4,
              bgcolor: alpha(statusColor, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: progressColor,
                borderRadius: 4
              }
            }} 
          />
          
          {status === 'completed' && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                This notification will disappear automatically
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Fade>
  );
});

import uploadManager from '../services/uploadManager';

// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const glow = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const snowfall = keyframes`
  0% { transform: translateY(-10px); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(10px); opacity: 0; }
`;

const wakeUp = keyframes`
  0% { filter: brightness(0.5) blur(5px); }
  100% { filter: brightness(1) blur(0px); }
`;

// File state configurations with thematic hibernation system
const getFileStateConfig = (status) => {
  const states = {
    // 🟢 Primary — Awake ☀️
    uploaded: {
      label: 'Awake ☀️',
      color: '#34d399',
      icon: <WbSunny sx={{ fontSize: 16 }} />,
      animation: null,
      glow: false,
      description: 'Your file is active and instantly accessible.',
    },
    // 🔵 Transitional (uploading) — Waking Up 🔄
    uploading: {
      label: 'Waking Up 🔄',
      color: '#60a5fa',
      icon: <Refresh sx={{ fontSize: 16 }} />,
      animation: glow,
      glow: true,
      description: 'Your file is getting ready and uploading securely.',
    },
    // 🟣 Transitional (archiving) — Falling Asleep 🌙
    archiving: {
      label: 'Falling Asleep 🌙',
      color: '#a78bfa',
      icon: <Bedtime sx={{ fontSize: 16 }} />,
      animation: glow,
      glow: true,
      description: 'Your file is going into hibernation to save cost.',
    },
    // 🔴 Archived — Hibernating ❄️
    archived: {
      label: 'Hibernating ❄️',
      color: '#94a3b8',
      icon: <AcUnit sx={{ fontSize: 16 }} />,
      animation: snowfall,
      glow: false,
      description: 'Your file is sleeping safely at low cost.',
    },
    // 🟡 Transitional (restoring) — Waking from Sleep 🌅
    restoring: {
      label: 'Waking from Sleep 🌅',
      color: '#fbbf24',
      icon: <WbSunny sx={{ fontSize: 16 }} />,
      animation: wakeUp,
      glow: true,
      description: 'Your file is waking up — this may take a few hours.',
    },
    // After restore finishes back to Awake
    restored: {
      label: 'Awake ☀️',
      color: '#34d399',
      icon: <WbSunny sx={{ fontSize: 16 }} />,
      animation: null,
      glow: false,
      description: 'Your file is active and instantly accessible.',
    },
  };
  return states[status] || states.uploaded;
};

const DataHibernateManager = ({ onFileSelect, onFolderSelect, globalSearchQuery }) => {
  const theme = useTheme();
  // Simplified state management
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('root');
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectedFolders, setSelectedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFolderDetails, setShowFolderDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadManagerState, setUploadManagerState] = useState({ total: 0, completed: 0, inProgress: 0, queued: 0 });
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState({ open: false, count: 0 });
  const [bulkOperationProgress, setBulkOperationProgress] = useState({});
  const [bulkOperationStatus, setBulkOperationStatus] = useState(null);
  const [currentBatch, setCurrentBatch] = useState({ current: 0, total: 0 });
  const [bulkOperationType, setBulkOperationType] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [overallUploadProgress, setOverallUploadProgress] = useState(0);
  const [overallUploadLabel, setOverallUploadLabel] = useState('');
  const showLeftPanel = false; // Hide sidebar for edge-to-edge layout
  
  // Check if there are active upload operations - memoized to prevent flickering
  const hasUploadOperations = useMemo(() => {
    return uploadManagerState.total > 0 && 
      (uploadManagerState.inProgress > 0 || uploadManagerState.queued > 0);
  }, [uploadManagerState.total, uploadManagerState.inProgress, uploadManagerState.queued]);

  // Memoize upload status text to prevent flickering
  const uploadStatusText = useMemo(() => {
    if (hasUploadOperations) {
      return {
        title: 'Upload in progress...',
        subtitle: 'Please wait for current upload to complete'
      };
    }
    return {
      title: activeTab === 0 ? 'No active files' : 'No hibernated files',
      subtitle: activeTab === 0 ? 'Click here or drag files to upload' : 'Hibernate some files to see them here'
    };
  }, [hasUploadOperations, activeTab]);

  // Debounced upload status text to prevent rapid flickering
  const [debouncedUploadStatusText, setDebouncedUploadStatusText] = useState(uploadStatusText);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUploadStatusText(uploadStatusText);
    }, 200); // 200ms debounce
    
    return () => clearTimeout(timer);
  }, [uploadStatusText]);
  
  // File actions (archive/delete/download); restore handled inline with Standard tier
  const { 
    handleArchive, 
    handleDelete, 
    handleDownload,
    downloadDialogOpen, 
    downloadInfo, 
    setDownloadDialogOpen,
    setDownloadInfo
  } = useFileActions(loadFiles);

  // Selection management functions
  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleFolderSelection = (folderPath) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allFileIds = new Set(filteredFiles.map(f => f.id));
    const allFolderPaths = new Set(currentFolderSubfolders.map(f => f.path));
    setSelectedFiles(allFileIds);
    setSelectedFolders(allFolderPaths);
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  };

  const getSelectedCount = () => {
    return selectedFiles.size + selectedFolders.size;
  };

  const getSelectedFiles = () => {
    return files.filter(f => selectedFiles.has(f.id));
  };

  const getSelectedFolders = () => {
    return folders.filter(f => selectedFolders.has(f.path));
  };

  // Check for hibernation conflicts
  const checkHibernationConflicts = (selectedFilesList, selectedFoldersList) => {
    const conflicts = [];
    
    // Check if any selected folder contains files that are already hibernating
    for (const folder of selectedFoldersList) {
      const folderFiles = files.filter(f => f.relative_path?.startsWith(folder.path));
      const hibernatingFiles = folderFiles.filter(f => f.status === 'archiving');
      
      if (hibernatingFiles.length > 0) {
        conflicts.push({
          type: 'folder_has_hibernating_files',
          folder: folder.name,
          hibernatingCount: hibernatingFiles.length,
          hibernatingFiles: hibernatingFiles.map(f => f.original_filename)
        });
      }
    }
    
    // Check if any selected files are already hibernating
    const hibernatingSelectedFiles = selectedFilesList.filter(f => f.status === 'archiving');
    if (hibernatingSelectedFiles.length > 0) {
      conflicts.push({
        type: 'files_already_hibernating',
        hibernatingFiles: hibernatingSelectedFiles.map(f => f.original_filename)
      });
    }
    
    return conflicts;
  };

  // Calculate folder status based on file states
  const getFolderStatus = (folderPath) => {
    const folderFiles = files.filter(f => f.relative_path?.startsWith(folderPath));
    
    if (folderFiles.length === 0) return null;
    
    const statusCounts = folderFiles.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1;
      return acc;
    }, {});
    
    const totalFiles = folderFiles.length;
    const hibernatedCount = statusCounts.archived || 0;
    const hibernatingCount = statusCounts.archiving || 0;
    const restoringCount = statusCounts.restoring || 0;
    const activeCount = (statusCounts.uploaded || 0) + (statusCounts.restored || 0);
    
    // Show status only if significant portion is hibernated/hibernating
    const hibernationRatio = (hibernatedCount + hibernatingCount) / totalFiles;
    
    // Priority: if any are restoring, show waking status at folder level
    if (restoringCount > 0) {
      return {
        type: 'restoring',
        count: restoringCount,
        total: totalFiles,
        icon: <WbSunny sx={{ fontSize: 14 }} />,
        color: '#fbbf24',
        label: `${restoringCount} waking`
      };
    }
    
    if (hibernationRatio >= 0.5) {
      // Majority hibernated - show hibernated status
      return {
        type: 'hibernated',
        count: hibernatedCount,
        total: totalFiles,
        icon: <AcUnit sx={{ fontSize: 14 }} />,
        color: '#94a3b8',
        label: `${hibernatedCount}/${totalFiles} hibernated`
      };
    } else if (hibernatingCount > 0) {
      // Some hibernating - show hibernating status
      return {
        type: 'hibernating',
        count: hibernatingCount,
        total: totalFiles,
        icon: <Schedule sx={{ fontSize: 14 }} />,
        color: '#a78bfa',
        label: `${hibernatingCount} hibernating`
      };
    } else if (hibernationRatio > 0) {
      // Some hibernated but not majority - show mixed status
      return {
        type: 'mixed',
        count: hibernatedCount,
        total: totalFiles,
        icon: <AcUnit sx={{ fontSize: 14 }} />,
        color: '#64748b',
        label: `${hibernatedCount}/${totalFiles} hibernated`
      };
    }
    
    return null; // No status indicator needed
  };

  // Bulk action functions
  const handleBulkHibernate = async () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    

    // Check for conflicts before starting
    const conflicts = checkHibernationConflicts(selectedFilesList, selectedFoldersList);
    if (conflicts.length > 0) {
      let conflictMessage = '❄️ Cannot hibernate due to conflicts:\n\n';
      
      conflicts.forEach(conflict => {
        if (conflict.type === 'folder_has_hibernating_files') {
          conflictMessage += `• Folder "${conflict.folder}" has ${conflict.hibernatingCount} files already hibernating\n`;
          conflictMessage += `  Files: ${conflict.hibernatingFiles.slice(0, 3).join(', ')}${conflict.hibernatingFiles.length > 3 ? '...' : ''}\n\n`;
        } else if (conflict.type === 'files_already_hibernating') {
          conflictMessage += `• ${conflict.hibernatingFiles.length} selected files are already hibernating\n`;
          conflictMessage += `  Files: ${conflict.hibernatingFiles.slice(0, 3).join(', ')}${conflict.hibernatingFiles.length > 3 ? '...' : ''}\n\n`;
        }
      });
      
      conflictMessage += 'Please wait for current hibernation to complete or select different files/folders.';
      alert(conflictMessage);
      return;
    }

    // Collect all files to be hibernated
    const allFilesToHibernate = [...selectedFilesList];
    for (const folder of selectedFoldersList) {
      const folderFiles = files.filter(f => f.relative_path?.startsWith(folder.path));
      allFilesToHibernate.push(...folderFiles);
    }

    // Filter only files that can be hibernated
    const hibernatableFiles = allFilesToHibernate.filter(f => 
      f.status === 'uploaded' || f.status === 'restored'
    );

    if (hibernatableFiles.length === 0) {
      alert('No files available for hibernation. Files must be in "uploaded" or "restored" state.');
      return;
    }

    // Start progress tracking
    setBulkOperationType('hibernate');
    setBulkOperationStatus('in_progress');
    setBulkOperationProgress({});

    // Initialize progress for all files
    hibernatableFiles.forEach(file => {
      setBulkOperationProgress(prev => ({
        ...prev,
        [file.id]: { status: 'pending', progress: 0 }
      }));
    });

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process files in batches to avoid overwhelming the server
      const BATCH_SIZE = 10;
      const batches = [];
      for (let i = 0; i < hibernatableFiles.length; i += BATCH_SIZE) {
        batches.push(hibernatableFiles.slice(i, i + BATCH_SIZE));
      }

      setCurrentBatch({ current: 0, total: batches.length });

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        setCurrentBatch({ current: batchIndex + 1, total: batches.length });

        // Process batch
        await Promise.all(batch.map(async (file) => {
          try {
            setBulkOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'in_progress', progress: 50 }
            }));

            await handleArchive(file);
            
            setBulkOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'completed', progress: 100 }
            }));
            
            successCount++;
          } catch (error) {
            console.error(`Failed to hibernate ${file.original_filename}:`, error);
            setBulkOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'error', progress: 0 }
            }));
            errorCount++;
          }
        }));

        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Mark operation as completed
      setBulkOperationStatus('completed');

      // Clear selection and reload after a short delay
      setTimeout(() => {
        clearSelection();
        loadFiles();
        setBulkOperationStatus(null);
        setBulkOperationProgress({});
        setBulkOperationType(null);
      }, 2000);

    } catch (error) {
      console.error('Bulk hibernation failed:', error);
      setBulkOperationStatus('error');
      setTimeout(() => {
        setBulkOperationStatus(null);
        setBulkOperationProgress({});
        setBulkOperationType(null);
      }, 3000);
    }
  };

  const handleBulkWakeUp = async () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    

    try {
      // Wake up selected files (Standard tier, no dialog)
      for (const file of selectedFilesList) {
        if (file.status === 'archived') {
          await mediaAPI.restoreFile(file.id, 'Standard');
        }
      }

      // For folders, wake up all files in those folders
      for (const folder of selectedFoldersList) {
        const folderFiles = files.filter(f => f.relative_path?.startsWith(folder.path));
        for (const file of folderFiles) {
          if (file.status === 'archived') {
            await mediaAPI.restoreFile(file.id, 'Standard');
          }
        }
      }

      clearSelection();
      loadFiles(); // Refresh the file list
    } catch (error) {
      console.error('Bulk wake up failed:', error);
    }
  };

  const handleBulkDownload = async () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    
    if (selectedFilesList.length === 0 && selectedFoldersList.length === 0) {
      return;
    }

    // Collect all files to be downloaded
    const allFilesToDownload = [...selectedFilesList];
    for (const folder of selectedFoldersList) {
      const folderFiles = files.filter(f => f.relative_path?.startsWith(folder.path));
      allFilesToDownload.push(...folderFiles);
    }

    // Filter only files that can be downloaded (not archived files)
    const downloadableFiles = allFilesToDownload.filter(f => 
      f.status === 'uploaded' || f.status === 'restored'
    );

    if (downloadableFiles.length === 0) {
      alert('No files available for download. Files must be in "uploaded" or "restored" state.');
      return;
    }

    try {
      // Show download progress dialog
      setDownloadInfo({
        filename: `bulk_download_${Date.now()}.zip`,
        file_size: downloadableFiles.reduce((sum, f) => sum + f.file_size, 0),
        is_encrypted: downloadableFiles.some(f => f.is_encrypted),
        encryption_metadata: null,
        isBulkDownload: true,
        fileCount: downloadableFiles.length
      });
      setDownloadDialogOpen(true);

      // Create ZIP archive
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Download and add files to ZIP
      for (let i = 0; i < downloadableFiles.length; i++) {
        const file = downloadableFiles[i];
        
        try {
          // Get download info for this file
          const response = await mediaAPI.downloadFile(file.id);
          const { download_url, filename, file_size, is_encrypted, encryption_metadata } = response.data;
          
          // Download the file
          const fileResponse = await fetch(download_url);
          if (!fileResponse.ok) {
            throw new Error(`Failed to download ${filename}: ${fileResponse.status}`);
          }
          
          let fileBlob = await fileResponse.blob();
          let finalFilename = filename;
          
          // Decrypt file if it's encrypted and encryption is enabled
          if (is_encrypted && encryption_metadata && encryptionService.isEnabled()) {
            try {
              const encryptedFile = new File([fileBlob], filename, { type: fileBlob.type });
              const decryptedFile = await encryptionService.decryptFileAfterDownload(
                encryptedFile,
                encryption_metadata
              );
              fileBlob = decryptedFile;
              finalFilename = decryptedFile.name;
            } catch (decryptionError) {
              console.error(`Decryption failed for ${filename}:`, decryptionError);
              throw new Error(`Decryption failed for ${filename}: ${decryptionError.message}`);
            }
          } else if (is_encrypted && !encryptionService.isEnabled()) {
            throw new Error(`File ${filename} is encrypted but encryption service is not enabled. Please set up your master password first.`);
          }
          
          // Add file to ZIP with proper path structure
          const relativePath = file.relative_path || '';
          const zipPath = relativePath ? `${relativePath}/${finalFilename}` : finalFilename;
          zip.file(zipPath, fileBlob);
          
          // Update progress
          const progress = Math.round(((i + 1) / downloadableFiles.length) * 100);
          console.log(`Added ${finalFilename} to ZIP (${progress}%)`);
          
        } catch (fileError) {
          console.error(`Failed to process file ${file.original_filename}:`, fileError);
          // Continue with other files instead of failing completely
        }
      }
      
      // Generate ZIP file
      console.log('Generating ZIP file...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      console.log(`ZIP generated successfully, size: ${zipBlob.size} bytes`);
      
      // Download the ZIP file
      const zipUrl = window.URL.createObjectURL(zipBlob);
      console.log('Created download URL:', zipUrl);
      
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `download_${Date.now()}.zip`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      console.log('Triggering download...');
      
      // Trigger download
      link.click();
      
      // Fallback: if download doesn't start, try alternative method
      setTimeout(() => {
        // Check if download started by looking for the blob URL
        if (zipUrl && zipUrl.startsWith('blob:')) {
          console.log('Download triggered successfully');
        } else {
          console.warn('Download may not have started, trying alternative method');
          // Alternative download method
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = zipUrl;
          document.body.appendChild(iframe);
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 2000);
        }
      }, 500);
      
      // Wait a moment before cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(zipUrl);
        console.log('Download cleanup completed');
      }, 2000);
      
      // Signal download completion to the dialog
      setDownloadInfo(prev => ({ ...prev, downloadComplete: true }));
      
      // Close dialog and clear selection after a delay
      setTimeout(() => {
        setDownloadDialogOpen(false);
        clearSelection();
        console.log(`Bulk download completed: ${downloadableFiles.length} files in ZIP`);
      }, 3000);
      
    } catch (error) {
      console.error('Bulk download failed:', error);
      setDownloadDialogOpen(false);
      alert(`Bulk download failed: ${error.message}`);
    }
  };

  const handleBulkDelete = () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    

    if (selectedFilesList.length === 0 && selectedFoldersList.length === 0) {
      return;
    }

    // Count total files that will be deleted
    const folderFilesCount = selectedFoldersList.reduce((count, folder) => {
      return count + files.filter(f => f.relative_path?.startsWith(folder.path)).length;
    }, 0);
    
    const totalCount = selectedFilesList.length + folderFilesCount;
    
    // Show bulk confirmation dialog
    setBulkDeleteDialog({ open: true, count: totalCount });
  };

  const confirmBulkDelete = async () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    
    // Close dialog and start progress tracking
    setBulkDeleteDialog({ open: false, count: 0 });
    
    // Collect all files to be deleted
    const allFilesToDelete = [...selectedFilesList];
    for (const folder of selectedFoldersList) {
      const folderFiles = files.filter(f => f.relative_path?.startsWith(folder.path));
      allFilesToDelete.push(...folderFiles);
    }
    
    const fileIds = allFilesToDelete.map(file => file.id);
    
    // Add delete operation to global upload manager
    const deleteOperationId = uploadManager.addDeleteOperation(fileIds, 'delete');
    
    // Update local state for UI
    setBulkOperationType('delete');
    setBulkOperationStatus('in_progress');
    setBulkOperationProgress({});
    
    // Initialize progress for all files
    allFilesToDelete.forEach(file => {
      setBulkOperationProgress(prev => ({
        ...prev,
        [file.id]: { status: 'pending', progress: 0 }
      }));
    });
    
    try {
      // Update delete operation status
      uploadManager.updateDeleteOperation(deleteOperationId, { status: 'deleting', progress: 0, completedFiles: 0 });
      
      // Handle large selections by splitting into chunks of 1000 (optimized for speed)
      const MAX_BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < fileIds.length; i += MAX_BATCH_SIZE) {
        batches.push(fileIds.slice(i, i + MAX_BATCH_SIZE));
      }
      
      
      // Set initial batch state
      setCurrentBatch({ current: 0, total: batches.length });
      
      let totalDeleted = 0;
      let totalFailed = 0;
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        try {
          
          // Update current batch state
          setCurrentBatch({ current: batchIndex + 1, total: batches.length });
          
          // Update progress message to show current batch
          setBulkOperationProgress(prev => {
            const updated = { ...prev };
            batch.forEach(fileId => {
              updated[fileId] = { status: 'in_progress', progress: 50 };
            });
            return updated;
          });
          
          // Use the bulk delete endpoint for this batch
          const response = await mediaAPI.bulkDeleteFiles(batch);
          const { summary, failed_files } = response.data;
          
          totalDeleted += summary.successfully_deleted;
          totalFailed += summary.failed_deletions;
          
          // Update progress for files in this batch
          batch.forEach(fileId => {
            const failedFile = failed_files.find(f => f.file_id === fileId);
            if (failedFile) {
              setBulkOperationProgress(prev => ({
                ...prev,
                [fileId]: { status: 'error', progress: 0 }
              }));
            } else {
              setBulkOperationProgress(prev => ({
                ...prev,
                [fileId]: { status: 'completed', progress: 100 }
              }));
            }
          });
          
          // Update global delete operation progress
          const completedFiles = totalDeleted + totalFailed;
          const progress = Math.round((completedFiles / fileIds.length) * 100);
          uploadManager.updateDeleteOperation(deleteOperationId, { 
            status: 'uploading', 
            progress, 
            completedFiles 
          });
          
          // Shorter delay between batches for faster processing
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} failed:`, error);
          
          // Mark all files in this batch as failed
          batch.forEach(fileId => {
            setBulkOperationProgress(prev => ({
              ...prev,
              [fileId]: { status: 'error', progress: 0 }
            }));
          });
          
          totalFailed += batch.length;
        }
      }
      
      // Mark operation as completed
      setBulkOperationStatus('completed');
      uploadManager.updateDeleteOperation(deleteOperationId, { 
        status: 'completed', 
        progress: 100, 
        completedFiles: totalDeleted + totalFailed 
      });
      
      
      // Clear selection and reload after a short delay
      setTimeout(() => {
        clearSelection();
        loadFiles();
        setBulkOperationStatus(null);
        setBulkOperationProgress({});
        setBulkOperationType(null);
        // Remove completed delete operation from global manager
        uploadManager.queue = uploadManager.queue.filter(q => q.id !== deleteOperationId);
        uploadManager._emit();
      }, 2000);
      
    } catch (error) {
      console.error('Bulk delete failed:', error);
      setBulkOperationStatus('error');
      uploadManager.updateDeleteOperation(deleteOperationId, { 
        status: 'failed', 
        progress: 0, 
        error: error.message 
      });
      setTimeout(() => {
        setBulkOperationStatus(null);
        setBulkOperationProgress({});
        setBulkOperationType(null);
        // Remove failed delete operation from global manager
        uploadManager.queue = uploadManager.queue.filter(q => q.id !== deleteOperationId);
        uploadManager._emit();
      }, 3000);
    }
  };

  // Load files
  useEffect(() => {
    loadFiles();
  }, []);

  // Keep upload area/progress visible if uploads are queued or in progress
  useEffect(() => {
    let unsub;
    let lastStateHash = '';
    let throttleTimer = null;
    
    uploadManager.init().then(() => {
      unsub = uploadManager.subscribe((state) => {
        if (!state) return;
        
        // Create a hash of relevant state to prevent unnecessary updates
        const stateHash = `${state.total}-${state.completed}-${state.inProgress}-${state.queued}-${state.failed}`;
        
        // Only update if state actually changed
        if (stateHash !== lastStateHash) {
          lastStateHash = stateHash;
          
          // Throttle state updates to prevent flickering
          if (throttleTimer) {
            clearTimeout(throttleTimer);
          }
          
          throttleTimer = setTimeout(() => {
            setUploadManagerState(state);
            throttleTimer = null;
          }, 150); // 150ms throttle to reduce flickering
        }
      });
    });
    
    return () => {
      unsub?.();
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, []);

  // Auto-clear logic for completed or cancelled uploads
  useEffect(() => {
    let timeout;
    const state = uploadManagerState;
    if (!state) return;
    const { inProgress, queued, completed, total } = state;
    
    // Trigger auto-clear when uploads are fully completed OR cancelled
    // This includes: completed === total OR (inProgress === 0 && queued === 0 && completed > 0)
    const allUploadsFinished = inProgress === 0 && queued === 0 && completed > 0;
    const allUploadsCompleted = completed === total;
    
    if (allUploadsFinished || allUploadsCompleted) {
      timeout = setTimeout(async () => {
        await uploadManager.clearAll();
        loadFiles();
      }, 5000);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [uploadManagerState?.inProgress, uploadManagerState?.queued, uploadManagerState?.completed, uploadManagerState?.total]);

  // Debounced sync from global search (optimised)
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchQuery(globalSearchQuery || '');
    }, 200);
    return () => clearTimeout(id);
  }, [globalSearchQuery]);

  async function loadFiles() {
    try {
      setLoading(true);
      const response = await mediaAPI.getFiles();
      const allFiles = response.data || [];

      // Group files by folder structure
      const folderMap = new Map();
      const fileList = [];

      allFiles.forEach((file) => {
        // Try to get path from relative_path first, then s3_key
        const path = file.relative_path || file.s3_key || '';
        const pathParts = path.split('/').filter((p) => p !== '');


        if (pathParts.length === 0) {
          fileList.push(file);
        } else {
          let currentPath = 'root';
          // Process all path parts as folders - the actual filename is in file.original_filename
          pathParts.forEach((part, index) => {
            // All parts are folders, not filenames
            const folderPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
            if (!folderMap.has(folderPath)) {
              folderMap.set(folderPath, {
                name: part,
                path: folderPath,
                parent: currentPath,
                fileCount: 0,
                size: 0,
              });
            } else {
            }
            currentPath = folderPath;
          });
          
          // Add the file to the deepest folder
          fileList.push(file);
        }
      });

      // Calculate folder stats
      allFiles.forEach((file) => {
        const filePath = file.relative_path || file.s3_key || '';
        const pathParts = filePath.split('/').filter((p) => p !== '');
        let currentPath = 'root';

        // All path parts are folders, add file stats to each folder in the path
        pathParts.forEach((part, index) => {
          const folderPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
          const folder = folderMap.get(folderPath);
          if (folder) {
            folder.fileCount += 1;
            folder.size += file.file_size || 0;
          }
          currentPath = folderPath;
        });
      });

      setFiles(fileList);
      setFolders(Array.from(folderMap.values()));
      
      // Debug: Log final folder structure
      Array.from(folderMap.values()).forEach(folder => {
      });
      
      // Debug: Check for lib folder specifically
      const libFolders = Array.from(folderMap.values()).filter(f => f.name === 'lib' || f.path.includes('lib'));
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter files based on tab, search, and current folder - Optimized for performance
  const filteredFiles = useMemo(() => {
    // Early return if no files
    if (!files || files.length === 0) return [];
    
    let result = files;

    // If searching, perform global match across names and paths and skip folder scoping
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = files.filter((f) => {
        const name = (f.original_filename || '').toLowerCase();
        const path = (f.relative_path || f.s3_key || '').toLowerCase();
        return name.includes(q) || path.includes(q);
      });
    } else {
      // Filter by current folder - show files DIRECTLY in the current folder (not in subfolders)
      result = result.filter((file) => {
        const path = file.relative_path || '';
        
        if (currentFolder === 'root') {
          // Show files in root (empty relative_path)
          return !path || path === '';
        } else {
          // Show files DIRECTLY in the current folder (not in subfolders)
          const folderPath = currentFolder;
          
          // File is directly in this folder if:
          // 1. Path exactly matches the folder path (file is the folder itself)
          // 2. Path starts with folderPath + '/' but has no more slashes after that
          return path === folderPath || 
                 (path.startsWith(folderPath + '/') && 
                  path.substring(folderPath.length + 1).indexOf('/') === -1);
        }
      });
    }

    return result;
  }, [files, activeTab, searchQuery, currentFolder]);

  // Get subfolders for the current folder to show in main content - Optimized
  const currentFolderSubfolders = useMemo(() => {
    if (searchQuery) return [];
    if (currentFolder === 'root') {
      return folders.filter(f => f.parent === 'root');
    } else {
      return folders.filter(f => f.parent === currentFolder);
    }
  }, [folders, currentFolder, searchQuery]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle folder toggle
  const handleFolderToggle = (folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Render folder tree recursively
  const renderFolderTree = (parentPath = 'root', level = 0) => {
    const childFolders = folders.filter((f) => f.parent === parentPath);
    
    // Debug logging

    return childFolders.map((folder) => {
      const isExpanded = expandedFolders.has(folder.path);

      return (
        <Box key={folder.path}>
          <ListItem
            button
            onClick={() => {
              setCurrentFolder(folder.path);
              onFolderSelect?.(folder.path);
              // Also toggle expansion when clicking the folder
              handleFolderToggle(folder.path);
            }}
            sx={{
              pl: 2 + level * 2,
              py: 0.5,
              borderRadius: 1,
              mb: 0.5,
              bgcolor:
                currentFolder === folder.path
                  ? alpha(theme.palette.primary.main, 0.1)
                  : 'transparent',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.05),
              },
              transition: 'all 0.2s',
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderToggle(folder.path);
              }}
              sx={{ mr: 0.5, p: 0.5 }}
            >
              {isExpanded ? (
                <ExpandMore fontSize="small" />
              ) : (
                <ChevronRight fontSize="small" />
              )}
            </IconButton>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {isExpanded ? (
                <FolderOpen sx={{ fontSize: 20, color: '#60a5fa' }} />
              ) : (
                <Folder sx={{ fontSize: 20, color: '#94a3b8' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {folder.name}
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary">
                  {folder.fileCount} files
                </Typography>
              }
            />
          </ListItem>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {renderFolderTree(folder.path, level + 1)}
          </Collapse>
        </Box>
      );
    });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        height: 'calc(100vh - 100px)',
        bgcolor: 'background.default',
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left Sidebar - Folder Tree (hidden by default) */}
      {showLeftPanel && (
        <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', lg: 280 },
          height: { xs: 'auto', lg: '100%' },
          maxHeight: { xs: '200px', lg: 'none' },
          borderRadius: 0,
          borderRight: { xs: 'none', lg: `1px solid ${alpha(theme.palette.divider, 0.1)}` },
          borderBottom: { xs: `1px solid ${alpha(theme.palette.divider, 0.1)}`, lg: 'none' },
            background: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Sidebar Header */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Storage />
            Folders
          </Typography>
        </Box>

        {/* Folder Tree */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          <List dense>
            <ListItem
              button
              onClick={() => {
                setCurrentFolder('root');
                onFolderSelect?.('root');
              }}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                bgcolor:
                  currentFolder === 'root'
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'transparent',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                },
              }}
            >
              <ListItemIcon>
                <FolderOpen sx={{ color: '#60a5fa' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    All Files
                  </Typography>
                }
              />
            </ListItem>
            {renderFolderTree()}
          </List>
        </Box>

        {/* Storage Stats */}
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            background: alpha('#f8fafc', 0.5),
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Storage Used
          </Typography>
          <LinearProgress
            variant="determinate"
            value={45}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: alpha('#cbd5e1', 0.3),
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #60a5fa 0%, #a78bfa 100%)',
                borderRadius: 3,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            4.5 GB of 10 GB
          </Typography>
        </Box>
      </Paper>
      )}

      {/* Main Content Area */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative',
        minWidth: 0, // Prevents flex item from overflowing
        overflow: 'hidden'
      }}>

        {/* Breadcrumb & Tabs */}
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
                  setCurrentFolder('root');
                  onFolderSelect?.('root');
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
                          setCurrentFolder(pathToHere);
                          onFolderSelect?.(pathToHere);
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
                    sx={{ textTransform: 'none', fontWeight: 600, display: { xs: 'none', md: 'inline-flex' } }}
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
                  <IconButton onClick={loadFiles} size="small" sx={{ flex: '0 0 auto' }}>
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

          {/* Removed redundant All Files tabs for cleaner UI */}
        </Box>

        {/* Global Compact Upload Progress - Memoized for Performance */}
        <UploadProgressBar uploadManagerState={uploadManagerState} />

        {/* Enhanced Delete Progress */}
        {(() => {
          const deleteOps = uploadManagerState.deleteOperations || [];
          const activeDeleteOp = deleteOps.find(op => op.status === 'deleting');
          if (!activeDeleteOp) return null;
          
          const total = activeDeleteOp.totalFiles || 0;
          const completed = activeDeleteOp.completedFiles || 0;
          const hasActivity = total > 0;
          if (!hasActivity) return null;
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
        })()}

        {/* File Grid/List or Upload Area */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: { xs: 2, md: 3 }, pr: { xs: 2, md: 2 }, pb: { xs: 2, md: 3 }, pl: { xs: 2, md: 3 } }}>
          {/* Status Summary */}
          {filteredFiles.length > 0 && (
            <Paper sx={{ p: 2.5, mb: 3, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                📊 File Status Summary
              </Typography>
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
              <Box sx={{ display: 'none' }}>
                {(() => {
                  const statusCounts = filteredFiles.reduce((acc, file) => {
                    const config = getFileStateConfig(file.status);
                    acc[file.status] = (acc[file.status] || 0) + 1;
                    return acc;
                  }, {});
                  
                  return Object.entries(statusCounts).map(([status, count]) => {
                    const config = getFileStateConfig(status);
                    return (
                      <Chip
                        key={status}
                        icon={config.icon}
                        label={`${config.label}: ${count}`}
                        size="small"
                        sx={{
                          bgcolor: alpha(config.color, 0.1),
                          color: config.color,
                          fontWeight: 600,
                          border: `1px solid ${alpha(config.color, 0.3)}`,
                        }}
                      />
                    );
                  });
                })()}
              </Box>
            </Paper>
          )}

          {bulkOperationStatus === 'completed' && (
            <Box sx={{ mb: 4 }}>
              <Paper sx={{ p: 2.5, bgcolor: alpha('#f3f4f6', 0.3), border: '1px solid', borderColor: '#6b7280' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <CheckCircle sx={{ color: '#6b7280' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151' }}>
                    Deletion Completed Successfully!
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          )}

          {bulkOperationStatus === 'error' && (
            <Box sx={{ mb: 4 }}>
              <Paper sx={{ p: 2.5, bgcolor: alpha('#fee2e2', 0.3), border: '1px solid', borderColor: '#ef4444' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Error sx={{ color: '#ef4444' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#991b1b' }}>
                    Some files failed to delete
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          )}

          {showUploadArea && !hasUploadOperations ? (
            <Box>
              {/* Upload Header */}
              <Box sx={{ mb: 4, p: 2.5, bgcolor: alpha('#f0f9ff', 0.5), borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <CloudUpload sx={{ color: '#60a5fa' }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Upload Files
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Uploading to: <strong>{currentFolder === 'root' ? 'Root Directory' : currentFolder}</strong>
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <IconButton 
                    onClick={() => setShowUploadArea(false)}
                    sx={{ bgcolor: alpha('#ef4444', 0.1), '&:hover': { bgcolor: alpha('#ef4444', 0.2) } }}
                  >
                    <Close sx={{ color: '#ef4444' }} />
                  </IconButton>
                </Stack>
              </Box>
              
              <DirectoryUploader
                open={true}
                onClose={() => setShowUploadArea(false)}
                onUploadComplete={() => {
                  setShowUploadArea(false);
                  setOverallUploadProgress(0);
                  setOverallUploadLabel('');
                  loadFiles(); // Refresh the file list
                }}
                onUploadProgress={(progress, fileName) => {
                  setUploadProgress(prev => ({
                    ...prev,
                    [fileName]: progress
                  }));
                  // Heuristic: DirectoryUploader sends overall label like "12/49 files"
                  if (typeof fileName === 'string' && fileName.includes('files')) {
                    setOverallUploadProgress(Math.round(progress));
                    setOverallUploadLabel(fileName);
                  }
                }}
                // Pass the current folder as the upload destination
                defaultRelativePath={currentFolder === 'root' ? '' : currentFolder}
              />
            </Box>
          ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
<LinearProgress sx={{ width: '50%' }} />
            </Box>
          ) : (() => {
            const shouldShowUpload = filteredFiles.length === 0 && currentFolderSubfolders.length === 0 && !searchQuery;
            return shouldShowUpload;
          })() ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 2,
                cursor: 'pointer',
                borderRadius: 3,
                border: `2px dashed ${alpha('#60a5fa', 0.3)}`,
                bgcolor: alpha('#f0f9ff', 0.3),
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: '#60a5fa',
                  bgcolor: alpha('#f0f9ff', 0.5),
                  transform: 'scale(1.02)',
                },
                ...(hasUploadOperations && {
                  opacity: 0.5,
                  pointerEvents: 'none',
                  cursor: 'not-allowed'
                })
              }}
              onClick={() => {
                if (!hasUploadOperations) {
                  setShowUploadArea(true);
                }
              }}
            >
              <CloudUpload sx={{ fontSize: 80, color: alpha('#60a5fa', 0.5) }} />
              <Typography variant="h6" color="text.secondary">
                {debouncedUploadStatusText.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {debouncedUploadStatusText.subtitle}
              </Typography>
              {activeTab === 0 && (
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  sx={{
                    mt: 2,
                    bgcolor: '#60a5fa',
                    '&:hover': { bgcolor: '#3b82f6' },
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  Upload Files
                </Button>
              )}
            </Box>
          ) : (
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
                        
                        setCurrentFolder(folder.path);
                        onFolderSelect?.(folder.path);
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
                const stateConfig = getFileStateConfig(file.status);
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
                          
                          setSelectedFile(file);
                          onFileSelect?.(file, 'view');
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
          )}
        </Box>
      </Box>

      {/* Right Info Panel (if file selected) */}
      {selectedFile && (
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
              <IconButton size="small" onClick={() => setSelectedFile(null)}>
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
                  icon={getFileStateConfig(selectedFile.status).icon}
                  label={getFileStateConfig(selectedFile.status).label}
                  size="small"
                  sx={{
                    mt: 0.5,
                    bgcolor: alpha(getFileStateConfig(selectedFile.status).color, 0.1),
                    color: getFileStateConfig(selectedFile.status).color,
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
                      {starting ? 'Starting uploads…' : `Uploading ${Math.max(total - completed, 0)} of ${total} files`}
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
                      loadFiles(); // Refresh the file list
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
                      // Directly trigger Standard restore without a dialog
                      await mediaAPI.restoreFile(selectedFile.id, 'Standard');
                      // Refresh to reflect 'restoring' status
                      await loadFiles();
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
                    setSelectedFile(null);
                    loadFiles(); // Refresh the file list
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
      )}

      {/* Right Folder Details Drawer (when inside a folder) */}
      {(() => {
        if (selectedFile || currentFolder === 'root') return null;
        const open = showFolderDetails; // Progress moved to global banner
        return (
          <Drawer anchor="right" open={open} onClose={() => setShowFolderDetails(false)} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Box sx={{ width: { xs: 320, sm: 360 }, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Folder Details
                </Typography>
                <IconButton size="small" onClick={() => setShowFolderDetails(false)}>
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
              {/* Upload progress moved to global banner */}
            </Box>
          </Drawer>
        );
      })()}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialog.open}
        onClose={() => setBulkDeleteDialog({ open: false, count: 0 })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Delete color="error" />
          Confirm Bulk Delete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete <strong>{bulkDeleteDialog.count}</strong> items?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. All selected files and folders will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setBulkDeleteDialog({ open: false, count: 0 })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<Delete />}
          >
            Delete {bulkDeleteDialog.count} Items
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Download Progress Dialog */}
      <DownloadProgressDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        downloadInfo={downloadInfo}
      />
      
      {/* Restore dialog removed; using Standard restore inline */}
    </Box>
  );
};

export default DataHibernateManager;

