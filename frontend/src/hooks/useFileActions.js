import { useState } from 'react';
import { mediaAPI } from '../services/api';
import { RESTORE_TIERS } from '../constants/fileStates';
import encryptionService from '../services/encryptionService';

/**
 * Shared hook for file actions (download, archive, restore, delete)
 * Eliminates code duplication across components
 */
export const useFileActions = (onRefresh, forceRefresh = false) => {
  const [loading, setLoading] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);

  // Handle download with optional decryption
  const handleDownload = async (file) => {
    try {
      const response = await mediaAPI.downloadFile(file.id);
      const { download_url, filename, file_size, is_encrypted, encryption_metadata } = response.data;
      
      // Show download progress dialog
      setDownloadInfo({
        filename,
        file_size,
        is_encrypted,
        encryption_metadata
      });
      setDownloadDialogOpen(true);
      
      // Download the file from the presigned URL
      const fileResponse = await fetch(download_url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }
      
      const fileBlob = await fileResponse.blob();
      let finalBlob = fileBlob;
      let finalFilename = filename;
      
      // Decrypt file if it's encrypted and encryption is enabled
      if (is_encrypted && encryption_metadata && encryptionService.isEnabled()) {
        try {
          // Create a File object from the blob
          const encryptedFile = new File([fileBlob], filename, { type: fileBlob.type });
          
          // Decrypt the file
          const decryptedFile = await encryptionService.decryptFileAfterDownload(
            encryptedFile,
            encryption_metadata,
            (progress, status) => {
              // Progress callback
            }
          );
          
          finalBlob = decryptedFile;
          finalFilename = decryptedFile.name;
          
        } catch (decryptionError) {
          console.error(`Decryption failed for ${filename}:`, decryptionError);
          throw new Error(`Decryption failed: ${decryptionError.message}`);
        }
      } else if (is_encrypted && !encryptionService.isEnabled()) {
        throw new Error('File is encrypted but encryption service is not enabled. Please set up your master password first.');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      // Close dialog after successful download
      setDownloadDialogOpen(false);
      
      const encryptionStatus = is_encrypted ? ' (decrypted)' : '';
      return { success: true, message: `Download started for ${finalFilename}${encryptionStatus}` };
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadDialogOpen(false);
      throw error;
    }
  };

  // Handle archive
  const handleArchive = async (file) => {
    try {
      // Check if file is already archived or in a transitional state
      if (file.status === 'archived') {
        return { success: false, message: `File is already hibernated ❄️` };
      }
      if (file.status === 'archiving') {
        return { success: false, message: `File is already hibernating... 🌙` };
      }
      if (file.status !== 'uploaded' && file.status !== 'restored') {
        return { success: false, message: `Cannot hibernate file in ${file.status} state` };
      }

      await mediaAPI.archiveFile(file.id);
      return { success: true, message: `❄️ ${file.original_filename} is now hibernating!` };
    } catch (error) {
      console.error('Archive failed:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Archive failed';
      alert(`Failed to hibernate file: ${errorMessage}`);
      throw error;
    }
  };

  // Handle restore with thematic dialog
  const handleRestore = async (file) => {
    setRestoreFile(file);
    setRestoreDialogOpen(true);
    return { success: true, message: 'Restore dialog opened' };
  };

  // Confirm restore with selected tier
  const handleConfirmRestore = async (restoreTier) => {
    try {
      const response = await mediaAPI.restoreFile(restoreFile.id, restoreTier);
      
      const tierInfo = RESTORE_TIERS[restoreTier.toUpperCase()];
      const message = `🌅 Wake-up initiated! Your file will be ready in ${tierInfo.time}.`;
      
      setRestoreDialogOpen(false);
      setRestoreFile(null);
      
      if (onRefresh) {
        await onRefresh();
      }
      
      return { success: true, message };
    } catch (error) {
      console.error('Error restoring file:', error);
      throw error;
    }
  };

  // Handle delete
  const handleDelete = async (file, skipConfirmation = false) => {
    if (!skipConfirmation) {
      const confirmed = window.confirm(
        `🗑️ Delete "${file.original_filename}"?\n\n` +
        `This will permanently delete the file from:\n` +
        `• Database records\n` +
        `• S3 storage\n` +
        `• Glacier archives (if any)\n\n` +
        `This action cannot be undone.`
      );
      
      if (!confirmed) {
        return { success: false, message: 'Delete cancelled' };
      }
    }
    
    try {
      await mediaAPI.deleteFile(file.id);
      
      if (onRefresh) {
        await onRefresh();
      }
      
      return { success: true, message: `🗑️ ${file.original_filename} deleted successfully` };
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action, files) => {
    
    try {
      setLoading(true);
      
      switch (action) {
        case 'archive':
          await Promise.all(files.map(file => mediaAPI.archiveFile(file.id)));
          break;
        case 'restore':
          await Promise.all(files.map(file => mediaAPI.restoreFile(file.id, 'Standard')));
          break;
        case 'download':
          // Download files one by one
          for (const file of files) {
            await handleDownload(file);
          }
          break;
        case 'delete':
          // Show confirmation for bulk delete
          const confirmed = window.confirm(
            `Are you sure you want to delete ${files.length} files?\n\n` +
            `This will permanently delete all selected files from:\n` +
            `• Database records\n` +
            `• S3 storage\n` +
            `• Glacier archives (if any)\n\n` +
            `This action cannot be undone.`
          );
          
          if (confirmed) {
            // Delete files without individual confirmations
            await Promise.all(files.map(file => handleDelete(file, true)));
          }
          break;
        default:
          console.warn('Unknown bulk action:', action);
      }
      
      // Refresh files after bulk action
      if (onRefresh) {
        await onRefresh(forceRefresh);
      }
      
      return { success: true, message: `Bulk ${action} completed` };
      
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Handle hibernation suggestion
  const handleHibernationSuggestion = async (file) => {
    try {
      await mediaAPI.archiveFile(file.id);
      const message = `❄️ ${file.original_filename} is now hibernating! You'll save money on storage costs.`;
      
      if (onRefresh) {
        await onRefresh(forceRefresh);
      }
      
      return { success: true, message };
    } catch (error) {
      console.error('Error hibernating file:', error);
      throw error;
    }
  };

  // Generic file action handler
  const handleFileAction = async (file, action) => {
    try {
      setLoading(true);
      
      let result;
      switch (action) {
        case 'download':
          result = await handleDownload(file);
          break;
        case 'archive':
          result = await handleArchive(file);
          break;
        case 'restore':
          result = await handleRestore(file);
          break;
        case 'delete':
          result = await handleDelete(file);
          break;
        default:
          console.warn('Unknown action:', action);
          result = { success: false, message: `Unknown action: ${action}` };
      }
      
      return result;
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    restoreDialogOpen,
    restoreFile,
    setRestoreDialogOpen,
    setRestoreFile,
    downloadDialogOpen,
    downloadInfo,
    setDownloadDialogOpen,
    setDownloadInfo,
    handleDownload,
    handleArchive,
    handleRestore,
    handleConfirmRestore,
    handleDelete,
    handleBulkAction,
    handleHibernationSuggestion,
    handleFileAction
  };
};
