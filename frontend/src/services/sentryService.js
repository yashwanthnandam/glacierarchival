/**
 * Sentry Error Monitoring Service
 * Provides centralized error tracking and performance monitoring
 */

import React from 'react';
import * as Sentry from '@sentry/react';

// Initialize Sentry with error handling
try {
  // Temporarily disable Sentry to avoid 403 errors
  // Sentry.init({
  //   dsn: 'https://110d09152b148181a66fe8695869ea6f@o4510179546693632.ingest.us.sentry.io/4510179548856320',
  //   
  //   // Basic configuration
  //   environment: import.meta.env.VITE_ENVIRONMENT || 'production',
  //   release: import.meta.env.VITE_RELEASE_VERSION || '1.0.0',
  //   
  //   // Disable performance monitoring for now to avoid integration issues
  //   tracesSampleRate: 0,
  //   
  //   // Basic options
  //   attachStacktrace: true,
  //   sendDefaultPii: false,
  //   maxBreadcrumbs: 20,
  //   
  //   // Filter out common noise
  //   beforeSend(event, hint) {
  //     // Filter out common browser errors that aren't actionable
  //     if (event.exception) {
  //       const error = hint.originalException;
  //       
  //       // Filter out network errors that are user's connection issues
  //       if (error && error.message && (
  //         error.message.includes('Network Error') ||
  //         error.message.includes('Failed to fetch') ||
  //         error.message.includes('Connection refused') ||
  //         error.message.includes('403')
  //       )) {
  //         return null;
  //       }
  //       
  //       // Filter out script loading errors from extensions
  //       if (error && error.message && error.message.includes('Script error')) {
  //         return null;
  //       }
  //     }
  //     
  //     return event;
  //   },
  //   
  //   // Add user context
  //   beforeBreadcrumb(breadcrumb) {
  //     // Filter out noisy breadcrumbs
  //     if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
  //       return null;
  //     }
  //     return breadcrumb;
  //   },
  // });
  
  console.log('Sentry temporarily disabled to avoid 403 errors');
} catch (error) {
  console.warn('Sentry initialization failed:', error);
}

// Set user context
export const setUserContext = (user) => {
  try {
    Sentry.setUser({
      id: user?.id,
      username: user?.username,
      email: user?.email,
    });
  } catch (error) {
    console.warn('Failed to set Sentry user context:', error);
  }
};

// Clear user context
export const clearUserContext = () => {
  try {
    Sentry.setUser(null);
  } catch (error) {
    console.warn('Failed to clear Sentry user context:', error);
  }
};

// Capture exceptions
export const captureException = (error, context = {}) => {
  try {
    Sentry.withScope((scope) => {
      // Add context
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
      
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    console.warn('Failed to capture exception in Sentry:', sentryError);
    console.error('Original error:', error);
  }
};

// Capture messages
export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.withScope((scope) => {
    // Add context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    Sentry.captureMessage(message, level);
  });
};

// Add breadcrumb
export const addBreadcrumb = (message, category = 'custom', level = 'info', data = {}) => {
  try {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.warn('Failed to add Sentry breadcrumb:', error);
  }
};

// Set tags
export const setTag = (key, value) => {
  Sentry.setTag(key, value);
};

// Set context
export const setContext = (key, context) => {
  Sentry.setContext(key, context);
};

// Performance monitoring
export const startTransaction = (name, op = 'navigation') => {
  return Sentry.startTransaction({ name, op });
};

// Custom error boundary component - simplified for now
export const SentryErrorBoundary = ({ children }) => children;

// Export Sentry instance for advanced usage
export { Sentry };

export default Sentry;
