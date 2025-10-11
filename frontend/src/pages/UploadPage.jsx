import React, { useState, useEffect } from 'react';
import { Box, Alert, Typography, Chip } from '@mui/material';
import { Lock, LockOpen } from '@mui/icons-material';
import DirectoryUploader from '../components/DirectoryUploader';
import encryptionService from '../services/encryptionService';

const UploadPage = () => {
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);

  // Check encryption status
  useEffect(() => {
    const checkEncryptionStatus = () => {
      const status = encryptionService.getEncryptionStatus();
      setEncryptionEnabled(status.enabled);
    };
    
    checkEncryptionStatus();
    
    // Listen for encryption status changes
    const interval = setInterval(checkEncryptionStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUploadComplete = (results) => {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    alert(`Upload completed! ${successful.length} files uploaded successfully, ${failed.length} failed.`);
  };

  const handleUploadProgress = (percentage, fileName) => {
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Data Hibernate Platform
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Upload your files directly to S3
          </p>
          
          {/* Encryption Status */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            {encryptionEnabled ? (
              <Chip
                icon={<Lock />}
                label="E2E Encryption Enabled"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            ) : (
              <Chip
                icon={<LockOpen />}
                label="E2E Encryption Disabled"
                color="default"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
          
          {!encryptionEnabled && (
            <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
              <Typography variant="body2">
                <strong>🔓 E2E Encryption Disabled</strong><br/>
                Files will be uploaded without encryption. Enable E2E encryption from the dashboard for maximum security.
              </Typography>
            </Alert>
          )}
        </div>
        
        <DirectoryUploader 
          onUploadComplete={handleUploadComplete}
          onUploadProgress={handleUploadProgress}
        />
      </div>
    </div>
  );
};

export default UploadPage;
