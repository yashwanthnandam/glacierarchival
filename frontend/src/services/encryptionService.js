/**
 * Glacier Archival Platform - E2E Encryption Service
 * 
 * This service integrates the open-source encryption library with the upload/download flow.
 * It provides a clean API for encrypting files before upload and decrypting after download.
 * 
 * Features:
 * - Seamless integration with existing upload system
 * - Progress tracking for encryption/decryption
 * - Error handling and recovery
 * - Memory-efficient streaming for large files
 * - Automatic metadata management
 */

import GlacierEncryption from '../utils/glacierEncryption.js';

class EncryptionService {
  constructor() {
    this.encryption = new GlacierEncryption();
    this.isEncryptionEnabled = false;
    this.masterPassword = null;
    this.encryptionCache = new Map(); // Cache for metadata
  }

  /**
   * Ensure encryption is initialized. If not, auto-initialize with a persisted
   * random key so encryption is enabled by default without user action.
   */
  async ensureInitialized() {
    try {
      if (this.isEnabled()) return true;
      // Persist a random master key in localStorage (scoped to this browser)
      let storedKey = null;
      try {
        storedKey = window.localStorage.getItem('dh_master_key');
      } catch (_) {
        // ignore storage access errors
      }
      if (!storedKey) {
        const bytes = new Uint8Array(32);
        (window.crypto || window.msCrypto).getRandomValues(bytes);
        // Convert to hex
        storedKey = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        try {
          window.localStorage.setItem('dh_master_key', storedKey);
        } catch (_) { /* ignore */ }
      }
      await this.initializeEncryption(storedKey);
      return true;
    } catch (e) {
      // If auto-init fails, keep disabled but do not throw
      return false;
    }
  }

  /**
   * Initialize encryption with master password
   * @param {string} password - Master password
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initializeEncryption(password) {
    try {
      if (!password || password.length < 8) {
        throw new Error('Master password must be at least 8 characters');
      }

      // Verify encryption works with this password
      const isValid = await this.encryption.verifyEncryption(password);
      if (!isValid) {
        throw new Error('Encryption verification failed');
      }

      this.masterPassword = password;
      this.isEncryptionEnabled = true;
      
      console.log('E2E Encryption initialized successfully');
      return true;
    } catch (error) {
      console.error('Encryption initialization failed:', error);
      this.isEncryptionEnabled = false;
      this.masterPassword = null;
      throw error;
    }
  }

  /**
   * Disable encryption
   */
  disableEncryption() {
    this.isEncryptionEnabled = false;
    this.masterPassword = null;
    this.encryptionCache.clear();
    console.log('E2E Encryption disabled');
  }

