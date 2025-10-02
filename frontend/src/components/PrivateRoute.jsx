import React from 'react';
import { Route, Navigate } from 'react-router-dom';

const PrivateRoute = ({ element, ...rest }) => {
  const token = localStorage.getItem('token');
  return (
    <Route {...rest} element={token ? element : <Navigate to="/login" />} />
  );
};

export default PrivateRoute;