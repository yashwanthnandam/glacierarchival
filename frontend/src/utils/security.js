/**
 * Security utilities for frontend XSS protection
 */

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (content) => {
  if (!content || typeof content !== 'string') return '';
  
  // Create a temporary div element
  const temp = document.createElement('div');
  temp.textContent = content;
  
  // Get the sanitized content
  const sanitized = temp.innerHTML;
  
  // Additional cleanup for dangerous patterns
  return sanitized
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
    .replace(/<form[^>]*>.*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<textarea[^>]*>.*?<\/textarea>/gi, '')
    .replace(/<select[^>]*>.*?<\/select>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    .replace(/<applet[^>]*>.*?<\/applet>/gi, '')
    .replace(/<param[^>]*>/gi, '')
    .replace(/<blink[^>]*>.*?<\/blink>/gi, '')
    .replace(/<marquee[^>]*>.*?<\/marquee>/gi, '')
    .replace(/<keygen[^>]*>/gi, '')
    .replace(/<isindex[^>]*>/gi, '')
    .replace(/<listing[^>]*>.*?<\/listing>/gi, '')
    .replace(/<plaintext[^>]*>.*?<\/plaintext>/gi, '')
    .replace(/<xmp[^>]*>.*?<\/xmp>/gi, '')
    .replace(/<xml[^>]*>.*?<\/xml>/gi, '')
    .replace(/<svg[^>]*>.*?<\/svg>/gi, '')
    .replace(/<math[^>]*>.*?<\/math>/gi, '');
};

// Sanitize filename to prevent path traversal
export const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') return 'unnamed_file';
  
  // Remove path components
  const name = filename.split('/').pop().split('\\').pop();
  
  // Remove dangerous characters
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
  const sanitized = name.replace(dangerousChars, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const parts = sanitized.split('.');
    if (parts.length > 1) {
      const ext = '.' + parts.pop();
      const nameWithoutExt = parts.join('.');
      return nameWithoutExt.substring(0, 255 - ext.length) + ext;
    }
    return sanitized.substring(0, 255);
  }
  
  return sanitized || 'unnamed_file';
};

// Sanitize user input for display
export const sanitizeUserInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  // Escape HTML entities
  const escaped = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove dangerous patterns
  return escaped
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
    .replace(/<form[^>]*>.*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<textarea[^>]*>.*?<\/textarea>/gi, '')
    .replace(/<select[^>]*>.*?<\/select>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    .replace(/<applet[^>]*>.*?<\/applet>/gi, '')
    .replace(/<param[^>]*>/gi, '')
    .replace(/<blink[^>]*>.*?<\/blink>/gi, '')
    .replace(/<marquee[^>]*>.*?<\/marquee>/gi, '')
    .replace(/<keygen[^>]*>/gi, '')
    .replace(/<isindex[^>]*>/gi, '')
    .replace(/<listing[^>]*>.*?<\/listing>/gi, '')
    .replace(/<plaintext[^>]*>.*?<\/plaintext>/gi, '')
    .replace(/<xmp[^>]*>.*?<\/xmp>/gi, '')
    .replace(/<xml[^>]*>.*?<\/xml>/gi, '')
    .replace(/<svg[^>]*>.*?<\/svg>/gi, '')
    .replace(/<math[^>]*>.*?<\/math>/gi, '')
    .substring(0, 1000); // Limit length
};

// Validate file type
export const validateFileType = (file) => {
  if (!file || !file.name) return false;
  
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', // Images
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', // Videos
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', // Audio
    '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages', // Documents
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', // Archives
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.html', '.css', '.scss', '.sass', '.json', '.xml', '.yaml', '.yml', // Code
  ];
  
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();
  return allowedExtensions.includes(fileExt);
};

// Validate file size
export const validateFileSize = (file, maxSize = 5 * 1024 * 1024 * 1024) => { // 5GB default
  if (!file || !file.size) return false;
  return file.size <= maxSize;
};

// Sanitize error messages
export const sanitizeErrorMessage = (message) => {
  if (!message || typeof message !== 'string') return 'An error occurred';
  
  return message
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
    .replace(/<form[^>]*>.*?<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<textarea[^>]*>.*?<\/textarea>/gi, '')
    .replace(/<select[^>]*>.*?<\/select>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '')
    .substring(0, 500); // Limit length
};

// Check for suspicious content in user input
export const containsSuspiciousContent = (input) => {
  if (!input || typeof input !== 'string') return false;
  
  const suspiciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /<form[^>]*>/i,
    /<input[^>]*>/i,
    /<textarea[^>]*>/i,
    /<select[^>]*>/i,
    /<link[^>]*>/i,
    /<meta[^>]*>/i,
    /<style[^>]*>/i,
    /<base[^>]*>/i,
    /<applet[^>]*>/i,
    /<param[^>]*>/i,
    /<blink[^>]*>/i,
    /<marquee[^>]*>/i,
    /<keygen[^>]*>/i,
    /<isindex[^>]*>/i,
    /<listing[^>]*>/i,
    /<plaintext[^>]*>/i,
    /<xmp[^>]*>/i,
    /<xml[^>]*>/i,
    /<svg[^>]*>/i,
    /<math[^>]*>/i,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
};

// Rate limiting helper
export const createRateLimiter = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();
  
  return (key) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this key
    const keyRequests = requests.get(key) || [];
    
    // Remove old requests
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    requests.set(key, validRequests);
    
    return true;
  };
};

// Content Security Policy helper
export const createCSPNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Secure storage helper
export const secureStorage = {
  setItem: (key, value) => {
    try {
      const sanitizedKey = sanitizeUserInput(key);
      const sanitizedValue = sanitizeUserInput(JSON.stringify(value));
      localStorage.setItem(sanitizedKey, sanitizedValue);
    } catch (error) {
      console.error('Secure storage setItem error:', error);
    }
  },
  
  getItem: (key) => {
    try {
      const sanitizedKey = sanitizeUserInput(key);
      const value = localStorage.getItem(sanitizedKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Secure storage getItem error:', error);
      return null;
    }
  },
  
  removeItem: (key) => {
    try {
      const sanitizedKey = sanitizeUserInput(key);
      localStorage.removeItem(sanitizedKey);
    } catch (error) {
      console.error('Secure storage removeItem error:', error);
    }
  }
};
