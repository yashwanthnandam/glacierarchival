import React, { useState, useEffect } from 'react';
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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Save, Cloud } from '@mui/icons-material';
import { s3ConfigAPI } from '../services/api';

const S3Config = ({ open, onClose, onSaveSuccess }) => {
  const [formData, setFormData] = useState({
    bucket_name: 'glacier-archival-bucket',
    aws_access_key: '',
    aws_secret_key: '',
    region: 'us-east-1'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-west-2',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'sa-east-1'
  ];

  useEffect(() => {
    if (open) {
      fetchExistingConfig();
    }
  }, [open]);

  const fetchExistingConfig = async () => {
    try {
      const response = await s3ConfigAPI.getConfig();
      if (response.data && response.data.length > 0) {
        const config = response.data[0];
        setFormData({
          bucket_name: config.bucket_name || '',
          aws_access_key: config.aws_access_key || '',
          aws_secret_key: config.aws_secret_key || '',
          region: config.region || 'us-east-1'
        });
      }
    } catch (error) {
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await s3ConfigAPI.saveConfig(formData);
      setSuccess('S3 configuration saved successfully!');
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save S3 configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      bucket_name: 'glacier-archival-bucket',
      aws_access_key: '',
      aws_secret_key: '',
      region: 'us-east-1'
    });
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Cloud />
          S3 Configuration
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="S3 Bucket Name"
                name="bucket_name"
                value={formData.bucket_name}
                onChange={handleChange}
                required
                helperText="The name of your S3 bucket for storing archived files"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="AWS Access Key ID"
                name="aws_access_key"
                value={formData.aws_access_key}
                onChange={handleChange}
                required
                helperText="Your AWS access key ID"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="AWS Secret Access Key"
                name="aws_secret_key"
                type="password"
                value={formData.aws_secret_key}
                onChange={handleChange}
                required
                helperText="Your AWS secret access key"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>AWS Region</InputLabel>
                <Select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  label="AWS Region"
                >
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>
                      {region}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Note:</strong> Your AWS credentials will be stored securely and used only for 
              archiving and restoring files to your S3 bucket. Make sure your AWS user has the 
              necessary permissions for S3 operations.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<Save />}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default S3Config;