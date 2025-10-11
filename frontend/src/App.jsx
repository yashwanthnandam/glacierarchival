import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Container, Typography, Box } from '@mui/material';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import ModernDashboard from './components/ModernDashboard';
import EmailVerification from './components/EmailVerification';
import UploadPage from './pages/UploadPage';
import HibernationPlanDashboard from './components/HibernationPlanDashboard';
import theme from './theme';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth={false} disableGutters>
        <Box sx={{ minHeight: '100vh' }}>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <ModernDashboard />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/upload" 
                element={
                  <PrivateRoute>
                    <UploadPage />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/plans" 
                element={
                  <PrivateRoute>
                    <HibernationPlanDashboard />
                  </PrivateRoute>
                } 
              />
            </Routes>
          </Router>
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default App;