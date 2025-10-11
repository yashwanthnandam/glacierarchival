import React from 'react';
import { Navigate } from 'react-router-dom';
import { STORAGE_KEYS, TOKEN_UTILS } from '../constants';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  
  // Validate token structure and expiration
  const isValidToken = token && TOKEN_UTILS.isValidJWT(token) && !TOKEN_UTILS.isTokenExpired(token);
  
  if (!isValidToken) {
    // Clear invalid tokens
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
  
  return isValidToken ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;