  /**
   * Check if encryption is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.isEncryptionEnabled && !!this.masterPassword;
  }

  /**
   * Encrypt file before upload
   * @param {File} file - File to encrypt
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{encryptedFile: File, metadata: Object}>}
   */
  async encryptFileForUpload(file, onProgress = null) {
    if (!this.isEnabled()) {
      throw new Error('Encryption not initialized');
    }

    try {
      if (onProgress) onProgress(0, 'Starting encryption...');

      // Store original file metadata
      const originalMetadata = {
        originalName: file.name,
        originalType: file.type,
        originalSize: file.size,
        originalLastModified: file.lastModified
      };

      if (onProgress) onProgress(25, 'Reading file data...');

      // Encrypt the file
      const { encryptedFile, metadata } = await this.encryption.encryptFileObject(
        file, 
        this.masterPassword
      );

      if (onProgress) onProgress(75, 'Finalizing encryption...');

      // Add original metadata to encryption metadata
      metadata.originalMetadata = originalMetadata;

      // Cache metadata for later use
      this.encryptionCache.set(file.name, metadata);

      if (onProgress) onProgress(100, 'Encryption complete');

      console.log(`File encrypted: ${file.name} (${file.size} → ${encryptedFile.size} bytes)`);
      
      return {
        encryptedFile,
        metadata
      };
    } catch (error) {
      console.error('File encryption failed:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file after download
   * @param {File} encryptedFile - Encrypted file
   * @param {Object} metadata - Encryption metadata
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<File>}
   */
  async decryptFileAfterDownload(encryptedFile, metadata, onProgress = null) {
    if (!this.isEnabled()) {
      throw new Error('Encryption not initialized');
    }

    try {
      if (onProgress) onProgress(0, 'Starting decryption...');

      if (onProgress) onProgress(25, 'Reading encrypted data...');

      // Decrypt the file
      const decryptedFile = await this.encryption.decryptFileObject(
        encryptedFile,
        metadata,
        this.masterPassword
      );

      if (onProgress) onProgress(75, 'Restoring file properties...');

      // Restore original file properties if available
      if (metadata.originalMetadata) {
        const original = metadata.originalMetadata;
        Object.defineProperty(decryptedFile, 'name', {
          value: original.originalName,
          writable: false
        });
        Object.defineProperty(decryptedFile, 'type', {
          value: original.originalType,
          writable: false
        });
      }

      if (onProgress) onProgress(100, 'Decryption complete');

      console.log(`File decrypted: ${encryptedFile.name} (${encryptedFile.size} → ${decryptedFile.size} bytes)`);
      
      return decryptedFile;
    } catch (error) {
      console.error('File decryption failed:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Get encryption metadata for a file
   * @param {string} fileName - File name
   * @returns {Object|null} - Encryption metadata or null
   */
  getEncryptionMetadata(fileName) {
    return this.encryptionCache.get(fileName) || null;
  }

  /**
   * Store encryption metadata
   * @param {string} fileName - File name
   * @param {Object} metadata - Encryption metadata
   */
  storeEncryptionMetadata(fileName, metadata) {
    this.encryptionCache.set(fileName, metadata);
  }

  /**
   * Clear encryption metadata
   * @param {string} fileName - File name
   */
  clearEncryptionMetadata(fileName) {
    this.encryptionCache.delete(fileName);
  }

  /**
   * Get encryption status and info
   * @returns {Object} - Encryption status and information
   */
  getEncryptionStatus() {
    const info = this.encryption.getEncryptionInfo();
    
    return {
      enabled: this.isEnabled(),
      initialized: !!this.masterPassword,
      algorithm: info.algorithm,
      keyLength: info.keyLength,
      features: info.features,
      securityLevel: info.securityLevel,
      compliance: info.compliance,
      cachedFiles: this.encryptionCache.size
    };
  }

  /**
   * Test encryption with sample data
   * @returns {Promise<Object>} - Test results
   */
  async testEncryption() {
    if (!this.isEnabled()) {
      throw new Error('Encryption not initialized');
    }

    try {
      const startTime = Date.now();
      
      // Create test file
      const testContent = 'Glacier Archival E2E Encryption Test - ' + new Date().toISOString();
      const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
      
      // Test encryption
      const { encryptedFile, metadata } = await this.encryptFileForUpload(testFile);
      
      // Test decryption
      const decryptedFile = await this.decryptFileAfterDownload(encryptedFile, metadata);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify content
      const decryptedContent = await decryptedFile.text();
      const isContentValid = decryptedContent === testContent;
      
      return {
        success: isContentValid,
        duration: duration,
        originalSize: testFile.size,
        encryptedSize: encryptedFile.size,
        decryptedSize: decryptedFile.size,
        compressionRatio: (encryptedFile.size / testFile.size).toFixed(2),
        message: isContentValid ? 'Encryption test passed' : 'Encryption test failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Encryption test failed'
      };
    }
  }

  /**
   * Get memory usage information
   * @returns {Object} - Memory usage stats
   */
  getMemoryUsage() {
    return {
      cacheSize: this.encryptionCache.size,
      cacheKeys: Array.from(this.encryptionCache.keys()),
      memoryEstimate: this.encryptionCache.size * 1024 // Rough estimate
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.encryptionCache.clear();
    console.log('Encryption cache cleared');
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

// Export singleton instance
export default encryptionService;

// Also export class for testing
export { EncryptionService };

/**
 * Usage Examples:
 * 
 * // Initialize encryption
 * await encryptionService.initializeEncryption('your-master-password');
 * 
 * // Encrypt file before upload
 * const { encryptedFile, metadata } = await encryptionService.encryptFileForUpload(file, (progress, status) => {
 *   console.log(`Encryption: ${progress}% - ${status}`);
 * });
 * 
 * // Decrypt file after download
 * const decryptedFile = await encryptionService.decryptFileAfterDownload(encryptedFile, metadata, (progress, status) => {
 *   console.log(`Decryption: ${progress}% - ${status}`);
 * });
 * 
 * // Check encryption status
 * const status = encryptionService.getEncryptionStatus();
 * console.log('Encryption enabled:', status.enabled);
 * 
 * // Test encryption
 * const testResult = await encryptionService.testEncryption();
 * console.log('Test result:', testResult);
 */
