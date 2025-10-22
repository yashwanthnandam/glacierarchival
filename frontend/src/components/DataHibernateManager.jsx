import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
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
import encryptionService from '../services/encryptionService';
import secureTokenStorage from '../utils/secureTokenStorage';
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
  Security,
  Lock,
  LockOpen,
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
import { mediaAPI, hibernationAPI } from '../services/api';
import { useFileActions } from '../hooks/useFileActions';
import DirectoryUploader from './DirectoryUploader';
import DownloadProgressDialog from './DownloadProgressDialog';
import uploadManager from '../services/uploadManager';
// Import new components
import FileGridToolbar from './FileGridToolbar';
import FileStatusSummary from './FileStatusSummary';
import BulkOperationProgress from './BulkOperationProgress';
import FileGrid from './FileGrid';
// import VirtualizedFileGrid from './VirtualizedFileGrid'; // Temporarily disabled due to react-window import issues
import FileDetailsPanel from './FileDetailsPanel';
import FolderDetailsDrawer from './FolderDetailsDrawer';
import BulkDeleteDialog from './BulkDeleteDialog';

// Helper functions moved outside component for better performance
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ULTRA SIMPLE Upload Progress Bar - No flickering
const UploadProgressBar = memo(({ uploadManagerState, files }) => {
  // Extract values with defaults - use upload-specific totals for global progress
  const total = uploadManagerState?.uploadTotal || 0;
  const completed = uploadManagerState?.uploadCompleted || 0;
  const failed = uploadManagerState?.uploadFailed || 0;
  const cancelled = uploadManagerState?.uploadCancelled || 0;
  const inProgress = uploadManagerState?.uploadInProgress || 0;
  const queued = uploadManagerState?.uploadQueued || 0;
  
  // Check if there are any files in "uploading" status in the database
  const dbUploadingFiles = files?.filter(f => f.status === 'uploading') || [];
  const hasDbUploadingFiles = dbUploadingFiles.length > 0;
  
  // Calculate percentage based on processed files (completed + failed + cancelled), not just successful
  const processedRaw = completed + failed + cancelled;
  const processed = Math.min(processedRaw, total);
  // Add 10-file buffer: consider complete when within 10 files of total
  const effectiveProcessed = Math.min(processed + 10, total);
  const percentage = total > 0 ? Math.floor((effectiveProcessed / total) * 100) : 0;
  
  // Show progress bar if there's an active upload session OR files actively uploading
  const hasActiveUploadSession = total > 0 && (inProgress > 0 || queued > 0);
  const showBar = (hasDbUploadingFiles || hasActiveUploadSession) && percentage < 100;
  if (!showBar) return null;
  
  const handleCancel = () => {
    uploadManager.cancelAllUploads();
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
      <Paper sx={{ p: 2, border: '1px solid #e0e0e0' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <CloudUpload sx={{ color: '#60a5fa' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              📤 Uploading {effectiveProcessed}/{total} files ({percentage}%)
              {(failed > 0 || cancelled > 0) && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                  {failed > 0 ? `(${failed} failed` : '('}{cancelled > 0 ? `${failed > 0 ? ', ' : ''}${cancelled} cancelled` : ''})
                </Typography>
              )}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={percentage} 
              sx={{ mt: 1, height: 8, borderRadius: 4 }} 
            />
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleCancel}
            sx={{ minWidth: 'auto' }}
          >
            Cancel
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
});

const DataHibernateManager = ({ onFileSelect, onFolderSelect, globalSearchQuery, isActive }) => {
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
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const showLeftPanel = false; // Hide sidebar for edge-to-edge layout
  
  // Disable Upload only when uploads are actively in progress (not just queued/completed)
  const hasUploadOperations = useMemo(() => {
    return uploadManagerState.uploadInProgress > 0;
  }, [uploadManagerState.uploadInProgress]);

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
  
  // File actions (archive/delete/download); restore handled inline with Standard tier
  const { 
    handleArchive, 
    handleDelete, 
    handleDownload,
    downloadDialogOpen, 
    downloadInfo, 
    setDownloadDialogOpen,
    setDownloadInfo
  } = useFileActions(loadFiles, true); // Force refresh for all file operations

  // Simple selection functions that don't depend on computed values
  const toggleFileSelection = useCallback((fileId) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const toggleFolderSelection = useCallback((folderPath) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
  }, []);

  const getSelectedCount = useCallback(() => {
    return selectedFiles.size + selectedFolders.size;
  }, [selectedFiles.size, selectedFolders.size]);

  const getSelectedFiles = useCallback(() => {
    return files.filter(f => selectedFiles.has(f.id));
  }, [files, selectedFiles]);

  const getSelectedFolders = useCallback(() => {
    return folders.filter(f => selectedFolders.has(f.path));
  }, [folders, selectedFolders]);

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

  // Calculate folder statuses once and memoize for performance
  const folderStatusMap = useMemo(() => {
    const map = new Map();
    
    folders.forEach(folder => {
      const folderPath = folder.path;
      // Prefer precomputed statusCounts from loadFiles when available (root folders)
      let folderFiles = [];
      let statusCountsOverride = folder.statusCounts;
      if (!statusCountsOverride) {
        folderFiles = files.filter(f => f.relative_path?.startsWith(folderPath));
        // Only return early if we don't have statusCountsOverride AND no files found
        if (folderFiles.length === 0) {
          map.set(folderPath, null);
          return;
        }
      }
    
      const statusCounts = statusCountsOverride || folderFiles.reduce((acc, file) => {
      acc[file.status] = (acc[file.status] || 0) + 1;
      return acc;
    }, {});
    
      const totalFiles = statusCountsOverride ? Object.values(statusCounts).reduce((a,b)=>a+b,0) : folderFiles.length;
    const hibernatedCount = statusCounts.archived || 0;
    const hibernatingCount = statusCounts.archiving || 0;
    const restoringCount = statusCounts.restoring || 0;
    const activeCount = (statusCounts.uploaded || 0) + (statusCounts.restored || 0);
    
    // Show status only if significant portion is hibernated/hibernating
    const hibernationRatio = (hibernatedCount + hibernatingCount) / totalFiles;
    
    // Priority: if any are restoring, show waking status at folder level
    if (restoringCount > 0) {
        map.set(folderPath, {
        type: 'restoring',
        count: restoringCount,
        total: totalFiles,
        icon: <WbSunny sx={{ fontSize: 14 }} />,
        color: '#fbbf24',
        label: `${restoringCount} waking`
        });
        return;
    }
    
    if (hibernationRatio >= 0.5) {
      // Majority hibernated - show hibernated status
        map.set(folderPath, {
        type: 'hibernated',
        count: hibernatedCount,
        total: totalFiles,
        icon: <AcUnit sx={{ fontSize: 14 }} />,
        color: '#94a3b8',
        label: `${hibernatedCount}/${totalFiles} hibernated`
        });
    } else if (hibernatingCount > 0) {
      // Some hibernating - show hibernating status
        map.set(folderPath, {
        type: 'hibernating',
        count: hibernatingCount,
        total: totalFiles,
        icon: <Schedule sx={{ fontSize: 14 }} />,
        color: '#a78bfa',
        label: `${hibernatingCount} hibernating`
        });
    } else if (hibernationRatio > 0) {
      // Some hibernated but not majority - show mixed status
        map.set(folderPath, {
        type: 'mixed',
        count: hibernatedCount,
        total: totalFiles,
        icon: <AcUnit sx={{ fontSize: 14 }} />,
        color: '#64748b',
        label: `${hibernatedCount}/${totalFiles} hibernated`
        });
      } else {
        // No hibernation activity; show Active status so users can see state explicitly
        map.set(folderPath, {
          type: 'active',
          count: activeCount,
          total: totalFiles,
          icon: <CheckCircle sx={{ fontSize: 14 }} />,
          color: '#22c55e',
          label: 'Active'
        });
      }
    });
    
    return map;
  }, [files, folders]);

  // Simple lookup function from memoized map
  const getFolderStatus = useCallback((folderPath) => {
    return folderStatusMap.get(folderPath) || null;
  }, [folderStatusMap]);

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
    
    // For each selected folder, fetch all files within that folder from the API
    for (const folder of selectedFoldersList) {
      try {
        const response = await mediaAPI.getFiles({
          folder: folder.path,
          paginate: false
        });
        
        if (response.data && Array.isArray(response.data.files)) {
          allFilesToHibernate.push(...response.data.files);
        }
      } catch (error) {
        // Log but don't fail the operation
      }
    }

    // Filter only files that can be hibernated
    const hibernatableFiles = allFilesToHibernate.filter(f => 
      f.status === 'uploaded' || f.status === 'restored'
    );

    if (hibernatableFiles.length === 0) {
      alert('No files available for hibernation. Files must be in "uploaded" or "restored" state.');
      return;
    }

    // Preflight: Ensure user has an active hibernation plan. If not, fail fast
    try {
      const planResponse = await hibernationAPI.getCurrentPlan();
      const planData = planResponse?.data;
      // If free tier or no plan data returned, block hibernation immediately
      if (!planData || planData.is_free_tier) {
        setBulkOperationType('hibernate');
        setBulkOperationStatus('error'); // BulkOperationProgress will show the plan-required message
        return;
      }
    } catch (_e) {
      // Any error fetching plan should be treated as no active plan to avoid spamming archive calls
      setBulkOperationType('hibernate');
      setBulkOperationStatus('error');
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
      let abortDueToPlan = false;

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

        // Update batch files to in_progress
        batch.forEach((file) => {
          setBulkOperationProgress(prev => ({
            ...prev,
            [file.id]: { status: 'in_progress', progress: 50 }
          }));
        });

        // Call bulk archive API for this batch
        const ids = batch.map(f => f.id);
        try {
          const response = await mediaAPI.bulkArchiveFiles(ids);
          const failed = response?.data?.failed_files || [];
          const failedIds = new Set(failed.map(f => f.id));

          // Mark successes
          batch.forEach((file) => {
            if (!failedIds.has(file.id)) {
              setBulkOperationProgress(prev => ({
                ...prev,
                [file.id]: { status: 'completed', progress: 100 }
              }));
              successCount++;
              } else {
              setBulkOperationProgress(prev => ({
                ...prev,
                [file.id]: { status: 'error', progress: 0 }
              }));
              errorCount++;
            }
          });
        } catch (err) {
          // If plan is required, stop processing further batches and show the message immediately
          if (err?.response?.status === 402) {
            abortDueToPlan = true;
          }
          // If the whole batch failed, mark all as error
          batch.forEach((file) => {
            setBulkOperationProgress(prev => ({
              ...prev,
              [file.id]: { status: 'error', progress: 0 }
            }));
            errorCount++;
          });
        }

        if (abortDueToPlan) {
          // Show error immediately and stop further requests
          setBulkOperationStatus('error');
          break;
        }

        // Small delay between batches
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Check if there were any failures and show appropriate message
      if (errorCount > 0 && successCount === 0) {
        // All failed - show error
        setBulkOperationStatus('error');
      } else if (errorCount > 0) {
        // Partial success - show warning
        setBulkOperationStatus('partial');
      } else {
        // All succeeded
      setBulkOperationStatus('completed');
      }

      // Clear selection and reload after a short delay
              setTimeout(() => {
                clearSelection();
        loadFiles(true); // Force refresh after bulk hibernation
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
      // Collect IDs to restore (selected files)
      const restoreIds = selectedFilesList.filter(f => f.status === 'archived').map(f => f.id);

      // Include files from selected folders
      for (const folder of selectedFoldersList) {
        try {
          const response = await mediaAPI.getFiles({ folder: folder.path, paginate: false });
          if (response.data && Array.isArray(response.data.files)) {
            response.data.files.forEach(f => { if (f.status === 'archived') restoreIds.push(f.id); });
          }
        } catch (_) { /* ignore */ }
      }

      // Batch restore using bulk endpoint in chunks
      const BATCH_SIZE = 25;
      for (let i = 0; i < restoreIds.length; i += BATCH_SIZE) {
        const batch = restoreIds.slice(i, i + BATCH_SIZE);
        if (batch.length > 0) {
          await mediaAPI.bulkRestoreFiles(batch, 'Standard');
          await new Promise(r => setTimeout(r, 500));
        }
      }

                clearSelection();
      loadFiles(true); // Refresh the file list with cache busting
    } catch (error) {
      console.error('Bulk wake up failed:', error);
    }
  };

  const handleBulkDownload = async () => {
    // Ensure single active download session
    if (handleBulkDownload.active) return;
    handleBulkDownload.active = true;
    const sessionId = Date.now();
    const lastProgressRef = { current: 0 };
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();
    
    if (selectedFilesList.length === 0 && selectedFoldersList.length === 0) {
      return;
    }

    // Collect all files to be downloaded
    const allFilesToDownload = [...selectedFilesList];
    
    // For each selected folder, fetch all files within that folder from the API
    for (const folder of selectedFoldersList) {
      try {
        const response = await mediaAPI.getFiles({
          folder: folder.path,
          paginate: false
        });
        
        if (response.data && Array.isArray(response.data.files)) {
          allFilesToDownload.push(...response.data.files);
        }
      } catch (error) {
        // Log but don't fail the operation
      }
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

      // Get all download URLs in one API call
      const fileIds = downloadableFiles.map(f => f.id);
      const bulkResponse = await mediaAPI.bulkDownloadFiles(fileIds);
      const downloadUrls = bulkResponse.data.download_urls;

      // Try to use Web Worker for better performance with large downloads
      let useWorker = downloadUrls.length > 10 && typeof Worker !== 'undefined';
      
      let zipBlob;
      
      if (useWorker) {
        try {
          // Use Web Worker for offloading ZIP creation
          zipBlob = await new Promise((resolve, reject) => {
            const worker = new Worker(`/download-worker.js?v=${Date.now()}`);
            // Attach session id
            
            let lastUiProgress = 0;
            let lastUiTime = 0;
            worker.onmessage = (event) => {
              const { type, payload } = event.data;
              
              if (type === 'PROGRESS') {
                const now = Date.now();
                const next = Math.max(lastProgressRef.current, Math.min(99, payload.progress || 0));
                if ((next - lastUiProgress >= 1) || (now - lastUiTime >= 100)) {
                  lastProgressRef.current = next;
                  lastUiProgress = next;
                  lastUiTime = now;
                  setDownloadInfo(prev => ({ ...prev, progress: next, message: payload.message }));
                }
              } else if (type === 'COMPLETE') {
                worker.terminate();
                resolve(payload.zipBlob);
              } else if (type === 'ERROR') {
                worker.terminate();
                reject(new Error(payload.error));
              }
            };
            
            worker.onerror = (error) => {
              worker.terminate();
              reject(error);
            };
            
            // Start download in worker
            worker.postMessage({
              type: 'START_DOWNLOAD',
              payload: {
                downloadUrls,
                encryptionKey: encryptionService.isEnabled() ? true : null,
                sessionId
              }
            });
          });
        } catch (workerError) {
          console.warn('Worker failed, falling back to main thread:', workerError);
          useWorker = false;
        }
      }
      
      // Fallback to main thread if worker not available or failed
      if (!useWorker) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

      // Download files in parallel (with concurrency limit)
        const CONCURRENCY_LIMIT = 5;
      const downloadPromises = [];
      
      for (let i = 0; i < downloadUrls.length; i += CONCURRENCY_LIMIT) {
        const batch = downloadUrls.slice(i, i + CONCURRENCY_LIMIT);
        const batchPromises = batch.map(async (downloadInfo, batchIndex) => {
          const globalIndex = i + batchIndex;
          
          if (downloadInfo.error) {
            console.error(`Download failed for ${downloadInfo.filename}: ${downloadInfo.error}`);
            return;
          }
          
          try {
            const fileResponse = await fetch(downloadInfo.download_url);
          if (!fileResponse.ok) {
              throw new Error(`Failed to download ${downloadInfo.filename}: ${fileResponse.status}`);
          }
          
          let fileBlob = await fileResponse.blob();
            let finalFilename = downloadInfo.filename;
          
          // Decrypt file if it's encrypted and encryption is enabled
            if (downloadInfo.is_encrypted && downloadInfo.encryption_metadata && encryptionService.isEnabled()) {
            try {
                const encryptedFile = new File([fileBlob], downloadInfo.filename, { type: fileBlob.type });
              const decryptedFile = await encryptionService.decryptFileAfterDownload(
                encryptedFile,
                  downloadInfo.encryption_metadata
              );
              fileBlob = decryptedFile;
              finalFilename = decryptedFile.name;
            } catch (decryptionError) {
                console.error(`Decryption failed for ${downloadInfo.filename}:`, decryptionError);
                throw new Error(`Decryption failed for ${downloadInfo.filename}: ${decryptionError.message}`);
            }
            } else if (downloadInfo.is_encrypted && !encryptionService.isEnabled()) {
                throw new Error(`File ${downloadInfo.filename} is encrypted but encryption service is not enabled.`);
          }
          
          // Add file to ZIP with proper path structure
            const relativePath = downloadInfo.relative_path || '';
          const zipPath = relativePath ? `${relativePath}/${finalFilename}` : finalFilename;
          zip.file(zipPath, fileBlob);
          
              // Update progress
              const progress = Math.round(((globalIndex + 1) / downloadUrls.length) * 90);
              setDownloadInfo(prev => ({
                ...prev,
                progress,
                message: `Processing ${globalIndex + 1}/${downloadUrls.length} files...`
              }));
        } catch (fileError) {
            console.error(`Failed to process ${downloadInfo.filename}:`, fileError);
        }
        });
        
        downloadPromises.push(...batchPromises);
      }
      
      await Promise.all(downloadPromises);
      
      // Generate ZIP file
        setDownloadInfo(prev => ({ ...prev, progress: Math.max(lastProgressRef.current, 95), message: 'Creating ZIP...' }));
        zipBlob = await zip.generateAsync({ type: 'blob' });
      }
      
      // Download the ZIP file
      const zipUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `download_${Date.now()}.zip`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(zipUrl);
      }, 2000);
      
      // Signal download completion
      setDownloadInfo(prev => ({ ...prev, progress: 100, downloadComplete: true }));
      
      // Close dialog and clear selection after a delay
      setTimeout(() => {
        setDownloadDialogOpen(false);
        clearSelection();
      }, 3000);
      
    } catch (error) {
      setDownloadDialogOpen(false);
      alert(`Bulk download failed: ${error.message}`);
    }
    finally {
      handleBulkDownload.active = false;
    }
  };

  const handleBulkDelete = () => {
    const selectedFilesList = getSelectedFiles();
    const selectedFoldersList = getSelectedFolders();

    if (selectedFilesList.length === 0 && selectedFoldersList.length === 0) {
      return;
    }

    // Count total files that will be deleted
    // Use the fileCount property from the folder objects instead of filtering files client-side
    const folderFilesCount = selectedFoldersList.reduce((count, folder) => {
      return count + (folder.fileCount || 0);
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
    
    // For each selected folder, fetch all files within that folder
    for (const folder of selectedFoldersList) {
      try {
        const response = await mediaAPI.getFiles({
          folder: folder.path,
          paginate: false
        });
        
        if (response.data && Array.isArray(response.data.files)) {
          allFilesToDelete.push(...response.data.files);
        }
      } catch (error) {
        console.error(`Error fetching files for folder ${folder.path}:`, error);
      }
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
          totalFailed += summary.failed_deletions || 0;
          
          // Update progress for files in this batch
          batch.forEach(fileId => {
            // Handle case where failed_files might not exist (already deleted files)
            const failedFile = failed_files ? failed_files.find(f => f.file_id === fileId) : null;
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
              setTimeout(async () => {
                clearSelection();
        await loadFiles(true); // Force refresh to bypass cache after bulk delete
        
        // Also refresh folder structure with cache busting
        try {
          const folderResponse = await mediaAPI.getFolderStructure(true);
        } catch (error) {
          console.error('[Bulk Delete] Failed to refresh folder structure:', error);
        }
        
                setBulkOperationStatus(null);
                setBulkOperationProgress({});
                setBulkOperationType(null);
        // Remove completed delete operation from global manager
        uploadManager.queue = uploadManager.queue.filter(q => q.id !== deleteOperationId);
        uploadManager._emit();
      }, 2000); // Increased to 2000ms to ensure database transaction is committed
      
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

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []); // Empty dependency array = run only on mount

  // Load files when component becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      loadFiles(true); // Force refresh when switching to this tab
    }
  }, [isActive]);

  // Load files when folder or search changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
    loadFiles(true); // Force refresh when folder changes to avoid cached empty results
    }, 100); // Small delay to batch rapid changes
    
    return () => clearTimeout(timeoutId);
  }, [currentFolder, searchQuery]);

  // Check encryption status (reduced frequency)
  useEffect(() => {
    const checkEncryptionStatus = () => {
      const status = encryptionService.getEncryptionStatus();
      setEncryptionEnabled(status.enabled);
    };
    
    checkEncryptionStatus();
    
    // Check every 5 seconds instead of every second
    const interval = setInterval(checkEncryptionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // ULTRA SIMPLE upload manager subscription - No flickering
  useEffect(() => {
    let unsub;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 500; // Only update every 500ms
    
    uploadManager.init().then(() => {
      // Get initial state
      const currentState = uploadManager.getState();
      if (currentState) {
        setUploadManagerState(currentState);
      }
      
      unsub = uploadManager.subscribe((state) => {
        if (!state) return;
        
        const now = Date.now();
        
        // Only update if enough time has passed OR if uploads just started/stopped
        const isUploadActive = state.uploadInProgress > 0 || state.uploadQueued > 0;
        const wasUploadActive = uploadManagerState.uploadInProgress > 0 || uploadManagerState.uploadQueued > 0;
        const uploadStateChanged = isUploadActive !== wasUploadActive;
        
        if (uploadStateChanged || (now - lastUpdateTime) >= UPDATE_INTERVAL) {
          lastUpdateTime = now;
            setUploadManagerState(state);
        }
      });
    });
    
    return () => {
      unsub?.();
    };
  }, []);

  // Auto-clear when upload session is finished (no queued/inProgress)
  useEffect(() => {
    const state = uploadManagerState;
    if (!state) return;

    const uploadsFinished = state.uploadTotal > 0 && state.uploadInProgress === 0 && state.uploadQueued === 0;
    if (uploadsFinished) {
      const timeout = setTimeout(async () => {
        await uploadManager.clearAll();
        if (!showUploadArea) {
          loadFiles(true);
        }
      }, 1200);

      return () => clearTimeout(timeout);
    }
  }, [uploadManagerState?.uploadTotal, uploadManagerState?.uploadInProgress, uploadManagerState?.uploadQueued, showUploadArea]);

  // Sync from global search (optimized)
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchQuery(globalSearchQuery || '');
    }, 100); // Reduced from 200ms
    return () => clearTimeout(id);
  }, [globalSearchQuery]);

  async function loadFiles(forceRefresh = false) {
    // Prevent multiple simultaneous calls
    if (loading && !forceRefresh) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if user is authenticated
      const token = secureTokenStorage.getAccessToken();
      if (!token) {
        console.error('No authentication token found');
        setFiles([]);
        setFolders([]);
        return;
      }
      
      const response = await mediaAPI.getFiles({
        folder: currentFolder === 'root' ? 'root' : currentFolder,
        search: searchQuery?.trim() || '',
        paginate: false,
        cacheBust: forceRefresh ? Date.now() : undefined, // Force fresh data after bulk operations
      });
      
      // Check if the response is an error
      if (response.status !== 200) {
        console.error('API returned non-200 status:', response.status);
        setFiles([]);
        setFolders([]);
        return;
      }
      
      // Handle different response structures
      let allFiles = [];
      let apiFolders = [];
      
      if (response.data && Array.isArray(response.data.files)) {
        allFiles = response.data.files;
        apiFolders = response.data.folders || [];
      } else if (Array.isArray(response.data)) {
        allFiles = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        allFiles = response.data.data;
      }

      // Ensure allFiles is always an array
      if (!Array.isArray(allFiles)) {
        allFiles = [];
      }
      
      // Convert API folders to file-like objects for compatibility
      const folderFiles = apiFolders.map(folder => ({
        id: `folder_${folder.name}`,
        original_filename: folder.name,
        file_type: 'folder',
        file_size: folder.size || 0,
        relative_path: folder.relative_path,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
        fileCount: folder.fileCount,  // Use camelCase for frontend
        size: folder.size || 0  // Use size from API response
      }));
      
      // Combine files and folders
      allFiles = [...allFiles, ...folderFiles];

      // Group files by folder structure
      const folderMap = new Map();
      const fileList = [];

      allFiles.forEach((file) => {
        // Check if this is an explicit folder entry
        if (file.file_type === 'folder') {
          const path = file.relative_path || '';
          const pathParts = path.split('/').filter((p) => p !== '');
          
          // Check if this is a root-level folder (relative_path matches original_filename)
          if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === file.original_filename)) {
            // Root level folder - preserve API data
            const folderPath = file.original_filename;
            folderMap.set(folderPath, {
              name: file.original_filename,
              path: folderPath,
              parent: 'root',
              fileCount: file.fileCount || 0,
              size: file.size || 0,
              isCalculated: false
            });
          } else {
            // Nested folder
            let currentPath = 'root';
            pathParts.forEach((part, index) => {
              const folderPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
              if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, {
                  name: part,
                  path: folderPath,
                  parent: currentPath,
                  fileCount: 0,
                  size: 0,
                  isCalculated: true
                });
              }
              currentPath = folderPath;
            });

          // Apply API-provided counts to the final nested folder node
          const finalFolder = folderMap.get(currentPath);
          if (finalFolder) {
            finalFolder.fileCount = file.fileCount || finalFolder.fileCount || 0;
            finalFolder.size = file.size || finalFolder.size || 0;
            // Mark as API-provided so we don't double-count during aggregation
            finalFolder.isCalculated = false;
          }
          }
          return; // Skip processing as a regular file
        }

        // Process regular files
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
            }
            currentPath = folderPath;
          });
          
          // Add the file to the deepest folder
          fileList.push(file);
        }
      });

      // Calculate folder stats
      allFiles.forEach((file) => {
        // Skip folder entries when calculating stats
        if (file.file_type === 'folder') {
          return;
        }
        
        const filePath = file.relative_path || file.s3_key || '';
        const pathParts = filePath.split('/').filter((p) => p !== '');
        let currentPath = 'root';

        // All path parts are folders, add file stats to each folder in the path
        pathParts.forEach((part, index) => {
          const folderPath = currentPath === 'root' ? part : `${currentPath}/${part}`;
          const folder = folderMap.get(folderPath);
          if (folder) {
            // Sum into calculated folders, or any folder that currently has no totals
            if (folder.isCalculated || (!folder.fileCount && !folder.size)) {
              folder.fileCount += 1;
              folder.size += file.file_size || 0;
            }
          }
          currentPath = folderPath;
        });
      });

      // Special handling for root-level folders when we're in root view
      // If we're viewing root and only see folder entries (not their contents),
      // we need to make additional API calls to get the actual file counts
      if (currentFolder === 'root' && allFiles.length > 0 && allFiles.every(f => f.file_type === 'folder')) {
        // For each root-level folder, make an API call to get its contents
        const folderStatsPromises = allFiles
          .filter(f => f.file_type === 'folder' && (!f.relative_path || f.relative_path === ''))
          .map(async (folder) => {
            try {
              const response = await mediaAPI.getFiles({
                folder: folder.original_filename,
                search: '',
                paginate: false,
              });
              
              const folderFiles = response.data.files || [];
              const contentFiles = folderFiles.filter(f => f.file_type !== 'folder');
              const totalFiles = contentFiles.length;
              const totalSize = contentFiles
                .filter(f => f.file_type !== 'folder')
                .reduce((sum, f) => sum + (f.file_size || 0), 0);
              const statusCounts = contentFiles.reduce((acc, f) => {
                acc[f.status] = (acc[f.status] || 0) + 1;
                return acc;
              }, {});
              
              // Update the folder stats
              const folderPath = folder.original_filename;
              const folderEntry = folderMap.get(folderPath);
              if (folderEntry) {
                folderEntry.fileCount = totalFiles;
                folderEntry.size = totalSize;
                folderEntry.statusCounts = statusCounts;
              }
              
              return { folderPath, fileCount: totalFiles, size: totalSize, statusCounts };
            } catch (error) {
              console.error(`Error getting stats for folder ${folder.original_filename}:`, error);
              return { folderPath: folder.original_filename, fileCount: 0, size: 0, statusCounts: {} };
            }
          });
        
        // Wait for all folder stats to be calculated
        await Promise.all(folderStatsPromises);
      }

      setFiles(fileList);
      setFolders(Array.from(folderMap.values()));
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
          // A file is directly in this folder if its relative_path exactly equals the folder path
          // Do NOT include files in subfolders (those have relative_path starting with `${folderPath}/...`)
          return path === currentFolder;
        }
      });
    }

    return result;
  }, [files, activeTab, searchQuery, currentFolder]);

  // Get subfolders for the current folder to show in main content - Optimized
  const currentFolderSubfolders = useMemo(() => {
    if (searchQuery) return [];
    
    let result;
    if (currentFolder === 'root') {
      result = folders.filter(f => f.parent === 'root');
    } else {
      result = folders.filter(f => f.parent === currentFolder);
    }
    
    return result;
  }, [folders, currentFolder, searchQuery]);

  // selectAll defined here after filteredFiles and currentFolderSubfolders
  const selectAll = useCallback(() => {
    const allFileIds = new Set(filteredFiles.map(f => f.id));
    const allFolderPaths = new Set(currentFolderSubfolders.map(f => f.path));
    setSelectedFiles(allFileIds);
    setSelectedFolders(allFolderPaths);
  }, [filteredFiles, currentFolderSubfolders]);

  // Handle folder toggle - memoized
  const handleFolderToggle = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

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
        <FileGridToolbar
          currentFolder={currentFolder}
          onFolderSelect={(path) => {
            setCurrentFolder(path);
            onFolderSelect?.(path);
          }}
          showFolderDetails={showFolderDetails}
          setShowFolderDetails={setShowFolderDetails}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setShowUploadArea={setShowUploadArea}
          hasUploadOperations={hasUploadOperations}
          onCreateFolder={useCallback(async () => {
                      const folderName = prompt('Enter folder name:');
                      if (folderName && folderName.trim()) {
                        try {
                          const response = await mediaAPI.createFolder(folderName.trim(), currentFolder === 'root' ? '' : currentFolder);
                          alert(`Folder "${folderName.trim()}" created successfully!`);
                          // Refresh the file list to show the new folder
                await loadFiles(true);
                        } catch (error) {
                          const errorMessage = error.response?.data?.error || 'Failed to create folder';
                          alert(`Error: ${errorMessage}`);
                        }
                      }
          }, [currentFolder])}
          getSelectedCount={getSelectedCount}
          filteredFiles={filteredFiles}
          currentFolderSubfolders={currentFolderSubfolders}
          selectAll={selectAll}
          clearSelection={clearSelection}
          onRefresh={loadFiles}
          handleBulkDownload={handleBulkDownload}
          handleBulkHibernate={handleBulkHibernate}
          handleBulkWakeUp={handleBulkWakeUp}
          handleBulkDelete={handleBulkDelete}
        />

        {/* Global Compact Upload Progress - Memoized for Performance */}
        <UploadProgressBar uploadManagerState={uploadManagerState} files={files} />

        {/* Enhanced Delete Progress */}
        <BulkOperationProgress 
          uploadManagerState={uploadManagerState}
          bulkOperationStatus={bulkOperationStatus}
          bulkOperationType={bulkOperationType}
        />

        {/* File Grid/List or Upload Area */}
      <Box sx={{ flex: 1, overflow: 'auto', pt: { xs: 2, md: 3 }, pr: { xs: 2, md: 2 }, pb: { xs: 2, md: 3 }, pl: { xs: 2, md: 3 } }}>
          {/* Status Summary */}
          <FileStatusSummary 
            filteredFiles={filteredFiles}
            encryptionEnabled={encryptionEnabled}
          />

          {showUploadArea ? (
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
                  loadFiles(true); // Refresh the file list with cache busting
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
          ) : null}
          
          {!showUploadArea && loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
<LinearProgress sx={{ width: '50%' }} />
            </Box>
          ) : !showUploadArea ? (
            <FileGrid
              currentFolderSubfolders={currentFolderSubfolders}
              filteredFiles={filteredFiles}
              selectedFolders={selectedFolders}
              selectedFiles={selectedFiles}
              toggleFolderSelection={toggleFolderSelection}
              toggleFileSelection={toggleFileSelection}
              onFolderClick={(path) => {
                setCurrentFolder(path);
                onFolderSelect?.(path);
              }}
              onFileClick={(file) => {
                          setSelectedFile(file);
                          onFileSelect?.(file, 'view');
                        }}
              handleFolderToggle={handleFolderToggle}
              formatFileSize={formatFileSize}
              getFolderStatus={getFolderStatus}
            />
          ) : null}
        </Box>
      </Box>

      {/* Right Info Panel (if file selected) */}
      <FileDetailsPanel
        selectedFile={selectedFile}
        onClose={() => setSelectedFile(null)}
        formatFileSize={formatFileSize}
        formatDate={formatDate}
        handleDownload={handleDownload}
        handleArchive={handleArchive}
        handleRestore={async (file) => {
          await mediaAPI.restoreFile(file.id, 'Standard');
          await loadFiles(true);
        }}
        handleDelete={handleDelete}
        loadFiles={loadFiles}
        uploadManagerState={uploadManagerState}
      />

      {/* Right Folder Details Drawer (when inside a folder) */}
      <FolderDetailsDrawer
        open={showFolderDetails && !selectedFile}
        onClose={() => setShowFolderDetails(false)}
        currentFolder={currentFolder}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteDialog.open}
        count={bulkDeleteDialog.count}
        onClose={() => setBulkDeleteDialog({ open: false, count: 0 })}
        onConfirm={confirmBulkDelete}
      />
      
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

