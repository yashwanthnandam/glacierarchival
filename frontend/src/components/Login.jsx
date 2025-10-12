import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Link,
  Alert
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { authAPI } from '../services/api';
import { VALIDATION, STORAGE_KEYS } from '../constants';
import secureTokenStorage from '../utils/secureTokenStorage';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (username.length < VALIDATION.USERNAME_MIN_LENGTH) {
      errors.username = `Username must be at least ${VALIDATION.USERNAME_MIN_LENGTH} characters`;
    } else if (username.length > VALIDATION.USERNAME_MAX_LENGTH) {
      errors.username = `Username must be less than ${VALIDATION.USERNAME_MAX_LENGTH} characters`;
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      errors.password = `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`;
    }
    
    return errors;
  };

  const getErrorMessage = (error) => {
    if (error.response?.status === 401) {
      return 'Invalid username or password. Please check your credentials.';
    }
    if (error.response?.status === 429) {
      return 'Too many login attempts. Please try again later.';
    }
    if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    }
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      return 'Network error. Please check your connection.';
    }
    return 'Login failed. Please try again.';
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
      // Use secure authentication if available, fallback to legacy
      const useSecureAuth = import.meta.env.VITE_USE_SECURE_AUTH === 'true';
      
      if (useSecureAuth) {
        const response = await authAPI.secureLogin({ username, password });
        const { user, csrf_token } = response.data;
        
        // Set CSRF token for cookie-based authentication
        secureTokenStorage.setCSRFToken(csrf_token);
        
        // Store user data
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        
        navigate('/dashboard');
      } else {
        // Legacy localStorage-based authentication
        const response = await authAPI.login({ username, password });
        const { access, refresh } = response.data;
        
        // Store tokens securely
        secureTokenStorage.setAccessToken(access);
        secureTokenStorage.setRefreshToken(refresh);
        
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Only log errors in development
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.error('Login error:', err);
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
          Login to your account
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField 
            label="Username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
            fullWidth
            variant="outlined"
          />
          <TextField 
            type="password" 
            label="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
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
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </Box>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register">
              Register here
            </Link>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default Login;