"""
Security utilities for Data Hibernate application
"""

import re
import html
from django.utils.html import escape
from django.http import HttpResponse
from django.conf import settings


def sanitize_filename(filename):
    """
    Sanitize filename to prevent path traversal and XSS attacks
    """
    if not filename:
        return "unnamed_file"
    
    # Remove any path components
    filename = filename.split('/')[-1].split('\\')[-1]
    
    # Remove dangerous characters
    dangerous_chars = r'[<>:"/\\|?*\x00-\x1f]'
    filename = re.sub(dangerous_chars, '_', filename)
    
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        max_name_length = 255 - len(ext) - 1 if ext else 255
        filename = name[:max_name_length] + ('.' + ext if ext else '')
    
    return filename or "unnamed_file"


def sanitize_html_content(content):
    """
    Sanitize HTML content to prevent XSS attacks
    """
    if not content:
        return ""
    
    # Escape HTML entities
    content = html.escape(content)
    
    # Remove script tags and dangerous attributes
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>.*?</iframe>',
        r'<object[^>]*>.*?</object>',
        r'<embed[^>]*>.*?</embed>',
        r'<form[^>]*>.*?</form>',
        r'<input[^>]*>',
        r'<textarea[^>]*>.*?</textarea>',
        r'<select[^>]*>.*?</select>',
    ]
    
    for pattern in dangerous_patterns:
        content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.DOTALL)
    
    return content


def validate_file_content(file):
    """
    Validate file content to prevent malicious uploads
    """
    # Check file extension against allowed types
    allowed_extensions = {
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',  # Images
        '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',  # Videos
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',  # Audio
        '.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages',  # Documents
        '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',  # Archives
        '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.html', '.css', '.scss', '.sass', '.json', '.xml', '.yaml', '.yml',  # Code
    }
    
    if hasattr(file, 'name'):
        file_ext = '.' + file.name.split('.')[-1].lower() if '.' in file.name else ''
        if file_ext not in allowed_extensions:
            raise ValueError(f"File type {file_ext} is not allowed")
    
    # Check for suspicious content patterns
    if hasattr(file, 'read'):
        # Read first 1KB to check for suspicious patterns
        original_position = file.tell()
        file.seek(0)
        content_sample = file.read(1024)
        file.seek(original_position)
        
        # Check for executable signatures
        executable_signatures = [
            b'MZ',  # PE executable
            b'\x7fELF',  # ELF executable
            b'\xfe\xed\xfa',  # Mach-O executable
            b'#!/',  # Shell script
        ]
        
        for signature in executable_signatures:
            if content_sample.startswith(signature):
                raise ValueError("File appears to be an executable and is not allowed")
        
        # Check for script tags in text files
        if file.name.lower().endswith(('.txt', '.html', '.htm', '.xml', '.json')):
            if b'<script' in content_sample.lower():
                raise ValueError("File contains script tags and is not allowed")


def add_security_headers(response):
    """
    Add security headers to HTTP response
    """
    # Content Security Policy
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.razorpay.com; "
        "frame-src https://checkout.razorpay.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none';"
    )
    response['Content-Security-Policy'] = csp_policy
    
    # X-Frame-Options
    response['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options
    response['X-Content-Type-Options'] = 'nosniff'
    
    # X-XSS-Protection
    response['X-XSS-Protection'] = '1; mode=block'
    
    # Referrer-Policy
    response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions-Policy
    response['Permissions-Policy'] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "speaker=(), "
        "vibrate=(), "
        "fullscreen=(self), "
        "sync-xhr=()"
    )
    
    return response


