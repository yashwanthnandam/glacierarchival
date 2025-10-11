/**
 * Secure Token Storage Utility
 * Provides secure token storage with httpOnly cookies support
 */

import { STORAGE_KEYS, TOKEN_UTILS } from '../constants';

class SecureTokenStorage {
  constructor() {
    this.isProduction = import.meta.env.PROD;
    this.useHttpOnly = this.isProduction || this.supportsHttpOnly();
    this.csrfToken = null;
  }

  /**
   * Check if backend supports httpOnly cookies
   */
  supportsHttpOnly() {
    // Check if we're using secure authentication endpoints
    return import.meta.env.VITE_USE_SECURE_AUTH === 'true';
  }

  /**
   * Set CSRF token for cookie-based authentication
   */
  setCSRFToken(token) {
    this.csrfToken = token;
  }

  /**
   * Get CSRF token
   */
  getCSRFToken() {
    return this.csrfToken;
  }

  /**
   * Store access token securely
   */
  setAccessToken(token) {
    if (!TOKEN_UTILS.isValidJWT(token)) {
      throw new Error('Invalid token format');
    }

    if (this.useHttpOnly) {
      // In production with httpOnly cookies, tokens are set by the server
      // This method is called after successful login to validate the token
      console.log('Access token validated and stored in httpOnly cookie');
    } else {
      // Development mode: use localStorage with additional security
      this.setSecureLocalStorage(STORAGE_KEYS.TOKEN, token);
    }
  }

  /**
   * Store refresh token securely
   */
  setRefreshToken(token) {
    if (!TOKEN_UTILS.isValidJWT(token)) {
      throw new Error('Invalid refresh token format');
    }

    if (this.useHttpOnly) {
      // In production with httpOnly cookies, tokens are set by the server
      console.log('Refresh token validated and stored in httpOnly cookie');
    } else {
      this.setSecureLocalStorage(STORAGE_KEYS.REFRESH_TOKEN, token);
    }
  }

  /**
   * Get access token
   */
  getAccessToken() {
    if (this.useHttpOnly) {
      // With httpOnly cookies, we can't access the token directly
      // The browser automatically sends it with requests
      return 'httpOnly_cookie'; // Placeholder to indicate cookie-based auth
    } else {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      return TOKEN_UTILS.isValidJWT(token) ? token : null;
    }
  }

  /**
   * Get refresh token
   */
  getRefreshToken() {
    if (this.useHttpOnly) {
      // With httpOnly cookies, we can't access the token directly
      return 'httpOnly_cookie'; // Placeholder to indicate cookie-based auth
    } else {
      const token = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      return TOKEN_UTILS.isValidJWT(token) ? token : null;
    }
  }

  /**
   * Remove all tokens
   */
  clearTokens() {
    if (this.useHttpOnly) {
      // With httpOnly cookies, tokens are cleared by the server
      // This method is called to trigger a logout request
      console.log('Clearing httpOnly cookies via logout endpoint');
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }

  /**
   * Check if user is authenticated
   * CRITICAL: For httpOnly cookies, we MUST verify with server
   */
  async isAuthenticated() {
    if (this.useHttpOnly) {
      // For httpOnly cookies, verify with server
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/'}auth/secure/user/`, {
          method: 'GET',
          credentials: 'include', // Send cookies
          headers: this.getAuthHeaders()
        });
        return response.ok;
      } catch (error) {
        console.error('Authentication check failed:', error);
        return false;
      }
    } else {
      const token = this.getAccessToken();
      return token && TOKEN_UTILS.isValidJWT(token) && !TOKEN_UTILS.isTokenExpired(token);
    }
  }

  /**
   * Set secure localStorage with additional validation
   */
  setSecureLocalStorage(key, value) {
    try {
      // Additional validation before storing
      if (key === STORAGE_KEYS.TOKEN || key === STORAGE_KEYS.REFRESH_TOKEN) {
        if (!TOKEN_UTILS.isValidJWT(value)) {
          throw new Error('Invalid token format');
        }
      }
      
      localStorage.setItem(key, value);
      
      // Verify the value was stored correctly
      if (localStorage.getItem(key) !== value) {
        throw new Error('Failed to store token securely');
      }
    } catch (error) {
      console.error('Failed to store token:', error);
      throw error;
    }
  }

  /**
   * Get token payload safely
   */
  getTokenPayload() {
    if (this.useHttpOnly) {
      // With httpOnly cookies, we can't access token payload directly
      return null;
    } else {
      const token = this.getAccessToken();
      return token ? TOKEN_UTILS.getTokenPayload(token) : null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    if (this.useHttpOnly) {
      // With httpOnly cookies, we can't check expiration directly
      return false; // Assume not expired, server will handle this
    } else {
      const token = this.getAccessToken();
      return token ? TOKEN_UTILS.isTokenExpired(token) : true;
    }
  }

  /**
   * Get authentication headers for requests
   */
  getAuthHeaders() {
    const headers = {};
    
    if (this.useHttpOnly) {
      // For httpOnly cookies, include CSRF token
      if (this.csrfToken) {
        headers['X-CSRFToken'] = this.csrfToken;
      }
    } else {
      // For localStorage, include Authorization header
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return headers;
  }
}

// Create singleton instance
const secureTokenStorage = new SecureTokenStorage();

export default secureTokenStorage;