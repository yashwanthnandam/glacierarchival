import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Paper
} from '../utils/muiImports';
import PaymentService from '../services/paymentService';
import { hibernationAPI } from '../services/api';

const RazorpayTest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [paymentService] = useState(() => new PaymentService());

  const testRazorpayIntegration = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Get Razorpay key
      const response = await hibernationAPI.getPlansGroupedByTier();
      const keyId = response.data.razorpay_key_id;
      
      console.log('Testing Razorpay with key:', keyId);
      
      if (!keyId) {
        throw new Error('No Razorpay key found');
      }

      // Initialize Razorpay
      paymentService.initializeRazorpay(keyId);
      
      // Test with a small amount (₹1)
      const testAmount = 100; // 1 rupee in paise
      
      // Create test payment order
      const paymentData = await paymentService.createPaymentOrder(1, testAmount);
      
      console.log('Payment order created:', paymentData);
      
      setSuccess('Razorpay integration test successful! Payment order created.');
      
    } catch (err) {
      console.error('Razorpay test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testPaymentModal = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Get Razorpay key
      const response = await hibernationAPI.getPlansGroupedByTier();
      const keyId = response.data.razorpay_key_id;
      
      // Initialize Razorpay
      paymentService.initializeRazorpay(keyId);
      
      // Create test payment order
      const paymentData = await paymentService.createPaymentOrder(1, 100);
      
      // Open payment modal
      const result = await paymentService.processPayment(paymentData);
      
      if (result.success) {
        setSuccess('Payment test successful!');
      } else {
        setError('Payment test failed');
      }
      
    } catch (err) {
      console.error('Payment test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Razorpay Integration Test
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Razorpay Integration
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            This page helps test the Razorpay payment integration. Use test cards for testing.
          </Typography>
          
          <Box display="flex" gap={2} mb={2}>
            <Button
              variant="contained"
              onClick={testRazorpayIntegration}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              Test Integration
            </Button>
            
            <Button
              variant="outlined"
              onClick={testPaymentModal}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              Test Payment Modal
            </Button>
          </Box>
          
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
        </CardContent>
      </Card>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Test Cards
        </Typography>
        <Typography variant="body2" component="div">
          <strong>Success Card:</strong> 4111 1111 1111 1111<br/>
          <strong>Failure Card:</strong> 4000 0000 0000 0002<br/>
          <strong>CVV:</strong> Any 3 digits<br/>
          <strong>Expiry:</strong> Any future date<br/>
          <strong>Name:</strong> Any name
        </Typography>
      </Paper>
    </Box>
  );
};

export default RazorpayTest;
