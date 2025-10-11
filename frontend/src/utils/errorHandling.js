import { Alert, CircularProgress, Box, Typography, Button } from '../utils/muiImports';

/**
 * Common error handling utilities for React components
 */

// Common error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  PAYMENT_ERROR: 'Payment processing failed. Please try again.',
  UPLOAD_ERROR: 'File upload failed. Please try again.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.'
};

// Common loading states
export const LoadingState = ({ message = 'Loading...', size = 40 }) => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
    <Box textAlign="center">
      <CircularProgress size={size} />
      <Box mt={2}>
        <Typography variant="body2" color="textSecondary">
          {message}
        </Typography>
      </Box>
    </Box>
  </Box>
);

// Common error display component
export const ErrorDisplay = ({ 
  error, 
  onRetry, 
  retryText = 'Retry',
  showDetails = false 
}) => {
  if (!error) return null;

  const getErrorMessage = (error) => {
    if (typeof error === 'string') return error;
    
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401: return ERROR_MESSAGES.UNAUTHORIZED;
        case 403: return ERROR_MESSAGES.FORBIDDEN;
        case 404: return ERROR_MESSAGES.NOT_FOUND;
        case 500: return ERROR_MESSAGES.SERVER_ERROR;
        default: return error.response.data?.message || ERROR_MESSAGES.GENERIC_ERROR;
      }
    }
    
    if (error.message) return error.message;
    return ERROR_MESSAGES.GENERIC_ERROR;
  };

  const errorMessage = getErrorMessage(error);
  const errorDetails = showDetails && error.response?.data ? 
    JSON.stringify(error.response.data, null, 2) : null;

  return (
    <Alert 
      severity="error" 
      action={onRetry ? (
        <Button color="inherit" size="small" onClick={onRetry}>
          {retryText}
        </Button>
      ) : null}
    >
      <Typography variant="body2">
        {errorMessage}
      </Typography>
      {errorDetails && (
        <Box mt={1}>
          <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem' }}>
            {errorDetails}
          </Typography>
        </Box>
      )}
    </Alert>
  );
};

// Common API error handler
export const handleApiError = (error, customHandlers = {}) => {
  console.error('API Error:', error);
  
  if (error.response) {
    const status = error.response.status;
    const handler = customHandlers[status];
    
    if (handler) {
      return handler(error);
    }
    
    // Default handling based on status code
    switch (status) {
      case 401:
        // Handle unauthorized - redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      case 402:
        // Handle payment required - redirect to plans
        window.location.href = '/plans';
        break;
      case 403:
        // Handle forbidden
        alert(ERROR_MESSAGES.FORBIDDEN);
        break;
      case 404:
        // Handle not found
        alert(ERROR_MESSAGES.NOT_FOUND);
        break;
      case 500:
        // Handle server error
        alert(ERROR_MESSAGES.SERVER_ERROR);
        break;
      default:
        alert(error.response.data?.message || ERROR_MESSAGES.GENERIC_ERROR);
    }
  } else if (error.request) {
    // Network error
    alert(ERROR_MESSAGES.NETWORK_ERROR);
  } else {
    // Other error
    alert(error.message || ERROR_MESSAGES.GENERIC_ERROR);
  }
};

// Common success handler
export const handleApiSuccess = (response, successMessage = null) => {
  if (successMessage) {
    // You can integrate with a toast notification system here
    console.log('Success:', successMessage);
  }
  return response;
};

// Common loading state hook
export const useLoadingState = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  const [error, setError] = useState(null);

  const executeWithLoading = async (asyncFunction) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction();
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    setLoading,
    setError,
    executeWithLoading
  };
};

// Common API call wrapper
export const withErrorHandling = (apiCall, customHandlers = {}) => {
  return async (...args) => {
    try {
      const result = await apiCall(...args);
      return handleApiSuccess(result);
    } catch (error) {
      handleApiError(error, customHandlers);
      throw error;
    }
  };
};
