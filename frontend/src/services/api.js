import axios from 'axios';
import { API_CONFIG, STORAGE_KEYS } from '../constants';
import secureTokenStorage from '../utils/secureTokenStorage';

const api = axios.create(API_CONFIG);

// Request interceptor to add authentication
api.interceptors.request.use(
  config => {
    const authHeaders = secureTokenStorage.getAuthHeaders();
    Object.assign(config.headers, authHeaders);
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and hibernation plan errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = secureTokenStorage.getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_CONFIG.baseURL}auth/refresh/`, {
            refresh: refreshToken
          });

          const { access } = response.data;
          secureTokenStorage.setAccessToken(access);

          // Retry the original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        secureTokenStorage.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle hibernation plan errors (402 Payment Required)
    if (error.response?.status === 402) {
      const errorData = error.response.data;
      
      if (errorData.plan_required) {
        // Check if it's a free tier limit exceeded
        if (errorData.free_tier_used && errorData.free_tier_limit) {
          const usedGB = (errorData.free_tier_used / (1024**3)).toFixed(1);
          const limitGB = (errorData.free_tier_limit / (1024**3)).toFixed(0);
          alert(`Free tier limit exceeded!\n\nYou have used ${usedGB}GB of your ${limitGB}GB free allowance.\n\nPlease subscribe to a hibernation plan to continue uploading files.`);
        } else {
          // Redirect to plans page if plan is required
          window.location.href = '/plans';
        }
        return Promise.reject(error);
      } else if (errorData.plan_expired) {
        // Show plan expired message
        alert(`Your hibernation plan has expired. Please renew your subscription.\nExpired on: ${new Date(errorData.expires_at).toLocaleDateString()}`);
        window.location.href = '/plans';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  // Secure cookie-based authentication (recommended)
  secureLogin: (data) => api.post('auth/secure/login/', data),
  secureRefresh: () => api.post('auth/secure/refresh/'),
  secureLogout: () => api.post('auth/secure/logout/'),
  secureGetUser: () => api.get('auth/secure/user/'),
  secureRegister: (data) => api.post('auth/secure/register/', data),
  
  // Legacy localStorage-based authentication (for backward compatibility)
  login: (data) => api.post('auth/login/', data),
  register: (data) => api.post('auth/register/', data),
  refresh: () => api.post('auth/refresh/'),
  getUser: () => api.get('auth/user/'),
  verifyEmail: (data) => api.post('auth/verify-email/', data),
  resendVerification: (data) => api.post('auth/resend-verification/', data)
};

export const mediaAPI = {
  getFiles: () => api.get('media-files/'),
  
  // Uppy handles uploads directly via S3 presigned URLs
  archiveFile: (id) => api.post(`media-files/${id}/archive/`),
  restoreFile: (id, restoreTier = 'Standard') => api.post(`media-files/${id}/restore/`, { restore_tier: restoreTier }),
  downloadFile: (id) => api.get(`media-files/${id}/download/`),
  deleteFile: (id) => api.delete(`media-files/${id}/`),
  bulkDeleteFiles: (fileIds) => {
    // Create a separate axios instance with longer timeout for bulk deletes
    const bulkDeleteApi = axios.create({
      ...API_CONFIG,
      timeout: 300000, // 5 minutes for bulk operations
    });
    
    // Add auth interceptor
    bulkDeleteApi.interceptors.request.use(
      config => {
        const authHeaders = secureTokenStorage.getAuthHeaders();
        Object.assign(config.headers, authHeaders);
        return config;
      },
      error => Promise.reject(error)
    );
    
    return bulkDeleteApi.post('media-files/bulk_delete/', { file_ids: fileIds });
  },
  deleteAllFiles: (confirmDeleteAll = true) => api.post('media-files/delete_all/', { confirm_delete_all: confirmDeleteAll }),
  getRestoreTiers: () => api.get('media-files/restore_tiers/'),
  getSmartTierSuggestion: (fileSize, fileType) => api.post('media-files/get_smart_tier_suggestion/', { file_size: fileSize, file_type: fileType }),
  getStorageCosts: () => api.get('media-files/get_storage_costs/'),
  getStorageCostsINR: () => api.get('media-files/get_storage_costs_inr/'),
  autoHibernateFiles: (options) => api.post('media-files/auto_hibernate_files/', options)
};

export const jobAPI = {
  getJobs: () => api.get('archive-jobs/'),
  getJobStats: () => api.get('archive-jobs/stats/')
};

export const s3ConfigAPI = {
  getConfig: () => api.get('s3-config/'),
  saveConfig: (data) => api.post('s3-config/', data)
};

export const hibernationAPI = {
  // Get all available hibernation plans
  getPlans: () => api.get('hibernation-plans/'),
  
  // Get plans grouped by storage tier
  getPlansGroupedByTier: () => api.get('hibernation-plans/grouped_by_tier/'),
  
  // Get user's current hibernation plan
  getCurrentPlan: () => api.get('user-hibernation-plans/current_plan/'),
  
  // Subscribe to a hibernation plan
  subscribe: (planId) => api.post('user-hibernation-plans/subscribe/', { plan_id: planId }),
  
  // Cancel subscription
  cancelSubscription: () => api.post('user-hibernation-plans/cancel_subscription/'),
  
  // Get usage statistics
  getUsageStats: () => api.get('user-hibernation-plans/usage_stats/'),
};

// Payment API
export const paymentAPI = {
  createOrder: (planId, amountInr) => {
    return api.post('/payments/create_order/', {
      plan_id: planId,
      amount_inr: amountInr,
      currency: 'INR'
    });
  },

  verifyPayment: (paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    return api.post('/payments/verify_payment/', {
      payment_id: paymentId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature
    });
  },

  getPaymentStatus: (paymentId) => {
    return api.get(`/payments/status/?payment_id=${paymentId}`);
  },

  // Payment monitoring
  getAll: () => api.get('/payments/'),
  getStats: () => api.get('/payments/stats/')
};

export const uppyAPI = {
  // Get presigned URL for S3 upload
  getPresignedUrl: (data) => api.post('uppy/presigned-url/', data),
  
  // Mark upload as complete
  markUploadComplete: (data) => api.post('uppy/upload-complete/', data),
  
  // Create upload session
  createSession: (data) => api.post('uppy/create-session/', data),
  
  // Get upload progress
  getProgress: (sessionId) => api.get(`uppy/upload-progress/?sessionId=${sessionId}`),
  
  // List uploaded files
  listFiles: () => api.get('uppy/files/'),
};

export default api;