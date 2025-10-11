import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  Button,
  Paper,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Alert
} from '../utils/muiImports';
import {
  Storage,
  CloudUpload,
  AcUnit,
  Speed,
  Security,
  Info,
  Refresh,
  CheckCircle,
  Warning
} from '../utils/muiImports';
import { hibernationAPI } from '../services/api';
import { formatFileSizeInGB, formatDate } from '../utils/formatters';

const SimplifiedOverview = () => {
  const [currentPlan, setCurrentPlan] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [planResponse, usageResponse] = await Promise.all([
        hibernationAPI.getCurrentPlan(),
        hibernationAPI.getUsageStats()
      ]);

      setCurrentPlan(planResponse.data);
      setUsageStats(usageResponse.data);
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  const getPlanInfo = () => {
    if (!currentPlan || !currentPlan.plan) {
      return {
        name: 'Free Tier',
        storage: '15 GB',
        color: 'info',
        icon: <Storage />,
        description: 'Free storage allowance'
      };
    }

    const plan = currentPlan.plan;
    const tierMap = {
      '100gb': { storage: '100 GB', color: 'success' },
      '500gb': { storage: '500 GB', color: 'warning' },
      '1tb': { storage: '1 TB', color: 'error' }
    };

    const tierInfo = tierMap[plan.storage_tier] || { storage: 'Unknown', color: 'default' };

    return {
      name: plan.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      storage: tierInfo.storage,
      color: tierInfo.color,
      icon: <AcUnit />,
      description: plan.description
    };
  };

  const getUsagePercentage = () => {
    if (!usageStats) return 0;
    
    const usedGB = usageStats.total_storage_bytes / (1024 ** 3);
    const limitGB = currentPlan && currentPlan.plan ? 
      (currentPlan.plan.storage_tier === '100gb' ? 100 : 
       currentPlan.plan.storage_tier === '500gb' ? 500 : 1024) : 15;
    
    return Math.min((usedGB / limitGB) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
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
        <Button color="inherit" size="small" onClick={loadOverviewData}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  const planInfo = getPlanInfo();
  const usagePercentage = getUsagePercentage();
  const usageColor = getUsageColor();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Storage Overview
        </Typography>
        <IconButton onClick={loadOverviewData} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Current Plan Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                {planInfo.icon}
                <Typography variant="h6" ml={1}>
                  Current Plan
                </Typography>
              </Box>
              
              <Chip 
                label={planInfo.name} 
                color={planInfo.color} 
                size="large" 
                sx={{ mb: 2 }}
              />
              
              <Typography variant="h4" color="primary" mb={1}>
                {planInfo.storage}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" mb={2}>
                {planInfo.description}
              </Typography>

              {currentPlan && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Expires: {formatDate(currentPlan.expires_at)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Usage Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CloudUpload />
                <Typography variant="h6" ml={1}>
                  Storage Usage
                </Typography>
              </Box>
              
              <Typography variant="h4" color="primary" mb={1}>
                {formatFileSizeInGB(usageStats?.total_storage_bytes || 0)}
              </Typography>
              
              <LinearProgress 
                variant="determinate" 
                value={usagePercentage} 
                color={usageColor}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />
              
              <Typography variant="body2" color="text.secondary">
                {usagePercentage.toFixed(1)}% of {planInfo.storage} used
              </Typography>

              {usageStats && (
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary">
                    {usageStats.file_count} files stored
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>
              Quick Actions
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<CloudUpload />}
                  onClick={() => window.location.href = '/hibernate'}
                >
                  Upload Files
                </Button>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AcUnit />}
                  onClick={() => window.location.href = '/hibernate'}
                >
                  Manage Files
                </Button>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Storage />}
                  onClick={() => window.location.href = '/plans'}
                >
                  View Plans
                </Button>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Storage />}
                  onClick={() => window.location.href = '/analytics'}
                >
                  View Analytics
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Plan Recommendations */}
        {!currentPlan && usagePercentage > 50 && (
          <Grid item xs={12}>
            <Alert 
              severity="warning" 
              action={
                <Button color="inherit" size="small" onClick={() => window.location.href = '/plans'}>
                  View Plans
                </Button>
              }
            >
              <Typography variant="body2">
                You're using {usagePercentage.toFixed(1)}% of your free storage. 
                Consider upgrading to a hibernation plan for more space and features.
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default SimplifiedOverview;
