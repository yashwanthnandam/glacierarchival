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
      '100gb': { storage: '100 GB', color: 'primary' },
      '500gb': { storage: '500 GB', color: 'warning' },
      '1tb': { storage: '1 TB', color: 'error' }
    };

    const tierInfo = tierMap[plan.storage_tier] || { storage: 'Unknown', color: 'primary' };

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
    
    // Handle both API response formats
    const usedBytes = 
      usageStats.current_storage?.bytes ??
      usageStats.storage_used_bytes ??
      usageStats.total_storage_bytes ??
      0;
    const usedGB = usedBytes / (1024 ** 3);
    const limitGB = currentPlan && currentPlan.plan ? 
      (currentPlan.plan.storage_tier === '100gb' ? 100 : 
       currentPlan.plan.storage_tier === '500gb' ? 500 : 1024) : 15;
    
    return Math.min((usedGB / limitGB) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'primary';
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
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>
          Storage Overview
        </Typography>
        <IconButton 
          onClick={loadOverviewData} 
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'grey.100',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'grey.200',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
          }}
        >
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {/* Current Plan Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%', 
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              transform: 'translateY(-2px)',
            }
          }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  mr: 2
                }}>
                  {planInfo.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Current Plan
                </Typography>
              </Box>
              
              <Chip 
                label={planInfo.name} 
                color={planInfo.color} 
                size="large" 
                sx={{ 
                  mb: 3,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  height: 32
                }}
              />
              
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h3" sx={{ 
                  fontWeight: 800, 
                  color: 'text.primary', 
                  mb: 2
                }}>
                  {planInfo.storage}
                </Typography>
                
                <Typography variant="body1" sx={{ 
                  color: 'text.secondary', 
                  mb: 3,
                  lineHeight: 1.6
                }}>
                  {planInfo.description}
                </Typography>
              </Box>

              {currentPlan && (
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <Typography variant="caption" sx={{ 
                    color: 'text.secondary',
                    fontWeight: 500
                  }}>
                    Expires: {formatDate(currentPlan.expires_at)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Usage Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%', 
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              transform: 'translateY(-2px)',
            }
          }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  mr: 2
                }}>
                  <CloudUpload />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Storage Usage
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h3" sx={{ 
                  fontWeight: 800, 
                  color: 'text.primary', 
                  mb: 2
                }}>
                  {formatFileSizeInGB(
                    (usageStats?.current_storage?.bytes ??
                     usageStats?.storage_used_bytes ??
                     usageStats?.total_storage_bytes ?? 0)
                  )}
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={usagePercentage} 
                    color={usageColor}
                    sx={{ 
                      height: 10, 
                      borderRadius: 5, 
                      mb: 2,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                      }
                    }}
                  />
                  
                  <Typography variant="body1" sx={{ 
                    color: 'text.secondary',
                    fontWeight: 500
                  }}>
                    {usagePercentage.toFixed(1)}% of {planInfo.storage} used
                  </Typography>
                </Box>
              </Box>

              {usageStats && (
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <Typography variant="caption" sx={{ 
                    color: 'text.secondary',
                    fontWeight: 500
                  }}>
                    {(
                      usageStats.current_storage?.gb ??
                      usageStats.storage_used_gb ?? 0
                    ).toFixed(1)} GB stored
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Status Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            height: '100%', 
            borderRadius: 3,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            '&:hover': {
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              transform: 'translateY(-2px)',
            }
          }}>
            <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'grey.100',
                  color: 'text.secondary',
                  mr: 2
                }}>
                  <Security />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Account Status
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box sx={{ mb: 3 }}>
                  <Box display="flex" alignItems="center" mb={2}>
                    <CheckCircle sx={{ color: 'text.secondary', mr: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Storage Active
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" mb={2}>
                    <CheckCircle sx={{ color: 'text.secondary', mr: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Encryption Enabled
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center">
                    <CheckCircle sx={{ color: 'text.secondary', mr: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Backup Secure
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.50', 
                borderRadius: 2,
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <Typography variant="caption" sx={{ 
                  color: 'text.secondary',
                  fontWeight: 600
                }}>
                  ✓ All systems operational
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
              Quick Actions
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<CloudUpload />}
                  onClick={() => window.location.href = '/upload'}
                  sx={{
                    py: 2,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Upload Files
                </Button>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AcUnit />}
                  onClick={() => {
                    // Navigate to dashboard with hibernate tab selected using hash
                    window.location.href = '/dashboard#hibernate';
                  }}
                  sx={{
                    py: 2,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Manage Files
                </Button>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Storage />}
                  onClick={() => window.location.href = '/plans'}
                  sx={{
                    py: 2,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  View Plans
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
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)',
              }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => window.location.href = '/plans'}
                  sx={{
                    fontWeight: 600,
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                  }}
                >
                  View Plans
                </Button>
              }
            >
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
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
