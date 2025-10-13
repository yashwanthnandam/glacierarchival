/**
 * Sentry Error Monitoring Service
 * Provides centralized error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Initialize Sentry
Sentry.init({
  dsn: 'https://110d09152b148181a66fe8695869ea6f@o4510179546693632.ingest.us.sentry.io/4510179548856320',
  
  // Performance Monitoring
  tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
  
  // Integrations
  integrations: [
    new BrowserTracing({
      // Set sampling rate for performance monitoring
      tracingOrigins: ['localhost', 'datahibernate.in', /^\//],
    }),
  ],
  
  // Environment
  environment: import.meta.env.VITE_ENVIRONMENT || 'production',
  
  // Release tracking
  release: import.meta.env.VITE_RELEASE_VERSION || '1.0.0',
  
  // Additional options
  attachStacktrace: true,
  sendDefaultPii: true,
  maxBreadcrumbs: 50,
  
  // Filter out common noise
  beforeSend(event, hint) {
    // Filter out common browser errors that aren't actionable
    if (event.exception) {
      const error = hint.originalException;
      
      // Filter out network errors that are user's connection issues
      if (error && error.message && (
        error.message.includes('Network Error') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Connection refused')
      )) {
        return null;
      }
      
      // Filter out script loading errors from extensions
      if (error && error.message && error.message.includes('Script error')) {
        return null;
      }
    }
    
    return event;
  },
  
  // Add user context
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
      return null;
    }
    return breadcrumb;
  },
});

// Set user context
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user?.id,
    username: user?.username,
    email: user?.email,
  });
};

// Clear user context
export const clearUserContext = () => {
  Sentry.setUser(null);
};

// Capture exceptions
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    // Add context
    Object.keys(context).forEach(key => {
      scope.setContext(key, context[key]);
    });
    
    Sentry.captureException(error);
  });
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
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
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

// Custom error boundary component
export const SentryErrorBoundary = Sentry.withErrorBoundary;

// Export Sentry instance for advanced usage
export { Sentry };

export default Sentry;
