import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  IconButton,
  Alert,
  Button
} from '../utils/muiImports';
import {
  Storage,
  Security,
  Refresh,
  Info,
  CheckCircle,
  Warning
} from '../utils/muiImports';
import { hibernationAPI } from '../services/api';
import { formatFileSizeInGB, formatDate } from '../utils/formatters';

const SimplifiedAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [planResponse, usageResponse] = await Promise.all([
        hibernationAPI.getCurrentPlan(),
        hibernationAPI.getUsageStats()
      ]);

      setCurrentPlan(planResponse.data);
      setAnalyticsData({
        usage: usageResponse.data
      });
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <LinearProgress sx={{ width: '100%', maxWidth: 400 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadAnalyticsData}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Storage Analytics
        </Typography>
        <IconButton onClick={loadAnalyticsData} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Storage Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Storage Summary
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h4" color="primary">
                    {formatFileSizeInGB(analyticsData?.usage?.total_storage_bytes || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Storage Used
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="h6">
                    {analyticsData?.usage?.file_count || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Files
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Plan Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Plan Information
              </Typography>
              
              {currentPlan && currentPlan.plan ? (
                <Stack spacing={2}>
                  <Box>
                    <Chip 
                      label={currentPlan.plan.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                      color="primary" 
                      size="small"
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Storage Tier
                    </Typography>
                    <Typography variant="body1">
                      {currentPlan.plan.storage_tier.toUpperCase()}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Expires
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(currentPlan.expires_at)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={currentPlan.is_active ? 'Active' : 'Inactive'} 
                      color={currentPlan.is_active ? 'success' : 'error'} 
                      size="small"
                    />
                  </Box>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Box>
                    <Chip label="Free Tier" color="info" size="small" />
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Storage Limit
                    </Typography>
                    <Typography variant="body1">15 GB</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Usage
                    </Typography>
                    <Typography variant="body1">
                      {formatFileSizeInGB(analyticsData?.usage?.total_storage_bytes || 0)} / 15 GB
                    </Typography>
                  </Box>
                  
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => window.location.href = '/plans'}
                  >
                    Upgrade Plan
                  </Button>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recommendations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="h6" mb={1}>
              Recommendations
            </Typography>
            
            <Stack spacing={2}>
              {!currentPlan || !currentPlan.plan ? (
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    Upgrade to a Hibernation Plan
                  </Typography>
                  <Typography variant="body2">
                    Get unlimited storage, advanced archiving features, and priority support. 
                    Choose from Deep Freeze, Smart Hibernate, or Quick Hibernate plans.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    Active Plan: {currentPlan.plan.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Typography variant="body2">
                    You're all set with {currentPlan.plan.storage_tier.toUpperCase()} storage. 
                    Your plan expires on {formatDate(currentPlan.expires_at)}.
                  </Typography>
                </Alert>
              )}
              
              {analyticsData?.usage?.total_storage_bytes > 5 * 1024 * 1024 * 1024 && (
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    Storage Usage Alert
                  </Typography>
                  <Typography variant="body2">
                    You have {formatFileSizeInGB(analyticsData.usage.total_storage_bytes)} of data stored. 
                    Consider archiving older files to optimize your storage.
                  </Typography>
                </Alert>
              )}
              
              <Alert severity="info" icon={<Security />}>
                <Typography variant="body2" fontWeight="bold" mb={1}>
                  Data Security
                </Typography>
                <Typography variant="body2">
                  All your files are encrypted and stored securely in AWS Glacier. 
                  Your data is protected with enterprise-grade security.
                </Typography>
              </Alert>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimplifiedAnalytics;
