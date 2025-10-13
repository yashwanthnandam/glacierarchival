/**
 * Google Analytics Service
 * Provides methods to track custom events and user interactions
 */

class AnalyticsService {
  constructor() {
    this.measurementId = 'G-EH6V4R00H3';
    this.isInitialized = false;
    this.init();
  }

  init() {
    // Check if gtag is available
    if (typeof window !== 'undefined' && window.gtag) {
      this.isInitialized = true;
      console.log('Google Analytics initialized');
    } else {
      console.warn('Google Analytics not loaded');
    }
  }

  /**
   * Track page views
   */
  trackPageView(pageTitle, pagePath) {
    if (!this.isInitialized) return;
    
    window.gtag('config', this.measurementId, {
      page_title: pageTitle,
      page_location: window.location.href,
      page_path: pagePath
    });
  }

  /**
   * Track user registration
   */
  trackRegistration(method = 'email') {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'sign_up', {
      method: method,
      event_category: 'engagement',
      event_label: 'user_registration'
    });
  }

  /**
   * Track user login
   */
  trackLogin(method = 'email') {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'login', {
      method: method,
      event_category: 'engagement',
      event_label: 'user_login'
    });
  }

  /**
   * Track file upload events
   */
  trackFileUpload(fileCount, totalSizeBytes, uploadMethod = 'web') {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'file_upload', {
      event_category: 'file_management',
      event_label: 'upload',
      value: fileCount,
      custom_parameters: {
        file_count: fileCount,
        total_size_mb: Math.round(totalSizeBytes / (1024 * 1024)),
        upload_method: uploadMethod
      }
    });
  }

  /**
   * Track file download events
   */
  trackFileDownload(fileCount, totalSizeBytes) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'file_download', {
      event_category: 'file_management',
      event_label: 'download',
      value: fileCount,
      custom_parameters: {
        file_count: fileCount,
        total_size_mb: Math.round(totalSizeBytes / (1024 * 1024))
      }
    });
  }

  /**
   * Track file deletion events
   */
  trackFileDeletion(fileCount, totalSizeBytes) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'file_deletion', {
      event_category: 'file_management',
      event_label: 'delete',
      value: fileCount,
      custom_parameters: {
        file_count: fileCount,
        total_size_mb: Math.round(totalSizeBytes / (1024 * 1024))
      }
    });
  }

  /**
   * Track hibernation plan subscription
   */
  trackPlanSubscription(planName, planPrice, planStorage) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'purchase', {
      event_category: 'ecommerce',
      event_label: 'plan_subscription',
      value: planPrice,
      currency: 'INR',
      custom_parameters: {
        plan_name: planName,
        plan_price: planPrice,
        plan_storage_gb: planStorage
      }
    });
  }

  /**
   * Track payment events
   */
  trackPayment(paymentMethod, amount, currency = 'INR') {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'purchase', {
      event_category: 'ecommerce',
      event_label: 'payment',
      value: amount,
      currency: currency,
      custom_parameters: {
        payment_method: paymentMethod,
        amount: amount
      }
    });
  }

  /**
   * Track search events
   */
  trackSearch(searchTerm, resultCount) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'search', {
      event_category: 'engagement',
      event_label: 'file_search',
      search_term: searchTerm,
      custom_parameters: {
        result_count: resultCount
      }
    });
  }

  /**
   * Track error events
   */
  trackError(errorType, errorMessage, errorLocation) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'exception', {
      event_category: 'error',
      event_label: errorType,
      description: errorMessage,
      custom_parameters: {
        error_location: errorLocation,
        error_type: errorType
      }
    });
  }

  /**
   * Track custom events
   */
  trackCustomEvent(eventName, eventCategory, eventLabel, value = null, customParameters = {}) {
    if (!this.isInitialized) return;
    
    const eventData = {
      event_category: eventCategory,
      event_label: eventLabel,
      ...customParameters
    };
    
    if (value !== null) {
      eventData.value = value;
    }
    
    window.gtag('event', eventName, eventData);
  }

  /**
   * Track user engagement time
   */
  trackEngagementTime(timeSpentSeconds, pageName) {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'engagement_time', {
      event_category: 'engagement',
      event_label: pageName,
      value: timeSpentSeconds,
      custom_parameters: {
        time_spent_seconds: timeSpentSeconds,
        page_name: pageName
      }
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(featureName, action = 'used') {
    if (!this.isInitialized) return;
    
    window.gtag('event', 'feature_usage', {
      event_category: 'engagement',
      event_label: featureName,
      custom_parameters: {
        feature_name: featureName,
        action: action
      }
    });
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;
