import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  LinearProgress,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
} from '@mui/material';
import {
  Storage,
  Speed,
  Schedule,
  Security,
  TrendingUp,
  Info,
  Settings,
  Refresh,
  AcUnit,
  WbSunny,
  CloudQueue,
  CheckCircle,
} from '@mui/icons-material';
import { hibernationAPI } from '../services/api';
import HibernationPlans from './HibernationPlans';

const HibernationPlanDashboard = () => {
  const theme = useTheme();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlansDialog, setShowPlansDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlanData();
  }, []);

  const loadPlanData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load current plan and usage stats in parallel
      const [planResponse, statsResponse] = await Promise.allSettled([
        hibernationAPI.getCurrentPlan().catch(err => {
          if (err.response?.status === 404) {
            return { data: null }; // No active plan
          }
          throw err;
        }),
        hibernationAPI.getUsageStats(), // This now returns free tier data instead of 404
      ]);

      if (planResponse.status === 'fulfilled') {
        const planData = planResponse.value.data;
        // Check if this is free tier data (has is_free_tier property)
        if (planData && planData.is_free_tier) {
          setCurrentPlan(null); // No active plan for free tier
        } else {
          setCurrentPlan(planData);
        }
      } else if (planResponse.status === 'rejected') {
        console.error('Error loading current plan:', planResponse.reason);
        setCurrentPlan(null);
      }

      if (statsResponse.status === 'fulfilled') {
        setUsageStats(statsResponse.value.data);
      } else if (statsResponse.status === 'rejected') {
        console.error('Error loading usage stats:', statsResponse.reason);
        setUsageStats(null);
      }
    } catch (err) {
      console.error('Error loading plan data:', err);
      setError('Failed to load plan information');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPlanData();
    setRefreshing(false);
  };

  const handlePlanSelect = (plan) => {
    setCurrentPlan({ plan });
    setShowPlansDialog(false);
    loadPlanData(); // Refresh data
  };

  const getPlanIcon = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return <AcUnit sx={{ fontSize: 32, color: '#94a3b8' }} />;
      case 'flexible_archive':
        return <CloudQueue sx={{ fontSize: 32, color: '#60a5fa' }} />;
      case 'instant_archive':
        return <Speed sx={{ fontSize: 32, color: '#34d399' }} />;
      default:
        return <Storage sx={{ fontSize: 32 }} />;
    }
  };

  const getPlanColor = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return '#94a3b8';
      case 'flexible_archive':
        return '#60a5fa';
      case 'instant_archive':
        return '#34d399';
      default:
        return theme.palette.primary.main;
    }
  };

  const getPlanTitle = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return '🌙 Hibernate (Deep Freeze Tier)';
      case 'flexible_archive':
        return '🌤️ Smart Hibernate (Flexible Archive Tier)';
      case 'instant_archive':
        return '⚡ Quick Hibernate (Instant Archive Tier)';
      default:
        return 'Hibernation Plan';
    }
  };

  const formatStorageSize = (bytes) => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1000) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  const formatBytes = (bytes) => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1000) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!currentPlan) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, textAlign: 'center', fontWeight: 700 }}>
          Storage Dashboard
        </Typography>
        
        {/* Free Tier Usage */}
        {usageStats?.is_free_tier && (
          <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 2, border: '2px solid #6b7280', bgcolor: 'rgba(107, 114, 128, 0.05)' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Storage sx={{ fontSize: 40, color: '#6b7280' }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#6b7280' }}>
                    Free Tier - 15GB
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Upload and manage files up to 15GB for free
                  </Typography>
                </Box>
              </Stack>
              <Chip
                label="Free Tier"
                color="primary"
                icon={<CheckCircle />}
                sx={{ fontSize: '1rem', height: 32, px: 1 }}
              />
            </Stack>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Storage Usage</Typography>
                <Stack spacing={1}>
                  <Typography variant="body1">
                    Used: <strong>{usageStats?.storage_used_gb || 0} GB</strong> / {usageStats?.storage_limit_gb || 15} GB
                  </Typography>
                  <Typography variant="body1">
                    Percentage: <strong>{usageStats?.storage_used_percentage || 0}%</strong>
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Storage Usage
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={usageStats?.storage_used_percentage || 0} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(107, 114, 128, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#6b7280'
                        }
                      }} 
                    />
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Upgrade Options</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    • Up to 1TB storage capacity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Advanced hibernation features
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Priority support
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Cost-effective archival storage
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
            
            <Box mt={4} display="flex" justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowPlansDialog(true)}
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 600, 
                  px: 4, 
                  py: 1.5,
                  bgcolor: '#6b7280',
                  '&:hover': { bgcolor: '#4b5563' }
                }}
              >
                Upgrade to Hibernation Plan
              </Button>
            </Box>
          </Paper>
        )}

        {!usageStats?.is_free_tier && (
          <Alert severity="info" sx={{ mb: 3 }}>
            You don't have an active hibernation plan. Choose a plan to start storing your data efficiently.
          </Alert>
        )}

        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setShowPlansDialog(true)}
            sx={{ textTransform: 'none', fontWeight: 600, px: 4, py: 1.5 }}
          >
            View Available Plans
          </Button>
        </Box>

        <Dialog
          open={showPlansDialog}
          onClose={() => setShowPlansDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Choose Your Hibernation Plan</DialogTitle>
          <DialogContent>
            <HibernationPlans
              onPlanSelect={handlePlanSelect}
              onClose={() => setShowPlansDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Handle case where currentPlan might be null or undefined
  if (!currentPlan) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, textAlign: 'center', fontWeight: 700 }}>
          Storage Dashboard
        </Typography>
        
        {/* Free Tier Usage */}
        {usageStats?.is_free_tier && (
          <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 2, border: '2px solid #6b7280', bgcolor: 'rgba(107, 114, 128, 0.05)' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Storage sx={{ fontSize: 40, color: '#6b7280' }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#6b7280' }}>
                    Free Tier - 15GB
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Upload and manage files up to 15GB for free
                  </Typography>
                </Box>
              </Stack>
              <Chip
                label="Free Tier"
                color="primary"
                icon={<CheckCircle />}
                sx={{ fontSize: '1rem', height: 32, px: 1 }}
              />
            </Stack>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Storage Usage</Typography>
                <Stack spacing={1}>
                  <Typography variant="body1">
                    Used: <strong>{usageStats?.storage_used_gb || 0} GB</strong> / {usageStats?.storage_limit_gb || 15} GB
                  </Typography>
                  <Typography variant="body1">
                    Percentage: <strong>{usageStats?.storage_used_percentage || 0}%</strong>
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Storage Usage
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={usageStats?.storage_used_percentage || 0} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'rgba(107, 114, 128, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#6b7280'
                        }
                      }} 
                    />
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Upgrade Options</Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    • Up to 1TB storage capacity
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Advanced hibernation features
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Priority support
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Cost-effective archival storage
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
            
            <Box mt={4} display="flex" justifyContent="center">
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowPlansDialog(true)}
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 600, 
                  px: 4, 
                  py: 1.5,
                  bgcolor: '#6b7280',
                  '&:hover': { bgcolor: '#4b5563' }
                }}
              >
                Upgrade to Hibernation Plan
              </Button>
            </Box>
          </Paper>
        )}

        {!usageStats?.is_free_tier && (
          <Alert severity="info" sx={{ mb: 3 }}>
            You don't have an active hibernation plan. Choose a plan to start storing your data efficiently.
          </Alert>
        )}

        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setShowPlansDialog(true)}
            sx={{ textTransform: 'none', fontWeight: 600, px: 4, py: 1.5 }}
          >
            View Available Plans
          </Button>
        </Box>

        <Dialog
          open={showPlansDialog}
          onClose={() => setShowPlansDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Choose Your Hibernation Plan
            </Typography>
          </DialogTitle>
          <DialogContent>
            <HibernationPlans 
              onPlanSelect={handlePlanSelect}
              currentPlan={currentPlan}
              onClose={() => setShowPlansDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  const plan = currentPlan.plan;
  const planColor = getPlanColor(plan.name);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Hibernation Plan Dashboard
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{ textTransform: 'none' }}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Current Plan Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '50%',
                      bgcolor: alpha(planColor, 0.1),
                    }}
                  >
                    {getPlanIcon(plan.name)}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {getPlanTitle(plan.name)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatStorageSize(plan.storage_size_bytes)} Storage
                    </Typography>
                  </Box>
                </Box>

                <Divider />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Annual Price
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    ₹{plan.annual_price_inr}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Cost
                  </Typography>
                  <Typography variant="body1">
                    ₹{plan.user_cost_inr}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Restore Time
                  </Typography>
                  <Chip
                    label={plan.restore_time_hours === 0 ? 'Instant' : `${plan.restore_time_hours} hours`}
                    size="small"
                    sx={{ bgcolor: alpha(planColor, 0.1), color: planColor }}
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Free Retrieval
                  </Typography>
                  <Typography variant="body2">
                    {plan.free_retrieval_gb > 0 
                      ? `${plan.free_retrieval_gb} GB/${plan.retrieval_period_months === 1 ? 'month' : `${plan.retrieval_period_months} months`}`
                      : 'Unlimited'
                    }
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<Settings />}
                  onClick={() => setShowPlansDialog(true)}
                  sx={{ textTransform: 'none', borderColor: planColor, color: planColor }}
                >
                  Change Plan
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Statistics */}
        {usageStats && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Usage Statistics
                </Typography>

                <Stack spacing={3}>
                  {/* Storage Usage */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Storage Used
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatBytes(usageStats.storage_used_bytes)} / {formatBytes(usageStats.storage_limit_bytes)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={usageStats.storage_used_percentage}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: alpha(planColor, 0.1),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: planColor,
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {usageStats.storage_used_percentage.toFixed(1)}% used
                    </Typography>
                  </Box>

                  {/* Retrieval Usage */}
                  {plan.free_retrieval_gb > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Retrieval Used
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {usageStats.retrieval_used_gb.toFixed(1)} / {usageStats.retrieval_limit_gb} GB
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(usageStats.retrieval_used_gb / usageStats.retrieval_limit_gb) * 100}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: alpha('#f59e0b', 0.1),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: '#f59e0b',
                            borderRadius: 4,
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {usageStats.retrieval_remaining_gb.toFixed(1)} GB remaining
                      </Typography>
                    </Box>
                  )}

                  {/* Plan Expiry */}
                  <Box sx={{ p: 2, bgcolor: alpha('#f59e0b', 0.05), borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Plan Expires
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {new Date(usageStats.plan_expires_at).toLocaleDateString()}
                    </Typography>
                    {usageStats.is_expired && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Plan has expired
                      </Alert>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Plan Selection Dialog */}
      <Dialog
        open={showPlansDialog}
        onClose={() => setShowPlansDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Change Hibernation Plan</DialogTitle>
        <DialogContent>
          <HibernationPlans
            currentPlan={currentPlan}
            onPlanSelect={handlePlanSelect}
            onClose={() => setShowPlansDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default HibernationPlanDashboard;
