import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Container, Typography, Box } from '@mui/material';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ModernDashboard from './components/ModernDashboard';
import EmailVerification from './components/EmailVerification';
import UploadPage from './pages/UploadPage';
import HibernationPlanDashboard from './components/HibernationPlanDashboard';
import LandingPage from './components/LandingPage';
import WhyDataHibernate from './components/WhyDataHibernate';
import theme from './theme';
import analyticsService from './services/analyticsService';
import { setUserContext, clearUserContext, SentryErrorBoundary } from './services/sentryService';

// Component to track page views
const PageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = document.title || 'Data Hibernate';
    const pagePath = location.pathname;
    
    analyticsService.trackPageView(pageTitle, pagePath);
  }, [location]);

  return null;
};

const App = () => {
  return (
    <SentryErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth={false} disableGutters>
          <Box sx={{ minHeight: '100vh' }}>
            <Router>
              <PageTracker />
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/why" element={<WhyDataHibernate />} />
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
    </SentryErrorBoundary>
  );
};

export default App;