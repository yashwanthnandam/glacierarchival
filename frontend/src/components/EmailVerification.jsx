import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Button, 
  Alert,
  CircularProgress,
  TextField
} from '@mui/material';
import { CheckCircle, Email, Refresh } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async (verificationToken) => {
    try {
      const response = await authAPI.verifyEmail({
        token: verificationToken
      });
      setStatus('success');
      setMessage(response.data.message);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Verification failed';
      
      if (errorMessage.includes('expired')) {
        setStatus('expired');
        setMessage('Your verification link has expired. Please request a new verification email.');
      } else {
        setStatus('error');
        setMessage(errorMessage);
      }
    }
  };

  const resendVerification = async () => {
    if (!email) {
      setMessage('Please enter your email address');
      return;
    }

    setResending(true);
    try {
      await authAPI.resendVerification({ email });
      setMessage('Verification email sent! Please check your inbox.');
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" sx={{ fontSize: 60 }} />;
      case 'error':
      case 'expired':
        return <Email color="error" sx={{ fontSize: 60 }} />;
      default:
        return <CircularProgress size={60} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
      case 'expired':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Card sx={{ maxWidth: 500, mx: 'auto', mt: 8 }}>
      <CardContent>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {getStatusIcon()}
        </Box>

        <Typography variant="h5" component="h1" gutterBottom align="center">
          Email Verification
        </Typography>

        {message && (
          <Alert severity={getStatusColor()} sx={{ mb: 3 }}>
            {message}
          </Alert>
        )}

        {status === 'success' && (
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              Go to Login
            </Button>
          </Box>
        )}

        {(status === 'error' || status === 'expired') && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {status === 'expired' 
                ? 'Your verification link has expired. Enter your email address to get a new verification email.'
                : 'Didn\'t receive the email? Enter your email address to resend the verification email.'
              }
            </Typography>
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
            />
            
            <Button
              fullWidth
              variant="contained"
              startIcon={<Refresh />}
              onClick={resendVerification}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend Verification Email'}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/login')}
              sx={{ mt: 1 }}
            >
              Back to Login
            </Button>
          </Box>
        )}

        {status === 'verifying' && (
          <Typography variant="body2" color="text.secondary" align="center">
            Verifying your email address...
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailVerification;
