import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputAdornment,
  LinearProgress,
  Chip
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, Security, CheckCircle, Error } from '@mui/icons-material';
import encryptionService from '../services/encryptionService';

const MasterPasswordDialog = ({ open, onClose, onPasswordSet }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initStatus, setInitStatus] = useState('');
  const [testResult, setTestResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTestResult(null);

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsInitializing(true);
    setInitProgress(0);
    setInitStatus('Initializing encryption...');

    try {
      // Initialize encryption service
      setInitProgress(25);
      setInitStatus('Setting up encryption keys...');
      
      await encryptionService.initializeEncryption(password);
      
      setInitProgress(50);
      setInitStatus('Testing encryption...');
      
      // Test encryption to ensure it works
      const testResult = await encryptionService.testEncryption();
      setTestResult(testResult);
      
      if (!testResult.success) {
        throw new Error(testResult.error || 'Encryption test failed');
      }
      
      setInitProgress(75);
      setInitStatus('Finalizing setup...');
      
      // Store password securely if requested
      if (rememberPassword) {
        // Note: In production, use a more secure method
        localStorage.setItem('encryption_enabled', 'true');
        localStorage.setItem('encryption_initialized', Date.now().toString());
      }
      
      setInitProgress(100);
      setInitStatus('Encryption ready!');
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onPasswordSet(password);
      setPassword('');
      setConfirmPassword('');
      onClose();
      
    } catch (error) {
      console.error('Encryption initialization failed:', error);
      setError(`Encryption setup failed: ${error.message}`);
      encryptionService.disableEncryption();
    } finally {
      setIsInitializing(false);
      setInitProgress(0);
      setInitStatus('');
    }
  };

  const handleClose = () => {
    if (!isInitializing) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      setTestResult(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Security color="primary" />
          <Typography variant="h6">Set Master Password</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            🔒 True End-to-End Encryption
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Your master password encrypts all files using <strong>AES-GCM 256-bit encryption</strong> before upload. 
            Only you can decrypt them - not even we can access your files.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip label="AES-GCM 256-bit" size="small" color="primary" />
            <Chip label="PBKDF2 (100k iterations)" size="small" color="primary" />
            <Chip label="Zero-Knowledge" size="small" color="primary" />
            <Chip label="Open Source" size="small" color="success" />
          </Box>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            Choose a strong password and keep it safe - it cannot be recovered if lost.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {testResult && (
          <Alert 
            severity={testResult.success ? "success" : "error"} 
            sx={{ mb: 2 }}
            icon={testResult.success ? <CheckCircle /> : <Error />}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {testResult.success ? '✅ Encryption Test Passed' : '❌ Encryption Test Failed'}
            </Typography>
            <Typography variant="body2">
              {testResult.message}
            </Typography>
            {testResult.success && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Duration: {testResult.duration}ms | 
                Compression: {testResult.compressionRatio}x
              </Typography>
            )}
          </Alert>
        )}

        {isInitializing && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {initStatus}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={initProgress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Master Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText="Minimum 8 characters, used to derive encryption keys"
            disabled={isInitializing}
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            disabled={isInitializing}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                disabled={isInitializing}
              />
            }
            label="Remember password for this session (not recommended for shared devices)"
            sx={{ mt: 2 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isInitializing}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={!password || !confirmPassword || isInitializing}
          startIcon={isInitializing ? <Security /> : <Lock />}
        >
          {isInitializing ? 'Setting Up Encryption...' : 'Enable E2E Encryption'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MasterPasswordDialog;
