import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  alpha,
  useTheme,
  Paper,
  Tabs,
  Tab,
  Badge,
  AcUnit,
  WbSunny,
  CloudQueue,
  CheckCircle,
  Schedule,
  Storage,
  Speed,
  Security,
  Info,
  Star,
  TrendingUp,
  Diamond,
} from '../utils/muiImports';
import { hibernationAPI } from '../services/api';
import PaymentService from '../services/paymentService';

const HibernationPlans = ({ onPlanSelect, currentPlan, onClose }) => {
  const theme = useTheme();
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState(false);
  const [paymentService] = useState(() => new PaymentService());
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedTier, setSelectedTier] = useState(0);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await hibernationAPI.getPlansGroupedByTier();
      setPlans(response.data.plans || response.data);
    } catch (err) {
      setError('Failed to load hibernation plans');
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (plan) => {
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      
      // Get Razorpay key from plans API
      const response = await hibernationAPI.getPlansGroupedByTier();
      const keyId = response.data.razorpay_key_id;
      
      // For development, allow test key
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      if (!keyId) {
        throw new Error('Razorpay key not found. Please contact support.');
      }
      
      // Only reject test key in production
      if (!isDevelopment && keyId === 'rzp_test_1234567890') {
        throw new Error('Razorpay is not properly configured for production. Please contact support.');
      }
      
      // Initialize Razorpay
      paymentService.initializeRazorpay(keyId);
      
      // Create payment order
      const paymentData = await paymentService.createPaymentOrder(plan.id, parseFloat(plan.annual_price_inr));
      
      // Process payment
      const result = await paymentService.processPayment(paymentData);
      
      if (result.success) {
        // Payment successful, update plan
        onPlanSelect(result.paymentData.plan);
        setSubscriptionDialog(false);
        alert('Payment successful! Your hibernation plan has been activated.');
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    try {
      setSubscribing(true);
      await hibernationAPI.subscribe(selectedPlan.id);
      setSubscriptionDialog(false);
      onPlanSelect?.(selectedPlan);
      // Show success message or redirect
    } catch (err) {
      console.error('Subscription failed:', err);
      setError('Failed to subscribe to plan');
    } finally {
      setSubscribing(false);
    }
  };

  const getPlanIcon = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return <AcUnit sx={{ fontSize: 40, color: '#94a3b8' }} />;
      case 'flexible_archive':
        return <CloudQueue sx={{ fontSize: 40, color: '#60a5fa' }} />;
      case 'instant_archive':
        return <Speed sx={{ fontSize: 40, color: '#34d399' }} />;
      default:
        return <Storage sx={{ fontSize: 40 }} />;
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
        return 'Deep Freeze';
      case 'flexible_archive':
        return 'Smart Hibernate';
      case 'instant_archive':
        return 'Quick Hibernate';
      default:
        return 'Hibernation Plan';
    }
  };

  const getTierInfo = (tier) => {
    const tierMap = {
      'deep_freeze': {
        title: 'Deep Freeze Tier',
        subtitle: '🌙 Long-term archival storage',
        description: 'Perfect for memories, backups, and data you rarely need',
        icon: <AcUnit />,
        color: '#94a3b8',
        gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
      },
      'flexible_archive': {
        title: 'Smart Hibernate Tier',
        subtitle: '🌤️ Flexible retrieval storage',
        description: 'Balance between cost and accessibility for regular backups',
        icon: <CloudQueue />,
        color: '#60a5fa',
        gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
      },
      'instant_archive': {
        title: 'Quick Hibernate Tier',
        subtitle: '⚡ Instant access storage',
        description: 'Fast retrieval for frequently accessed data',
        icon: <Speed />,
        color: '#34d399',
        gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      },
    };
    return tierMap[tier] || tierMap['deep_freeze'];
  };

  const getRestoreTimeText = (hours) => {
    if (hours === 0) return 'Instant';
    if (hours < 1) return 'Minutes';
    return `${hours} hours`;
  };

  const formatStorageSize = (bytes) => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1000) {
      return `${(gb / 1024).toFixed(1)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
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

  const tierOrder = ['deep_freeze', 'flexible_archive', 'instant_archive'];
  const currentTier = tierOrder[selectedTier];
  const currentTierPlans = plans[currentTier] || [];
  const tierInfo = getTierInfo(currentTier);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Choose Your Hibernation Plan
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}>
          Select the perfect storage tier for your data needs. Each tier offers different 
          balance between cost, storage capacity, and retrieval speed.
        </Typography>
      </Box>

      {/* Tier Selection Tabs */}
      <Paper sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={selectedTier}
          onChange={(e, newValue) => setSelectedTier(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              py: 2,
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          {tierOrder.map((tier, index) => {
            const info = getTierInfo(tier);
            const tierPlans = plans[tier] || [];
            const hasCurrentPlan = currentPlan && tierPlans.some(plan => plan.id === currentPlan.plan?.id);
            
            return (
              <Tab
                key={tier}
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {info.icon}
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {info.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {info.subtitle}
                      </Typography>
                    </Box>
                    {hasCurrentPlan && (
                      <Chip
                        label="Active"
                        size="small"
                        color="success"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Stack>
                }
                sx={{
                  background: selectedTier === index ? info.gradient : 'transparent',
                  color: selectedTier === index ? 'white' : 'text.primary',
                  '&:hover': {
                    background: selectedTier === index ? info.gradient : alpha(info.color, 0.1),
                  },
                }}
              />
            );
          })}
        </Tabs>
      </Paper>

      {/* Current Tier Info */}
      <Paper
        sx={{
          p: 3,
          mb: 4,
          background: tierInfo.gradient,
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 2,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {tierInfo.icon}
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {tierInfo.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {tierInfo.description}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Plans Grid */}
      <Grid container spacing={3}>
        {currentTierPlans.map((plan, index) => {
          const isCurrentPlan = currentPlan?.plan?.id === plan.id;
          const isPopular = index === 1; // Middle plan is usually popular
          
          return (
            <Grid item xs={12} md={4} key={plan.id}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  border: `2px solid ${alpha(tierInfo.color, 0.2)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 32px ${alpha(tierInfo.color, 0.3)}`,
                    borderColor: tierInfo.color,
                  },
                  ...(isCurrentPlan && {
                    borderColor: tierInfo.color,
                    bgcolor: alpha(tierInfo.color, 0.05),
                  }),
                  ...(isPopular && !isCurrentPlan && {
                    borderColor: tierInfo.color,
                    boxShadow: `0 4px 20px ${alpha(tierInfo.color, 0.2)}`,
                  }),
                }}
              >
                {/* Popular Badge */}
                {isPopular && !isCurrentPlan && (
                  <Chip
                    label="Most Popular"
                    color="primary"
                    icon={<Star />}
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      zIndex: 1,
                      bgcolor: tierInfo.color,
                      color: 'white',
                    }}
                  />
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <Chip
                    label="Current Plan"
                    color="success"
                    icon={<CheckCircle />}
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      zIndex: 1,
                    }}
                  />
                )}
                
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={3}>
                    {/* Storage Size - Most Prominent */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: tierInfo.color, mb: 1 }}>
                        {formatStorageSize(plan.storage_size_bytes)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Storage Capacity
                      </Typography>
                    </Box>

                    {/* Pricing */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                        ₹{plan.annual_price_inr}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        per year (₹{plan.user_cost_inr}/month)
                      </Typography>
                    </Box>

                    {/* Key Features */}
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Schedule sx={{ fontSize: 20, color: tierInfo.color }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Restore Time
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {getRestoreTimeText(plan.restore_time_hours)}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Security sx={{ fontSize: 20, color: tierInfo.color }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Retrieval Allowance
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {plan.free_retrieval_gb > 0 
                              ? `${plan.free_retrieval_gb} GB free every ${plan.retrieval_period_months} months`
                              : 'Unlimited retrievals'
                            }
                          </Typography>
                        </Box>
                      </Box>
                      
                      {plan.free_retrieval_gb > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Info sx={{ fontSize: 20, color: tierInfo.color }} />
                        </Box>
                      )}
                    </Stack>

                    {/* User Message */}
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: alpha(tierInfo.color, 0.05),
                        borderRadius: 1,
                        border: `1px solid ${alpha(tierInfo.color, 0.2)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                        "{plan.user_message}"
                      </Typography>
                    </Box>

                    {/* Action Button */}
                    <Button
                      fullWidth
                      variant={isCurrentPlan ? 'outlined' : 'contained'}
                      onClick={() => handlePlanSelect(plan)}
                      disabled={isCurrentPlan}
                      sx={{
                        bgcolor: isCurrentPlan ? 'transparent' : tierInfo.color,
                        color: isCurrentPlan ? tierInfo.color : 'white',
                        borderColor: tierInfo.color,
                        '&:hover': {
                          bgcolor: isCurrentPlan ? alpha(tierInfo.color, 0.1) : alpha(tierInfo.color, 0.8),
                        },
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 2,
                        fontSize: '1.1rem',
                      }}
                    >
                      {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Subscription Confirmation Dialog */}
      <Dialog
        open={subscriptionDialog}
        onClose={() => setSubscriptionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Confirm Subscription
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Stack spacing={3}>
              {/* Plan Summary */}
              <Paper
                sx={{
                  p: 3,
                  background: getTierInfo(selectedPlan.name).gradient,
                  color: 'white',
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {getPlanIcon(selectedPlan.name)}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {getPlanTitle(selectedPlan.name)} - {formatStorageSize(selectedPlan.storage_size_bytes)}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {selectedPlan.description}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Payment Error */}
              {paymentError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {paymentError}
                </Alert>
              )}

              {/* Pricing Details */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: getPlanColor(selectedPlan.name) }}>
                  ₹{selectedPlan.annual_price_inr}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  per year (₹{selectedPlan.user_cost_inr}/month)
                </Typography>
              </Box>

              {/* Features Summary */}
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Schedule sx={{ fontSize: 20, color: getPlanColor(selectedPlan.name) }} />
                  <Typography variant="body2">
                    <strong>Restore Time:</strong> {getRestoreTimeText(selectedPlan.restore_time_hours)}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Security sx={{ fontSize: 20, color: getPlanColor(selectedPlan.name) }} />
                  <Typography variant="body2">
                    <strong>Retrieval:</strong> {selectedPlan.free_retrieval_gb > 0 
                      ? `${selectedPlan.free_retrieval_gb} GB free every ${selectedPlan.retrieval_period_months} months`
                      : 'Unlimited retrievals'
                    }
                  </Typography>
                </Box>
              </Stack>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Subscription Terms:</strong> This plan will be active for 1 year from the date of purchase. 
                  You can cancel anytime, but no refunds will be provided for unused time.
                </Typography>
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setSubscriptionDialog(false)}
            variant="outlined"
            fullWidth
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handlePlanSelect(selectedPlan)}
            variant="contained"
            disabled={paymentLoading}
            startIcon={paymentLoading ? <CircularProgress size={20} /> : <CheckCircle />}
            fullWidth
            sx={{ ml: 1 }}
          >
            {paymentLoading ? 'Processing Payment...' : 'Pay & Subscribe'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HibernationPlans;