def validate_user_input(data, field_name, max_length=1000):
    """
    Validate user input to prevent XSS and injection attacks
    """
    if not isinstance(data, str):
        return data
    
    # Check length
    if len(data) > max_length:
        raise ValueError(f"{field_name} is too long (max {max_length} characters)")
    
    # Check for suspicious patterns
    suspicious_patterns = [
        r'<script[^>]*>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>',
        r'<object[^>]*>',
        r'<embed[^>]*>',
        r'<form[^>]*>',
        r'<input[^>]*>',
        r'<textarea[^>]*>',
        r'<select[^>]*>',
        r'<link[^>]*>',
        r'<meta[^>]*>',
        r'<style[^>]*>',
        r'<base[^>]*>',
        r'<applet[^>]*>',
        r'<param[^>]*>',
        r'<blink[^>]*>',
        r'<marquee[^>]*>',
        r'<keygen[^>]*>',
        r'<isindex[^>]*>',
        r'<listing[^>]*>',
        r'<plaintext[^>]*>',
        r'<xmp[^>]*>',
        r'<xml[^>]*>',
        r'<svg[^>]*>',
        r'<math[^>]*>',
        r'<mi[^>]*>',
        r'<mo[^>]*>',
        r'<mn[^>]*>',
        r'<ms[^>]*>',
        r'<mtext[^>]*>',
        r'<annotation-xml[^>]*>',
        r'<foreignObject[^>]*>',
        r'<desc[^>]*>',
        r'<title[^>]*>',
        r'<use[^>]*>',
        r'<set[^>]*>',
        r'<animate[^>]*>',
        r'<animateMotion[^>]*>',
        r'<animateTransform[^>]*>',
        r'<circle[^>]*>',
        r'<ellipse[^>]*>',
        r'<line[^>]*>',
        r'<path[^>]*>',
        r'<polygon[^>]*>',
        r'<polyline[^>]*>',
        r'<rect[^>]*>',
        r'<text[^>]*>',
        r'<tspan[^>]*>',
        r'<textPath[^>]*>',
        r'<marker[^>]*>',
        r'<pattern[^>]*>',
        r'<clipPath[^>]*>',
        r'<mask[^>]*>',
        r'<linearGradient[^>]*>',
        r'<radialGradient[^>]*>',
        r'<stop[^>]*>',
        r'<defs[^>]*>',
        r'<g[^>]*>',
        r'<symbol[^>]*>',
        r'<image[^>]*>',
        r'<switch[^>]*>',
        r'<foreignObject[^>]*>',
        r'<marker[^>]*>',
        r'<pattern[^>]*>',
        r'<clipPath[^>]*>',
        r'<mask[^>]*>',
        r'<linearGradient[^>]*>',
        r'<radialGradient[^>]*>',
        r'<stop[^>]*>',
        r'<defs[^>]*>',
        r'<g[^>]*>',
        r'<symbol[^>]*>',
        r'<image[^>]*>',
        r'<switch[^>]*>',
    ]
    
    for pattern in suspicious_patterns:
        if re.search(pattern, data, re.IGNORECASE):
            raise ValueError(f"{field_name} contains potentially dangerous content")
    
    # Escape HTML entities
    return html.escape(data)


def log_security_event(event_type, user, details):
    """
    Log security events for monitoring
    """
    import logging
    logger = logging.getLogger('security')
    
    log_data = {
        'event_type': event_type,
        'user': str(user) if user else 'anonymous',
        'details': details,
        'timestamp': str(timezone.now()),
    }
    
    logger.warning(f"Security event: {log_data}")


def rate_limit_check(user, action, limit=100, window=3600):
    """
    Check if user has exceeded rate limit for an action
    """
    from django.core.cache import cache
    from django.utils import timezone
    
    if not user or not user.is_authenticated:
        return True
    
    cache_key = f"rate_limit_{user.id}_{action}"
    current_time = timezone.now().timestamp()
    window_start = current_time - window
    
    # Get existing requests
    requests = cache.get(cache_key, [])
    
    # Remove old requests
    requests = [req_time for req_time in requests if req_time > window_start]
    
    # Check if limit exceeded
    if len(requests) >= limit:
        return False
    
    # Add current request
    requests.append(current_time)
    cache.set(cache_key, requests, window + 10)
    
    return True
