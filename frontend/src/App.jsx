import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import theme from './theme';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <PrivateRoute path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;