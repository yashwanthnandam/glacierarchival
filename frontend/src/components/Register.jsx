import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Link,
  Alert
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { VALIDATION } from '../constants';

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
      if (response.data.message) {
        setError(response.data.message);
        // Don't navigate immediately - show success message
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        navigate('/login');
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Only log errors in development
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.error('Registration error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/icon.png"
            alt="DataHibernate Logo"
            sx={{
              width: 40,
              height: 40,
              mr: 2,
              borderRadius: 1
            }}
          />
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
            Data Hibernate
          </Typography>
        </Box>
        <Typography variant="h6" component="h3" gutterBottom align="center" color="text.secondary">
          Create your account
        </Typography>
        
        {error && (
          <Alert 
            severity={error.includes('successful') ? 'success' : 'error'} 
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField 
            name="username" 
            label="Username" 
            value={formData.username} 
            onChange={handleChange} 
            required 
            fullWidth
            variant="outlined"
          />
          <TextField 
            name="email" 
            label="Email" 
            type="email"
            value={formData.email} 
            onChange={handleChange} 
            required 
            fullWidth
            variant="outlined"
          />
          <TextField 
            name="password" 
            type="password" 
            label="Password" 
            value={formData.password} 
            onChange={handleChange} 
            required 
            fullWidth
            variant="outlined"
          />
          <Button 
            type="submit" 
            variant="contained" 
            fullWidth
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Registering...' : 'Register'}
          </Button>
        </Box>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Login here
            </Link>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default Register;