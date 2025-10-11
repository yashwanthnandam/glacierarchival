import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import secureTokenStorage from '../utils/secureTokenStorage';

const PrivateRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await secureTokenStorage.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        if (!authenticated) {
          secureTokenStorage.clearTokens();
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
        secureTokenStorage.clearTokens();
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isChecking) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{ bgcolor: 'background.default' }}
      >
        <CircularProgress />
      </Box>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;