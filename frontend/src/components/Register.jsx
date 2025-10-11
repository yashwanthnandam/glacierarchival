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

const Register = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
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
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom align="center">
          Register
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