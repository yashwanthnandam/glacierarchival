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
        return <AcUnit sx={{ fontSize: 40, color: '#4f46e5' }} />; // Indigo-600
      case 'flexible_archive':
        return <CloudQueue sx={{ fontSize: 40, color: '#2563eb' }} />; // Blue-600
      default:
        return <Storage sx={{ fontSize: 40, color: '#4f46e5' }} />; // Default darker indigo
    }
  };

  const getPlanColor = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return '#4f46e5'; // Indigo-600 - darker for better contrast
      case 'flexible_archive':
        return '#2563eb'; // Blue-600 - darker for better contrast
      default:
        return '#4f46e5'; // Default to darker indigo
    }
  };

  const getPlanTitle = (planName) => {
    switch (planName) {
      case 'deep_freeze':
        return 'Deep Hibernate';
      case 'flexible_archive':
        return 'Smart Hibernate';
      default:
        return 'Hibernation Plan';
    }
  };

  const getTierInfo = (tier) => {
    const tierMap = {
      'deep_freeze': {
        title: 'Deep Hibernate',
        subtitle: '🌙 Long-term archival storage',
        description: 'Perfect for memories, backups, and data you rarely need',
        icon: <AcUnit />,
        color: '#4f46e5', // Indigo-600 - darker for better contrast
        gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', // Darker indigo gradient
        lightColor: '#e0e7ff', // Indigo-100
        darkColor: '#312e81', // Indigo-900 - much darker for text
        bgColor: '#f8fafc', // Slate-50 - light background
        textColor: '#1e293b', // Slate-800 - dark text
      },
      'flexible_archive': {
        title: 'Smart Hibernate',
        subtitle: '🌤️ Flexible retrieval storage',
        description: 'Balance between cost and accessibility for regular backups',
        icon: <CloudQueue />,
        color: '#2563eb', // Blue-600 - darker for better contrast
        gradient: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', // Darker blue gradient
        lightColor: '#dbeafe', // Blue-100
        darkColor: '#1e3a8a', // Blue-900 - much darker for text
        bgColor: '#f8fafc', // Slate-50 - light background
        textColor: '#1e293b', // Slate-800 - dark text
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
    if (bytes === null || bytes === undefined || bytes === 'NaN' || isNaN(bytes)) {
      return '0 GB';
    }
    
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

  const tierOrder = ['deep_freeze', 'flexible_archive'];
  const currentTier = tierOrder[selectedTier];
  const currentTierPlans = plans[currentTier] || [];
  const tierInfo = getTierInfo(currentTier);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" sx={{ mb: 3, fontWeight: 800, color: '#1e293b' }}>
          Choose Your Hibernation Plan
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', maxWidth: 700, mx: 'auto', lineHeight: 1.6 }}>
          Select the perfect storage solution for your data needs. Each plan offers different 
          balance between cost, storage capacity, and retrieval speed.
        </Typography>
      </Box>

      {/* Tier Selection Tabs */}
      <Paper sx={{ mb: 6, borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Tabs
          value={selectedTier}
          onChange={(e, newValue) => setSelectedTier(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              py: 3,
              px: 4,
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'none',
              transition: 'all 0.3s ease',
            },
            '& .MuiTabs-indicator': {
              height: 4,
              borderRadius: '2px 2px 0 0',
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
                  background: selectedTier === index ? info.bgColor : 'transparent',
                  color: selectedTier === index ? info.textColor : 'text.primary',
                  border: selectedTier === index ? `2px solid ${info.color}` : '2px solid transparent',
                  '&:hover': {
                    background: selectedTier === index ? info.bgColor : alpha(info.color, 0.05),
                    border: `2px solid ${alpha(info.color, 0.3)}`,
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
          p: 4,
          mb: 6,
          background: tierInfo.bgColor,
          color: tierInfo.textColor,
          borderRadius: 3,
          boxShadow: `0 8px 24px ${alpha(tierInfo.color, 0.1)}`,
          border: `1px solid ${alpha(tierInfo.color, 0.2)}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={3}>
          <Box
            sx={{
              p: 3,
              borderRadius: '50%',
              bgcolor: tierInfo.lightColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${tierInfo.color}`,
            }}
          >
            {React.cloneElement(tierInfo.icon, { sx: { fontSize: 48, color: tierInfo.color } })}
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, color: tierInfo.textColor }}>
              {tierInfo.title}
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
              {tierInfo.description}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Plans Grid */}
      <Grid container spacing={4}>
        {currentTierPlans.map((plan, index) => {
          const isCurrentPlan = currentPlan?.plan?.id === plan.id;
          const isPopular = index === 1; // Middle plan is usually popular
          
          return (
            <Grid item xs={12} md={4} key={plan.id}>
              <Card
                sx={{
                  height: '100%',
                  position: 'relative',
                  border: `2px solid ${alpha(tierInfo.color, 0.15)}`,
                  borderRadius: 4,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                  '&:hover': {
                    transform: 'translateY(-12px) scale(1.02)',
                    boxShadow: `0 20px 60px ${alpha(tierInfo.color, 0.25)}`,
                    borderColor: tierInfo.color,
                  },
                  ...(isCurrentPlan && {
                    borderColor: tierInfo.color,
                    background: `linear-gradient(145deg, ${alpha(tierInfo.color, 0.05)} 0%, ${alpha(tierInfo.color, 0.02)} 100%)`,
                    boxShadow: `0 8px 32px ${alpha(tierInfo.color, 0.15)}`,
                  }),
                  ...(isPopular && !isCurrentPlan && {
                    borderColor: tierInfo.color,
                    boxShadow: `0 8px 32px ${alpha(tierInfo.color, 0.2)}`,
                    background: `linear-gradient(145deg, ${alpha(tierInfo.color, 0.02)} 0%, #ffffff 100%)`,
                  }),
                }}
              >
                {/* Popular Badge */}
                {isPopular && !isCurrentPlan && (
                  <Chip
                    label="★ Most Popular"
                    sx={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 1,
                      bgcolor: tierInfo.color,
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      borderRadius: 2,
                      boxShadow: `0 4px 12px ${alpha(tierInfo.color, 0.3)}`,
                    }}
                  />
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <Chip
                    label="✓ Current Plan"
                    sx={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      zIndex: 1,
                      bgcolor: '#10b981',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      borderRadius: 2,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    }}
                  />
                )}
                
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={4}>
                    {/* Storage Size - Most Prominent */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h2" sx={{ fontWeight: 800, color: tierInfo.color, mb: 2 }}>
                        {formatStorageSize(plan.storage_size_bytes)}
                      </Typography>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Storage Capacity
                      </Typography>
                    </Box>

                    {/* Pricing */}
                    <Box sx={{ textAlign: 'center', p: 3, bgcolor: tierInfo.lightColor, borderRadius: 3, border: `1px solid ${alpha(tierInfo.color, 0.2)}` }}>
                      <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, color: tierInfo.textColor }}>
                        ₹{plan.annual_price_inr}
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        per year (₹{plan.user_cost_inr}/month)
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
                        color: isCurrentPlan ? tierInfo.textColor : 'white',
                        borderColor: tierInfo.color,
                        borderRadius: 3,
                        py: 3,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        boxShadow: isCurrentPlan ? 'none' : `0 4px 16px ${alpha(tierInfo.color, 0.2)}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: isCurrentPlan ? tierInfo.lightColor : tierInfo.darkColor,
                          transform: isCurrentPlan ? 'none' : 'translateY(-2px)',
                          boxShadow: isCurrentPlan ? 'none' : `0 8px 24px ${alpha(tierInfo.color, 0.3)}`,
                        },
                        '&:disabled': {
                          bgcolor: 'transparent',
                          color: tierInfo.color,
                          borderColor: tierInfo.color,
                        },
                      }}
                    >
                      {isCurrentPlan ? '✓ Current Plan' : 'Select Plan'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Common Tier Features */}
      <Paper
        sx={{
          p: 4,
          mt: 6,
          background: tierInfo.bgColor,
          borderRadius: 3,
          boxShadow: `0 4px 16px ${alpha(tierInfo.color, 0.08)}`,
          border: `1px solid ${alpha(tierInfo.color, 0.15)}`,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 4, color: tierInfo.textColor, textAlign: 'center' }}>
          {tierInfo.title} Features
        </Typography>
        
        <Grid container spacing={4}>
          {/* Restore Time */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, bgcolor: alpha(tierInfo.color, 0.05), borderRadius: 3, height: '100%' }}>
              <Box sx={{ p: 2, bgcolor: tierInfo.lightColor, borderRadius: 2 }}>
                <Schedule sx={{ fontSize: 32, color: tierInfo.color }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                  Restore Time
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {getRestoreTimeText(currentTierPlans[0]?.restore_time_hours || 12)}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Retrieval Allowance */}
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3, bgcolor: alpha(tierInfo.color, 0.05), borderRadius: 3, height: '100%' }}>
              <Box sx={{ p: 2, bgcolor: tierInfo.lightColor, borderRadius: 2 }}>
                <Security sx={{ fontSize: 32, color: tierInfo.color }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                  Retrieval Allowance
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {currentTierPlans[0]?.free_retrieval_gb > 0 
                    ? `${currentTierPlans[0].free_retrieval_gb} GB free every ${currentTierPlans[0].retrieval_period_months} months`
                    : 'Unlimited retrievals'
                  }
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* User Message */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                p: 3,
                bgcolor: alpha(tierInfo.color, 0.08),
                borderRadius: 3,
                border: `1px solid ${alpha(tierInfo.color, 0.2)}`,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body1" sx={{ fontStyle: 'italic', fontWeight: 500, color: tierInfo.textColor }}>
                "{currentTierPlans[0]?.user_message || 'Your data sleeps safely — wake it only when needed.'}"
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

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
