import React from 'react';
import { Navigate } from 'react-router-dom';
import secureTokenStorage from '../utils/secureTokenStorage';

const PrivateRoute = ({ children }) => {
  // Use secure token storage for authentication check
  const isAuthenticated = secureTokenStorage.isAuthenticated();
  
  if (!isAuthenticated) {
    // Clear any invalid tokens
    secureTokenStorage.clearTokens();
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;