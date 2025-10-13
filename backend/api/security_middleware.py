"""
Security middleware for Data Hibernate application
"""

from django.http import HttpResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
import logging
import re
import time

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Add security headers to all responses
    """
    
    def process_response(self, request, response):
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


class XSSProtectionMiddleware(MiddlewareMixin):
    """
    Protect against XSS attacks by validating and sanitizing input
    """
    
    def process_request(self, request):
        # Check for suspicious patterns in request data
        suspicious_patterns = [
            r'<script[^>]*>',
            r'javascript:',
            r'on(load|click|mouseover|mouseout|focus|blur|change|submit|reset|select|keydown|keyup|keypress)\s*=',
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
        ]
        
        # Check GET parameters
        for key, value in request.GET.items():
            if isinstance(value, str):
                for pattern in suspicious_patterns:
                    if re.search(pattern, value, re.IGNORECASE):
                        logger.warning(f"XSS attempt detected in GET parameter {key}: {value}")
                        return HttpResponse('Bad Request', status=400)
        
        # Check POST data
        if request.method == 'POST':
            for key, value in request.POST.items():
                if isinstance(value, str):
                    for pattern in suspicious_patterns:
                        if re.search(pattern, value, re.IGNORECASE):
                            logger.warning(f"XSS attempt detected in POST parameter {key}: {value}")
                            return HttpResponse('Bad Request', status=400)
        
        # Check headers (exclude cookies and other safe headers)
        safe_headers = ['HTTP_COOKIE', 'HTTP_HOST', 'HTTP_USER_AGENT', 'HTTP_ACCEPT', 'HTTP_ACCEPT_LANGUAGE', 'HTTP_ACCEPT_ENCODING', 'HTTP_CONNECTION', 'HTTP_UPGRADE_INSECURE_REQUESTS', 'HTTP_CACHE_CONTROL', 'HTTP_PRAGMA']
        for header_name, header_value in request.META.items():
            if isinstance(header_value, str) and header_name not in safe_headers:
                for pattern in suspicious_patterns:
                    if re.search(pattern, header_value, re.IGNORECASE):
                        logger.warning(f"XSS attempt detected in header {header_name}: {header_value}")
                        return HttpResponse('Bad Request', status=400)
        
        return None


class InputValidationMiddleware(MiddlewareMixin):
    """
    Validate and sanitize user input
    """
    
    def process_request(self, request):
        # Validate file uploads
        if request.method == 'POST' and 'file' in request.FILES:
            for file in request.FILES.getlist('file'):
                # Check file name
                if hasattr(file, 'name'):
                    filename = file.name
                    # Remove path components
                    filename = filename.split('/')[-1].split('\\')[-1]
                    
                    # Check for dangerous characters
                    dangerous_chars = r'[<>:"/\\|?*\x00-\x1f]'
                    if re.search(dangerous_chars, filename):
                        logger.warning(f"Dangerous filename detected: {filename}")
                        return HttpResponse('Invalid filename', status=400)
                    
                    # Check for suspicious extensions
                    suspicious_extensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh', '.ps1']
                    file_ext = '.' + filename.split('.')[-1].lower() if '.' in filename else ''
                    if file_ext in suspicious_extensions:
                        logger.warning(f"Suspicious file extension detected: {file_ext}")
                        return HttpResponse('File type not allowed', status=400)
        
        # Validate request data length
        if request.method == 'POST':
            content_length = request.META.get('CONTENT_LENGTH', 0)
            if content_length and int(content_length) > 100 * 1024 * 1024:  # 100MB limit
                logger.warning(f"Request too large: {content_length} bytes")
                return HttpResponse('Request too large', status=413)
        
        return None


class SecurityLoggingMiddleware(MiddlewareMixin):
    """
    Log security events for monitoring
    """
    
    def process_request(self, request):
        # Log suspicious requests
        if request.method == 'POST':
            # Check for common attack patterns
            attack_patterns = [
                r'union\s+select',
                r'drop\s+table',
                r'delete\s+from',
                r'insert\s+into',
                r'update\s+set',
                r'exec\s*\(',
                r'eval\s*\(',
                r'system\s*\(',
                r'shell_exec\s*\(',
                r'passthru\s*\(',
                r'file_get_contents\s*\(',
                r'file_put_contents\s*\(',
                r'fopen\s*\(',
                r'fwrite\s*\(',
                r'fread\s*\(',
                r'include\s*\(',
                r'require\s*\(',
                r'include_once\s*\(',
                r'require_once\s*\(',
            ]
            
            for key, value in request.POST.items():
                if isinstance(value, str):
                    for pattern in attack_patterns:
                        if re.search(pattern, value, re.IGNORECASE):
                            logger.warning(f"Potential injection attack detected in POST parameter {key}: {value}")
                            break
        
        return None


class RateLimitMiddleware(MiddlewareMixin):
    """
    Enhanced rate limiting with security focus
    """
    
    def process_request(self, request):
        # Skip for non-authenticated users on public endpoints
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            # Allow public endpoints
            if request.path.startswith('/api/auth/') or request.path.startswith('/api/register/'):
                return None
            return None
        
        user_id = request.user.id
        user_key = f"rate_limit_user_{user_id}"
        
        # Different limits for different types of operations
        if request.path.startswith('/api/uppy/'):
            # Upload operations - stricter limits
            limit = 400  # Increased to 400 requests per minute
            window = 60  # 1 minute window
        elif request.path.startswith('/api/media-files/'):
            # File operations - moderate limit
            limit = 20  # Reduced from 30
            window = 60  # 1 minute window
        elif request.path.startswith('/api/auth/'):
            # Authentication - very strict limits
            limit = 5   # Reduced from 20
            window = 300  # 5 minute window
        else:
            # Other API calls - standard limit
            limit = 50  # Reduced from 100
            window = 60  # 1 minute window
        
        # Check current request count
        current_time = int(time.time())
        window_start = current_time - window
        
        # Get existing requests from cache
        requests = cache.get(user_key, [])
        
        # Remove old requests outside the window
        requests = [req_time for req_time in requests if req_time > window_start]
        
        # Check if limit exceeded
        if len(requests) >= limit:
            logger.warning(f"Rate limit exceeded for user {user_id} on {request.path}")
            return HttpResponse('Rate limit exceeded', status=429)
        
        # Add current request
        requests.append(current_time)
        
        # Store updated requests
        cache.set(user_key, requests, window + 10)
        
        return None
