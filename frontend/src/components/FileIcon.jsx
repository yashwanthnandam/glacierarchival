import React from 'react';
import {
  InsertDriveFile,
  Image,
  VideoFile,
  AudioFile,
  Description,
  Code,
  Archive as ArchiveIcon,
  Folder,
  FolderOpen
} from '@mui/icons-material';

/**
 * Shared component for file and folder icons
 * Eliminates duplicate icon logic across components
 */
export const FileIcon = ({ file, isFolder = false, isOpen = false, size = 'medium' }) => {
  if (isFolder) {
    return isOpen ? <FolderOpen fontSize={size} /> : <Folder fontSize={size} />;
  }

  if (!file) {
    return <InsertDriveFile fontSize={size} />;
  }

  const { file_type, original_filename } = file;
  const filename = original_filename || '';
  const extension = filename.split('.').pop()?.toLowerCase() || '';

  // Image files
  if (file_type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
    return <Image fontSize={size} color="primary" />;
  }

  // Video files
  if (file_type?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
    return <VideoFile fontSize={size} color="secondary" />;
  }

  // Audio files
  if (file_type?.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(extension)) {
    return <AudioFile fontSize={size} color="success" />;
  }

  // Archive files
  if (file_type?.includes('zip') || file_type?.includes('archive') || 
      ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
    return <ArchiveIcon fontSize={size} color="warning" />;
  }

  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'html', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml'].includes(extension)) {
    return <Code fontSize={size} color="info" />;
  }

  // Document files
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(extension)) {
    return <Description fontSize={size} color="action" />;
  }

  // Default file icon
  return <InsertDriveFile fontSize={size} />;
};

export default FileIcon;
