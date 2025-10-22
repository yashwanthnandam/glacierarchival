import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Link,
  Alert,
  Paper,
  Container,
  alpha
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { authAPI } from '../services/api';
import { VALIDATION, STORAGE_KEYS } from '../constants';
import secureTokenStorage from '../utils/secureTokenStorage';
import analyticsService from '../services/analyticsService';
import { captureException, setUserContext } from '../services/sentryService';

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
        
        // Track successful login
        analyticsService.trackLogin('email');
        
        // Set user context in Sentry
        setUserContext(user);
        
        navigate('/dashboard');
      } else {
        // Legacy localStorage-based authentication
        const response = await authAPI.login({ username, password });
        const { access, refresh } = response.data;
        
        // Store tokens securely
        secureTokenStorage.setAccessToken(access);
        secureTokenStorage.setRefreshToken(refresh);
        
        // Track successful login
        analyticsService.trackLogin('email');
        
        // Set user context in Sentry (we'll get user data from API later)
        setUserContext({ username });
        
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Track login error
      analyticsService.trackError('login_error', errorMessage, 'login_form');
      
      // Capture error in Sentry
      captureException(err, {
        tags: {
          component: 'Login',
          action: 'login_attempt'
        },
        extra: {
          username: username,
          error_message: errorMessage
        }
      });
      
      // Only log errors in development
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.error('Login error:', err);
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
              Welcome back! Login to your account
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField 
              label="Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              fullWidth
              autoComplete="username"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)'
                }
              }}
            />
            <TextField 
              type="password" 
              label="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              fullWidth
              autoComplete="current-password"
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
                }
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </Box>
          
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
              <Link 
                component={RouterLink} 
                to="/forgot-password"
                sx={{ 
                  color: '#1976d2',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Forgot your password?
              </Link>
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Don't have an account?{' '}
              <Link 
                component={RouterLink} 
                to="/register"
                sx={{ 
                  color: '#1976d2',
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Register here
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;