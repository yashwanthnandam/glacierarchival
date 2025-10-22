import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Link,
  Alert,
  Paper,
  Container,
  alpha
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { VALIDATION } from '../constants';
import analyticsService from '../services/analyticsService';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    
    // Username validation
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < VALIDATION.USERNAME_MIN_LENGTH) {
      errors.username = `Username must be at least ${VALIDATION.USERNAME_MIN_LENGTH} characters`;
    } else if (formData.username.length > VALIDATION.USERNAME_MAX_LENGTH) {
      errors.username = `Username must be less than ${VALIDATION.USERNAME_MAX_LENGTH} characters`;
    }
    
    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!VALIDATION.EMAIL_REGEX.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      errors.password = `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`;
    } else if (formData.password.length > VALIDATION.PASSWORD_MAX_LENGTH) {
      errors.password = `Password must be less than ${VALIDATION.PASSWORD_MAX_LENGTH} characters`;
    }
    
    return errors;
  };

  const getErrorMessage = (error) => {
    if (error.response?.status === 400) {
      return error.response.data?.error || 'Invalid registration data. Please check your input.';
    }
    if (error.response?.status === 409) {
      return 'Username or email already exists. Please choose different credentials.';
    }
    if (error.response?.status === 201) {
      // Handle successful registration with email error
      return error.response.data?.error || 'Registration successful but email verification failed.';
    }
    if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    }
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      return 'Network error. Please check your connection.';
    }
    return 'Registration failed. Please try again.';
  };

  const getSuccessMessage = (response) => {
    if (response.data?.message) {
      return response.data.message;
    }
    return 'Registration successful! Please check your email to verify your account.';
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setError(Object.values(validationErrors)[0]);
      setLoading(false);
      return;
    }
    
    try {
      const response = await authAPI.register(formData);
      const successMessage = getSuccessMessage(response);
      setError(successMessage);
      
      // Clear form on success
      setFormData({ username: '', email: '', password: '' });
      
      // Track successful registration
      analyticsService.trackRegistration('email');
      
      // Show success message for 4 seconds before redirecting
      setTimeout(() => {
        navigate('/login');
      }, 4000);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Track registration error
      analyticsService.trackError('registration_error', errorMessage, 'register_form');
      
      // Only log errors in development
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.error('Registration error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 4
    }}>
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
              <Box
                component="img"
                src="/icon.svg"
                alt="DataHibernate Logo"
                sx={{
                  width: 48,
                  height: 48,
                  mr: 2,
                  borderRadius: 2
                }}
              />
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: '#1e293b' }}>
                Data Hibernate
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ color: '#64748b', fontWeight: 400 }}>
              Join us! Create your account
            </Typography>
          </Box>
          
                  {error && (
                    <Alert 
                      severity={error.includes('successful') || error.includes('Registration successful') || error.includes('check your email') ? 'success' : 'error'} 
                      sx={{ mb: 3, borderRadius: 2 }}
                    >
                      {error}
                    </Alert>
                  )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField 
              name="username" 
              label="Username" 
              value={formData.username} 
              onChange={handleChange} 
              required 
              fullWidth
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }
              }}
            />
            <TextField 
              name="email" 
              label="Email" 
              type="email"
              value={formData.email} 
              onChange={handleChange} 
              required 
              fullWidth
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }
              }}
            />
            <TextField 
              name="password" 
              type="password" 
              label="Password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
              fullWidth
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }
              }}
            />
            <Button 
              type="submit" 
              variant="contained" 
              fullWidth
              disabled={loading}
              sx={{ 
                mt: 2,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(25, 118, 210, 0.4)'
                },
                '&:disabled': {
                  background: 'rgba(25, 118, 210, 0.3)',
                  color: 'rgba(255, 255, 255, 0.7)'
                }
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </Box>
          
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Already have an account?{' '}
              <Link 
                component={RouterLink} 
                to="/login"
                sx={{ 
                  color: '#1976d2',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Login here
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Register;