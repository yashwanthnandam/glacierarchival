"""
Middleware for hibernation plan enforcement and rate limiting
"""
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache
from django.conf import settings
from .models import UserHibernationPlan
from django.utils import timezone
import time
import hashlib


class HibernationPlanMiddleware(MiddlewareMixin):
    """
    Middleware to enforce hibernation plan requirements for file operations
    """
    
    def process_request(self, request):
        """Check hibernation plan requirements for file operations"""
        # Skip for non-authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
        
        # Skip for certain endpoints that don't require plans
        exempt_paths = [
            '/api/hibernation-plans/',
            '/api/user-hibernation-plans/',
            '/api/auth/',
            '/api/s3-config/',
        ]
        
        if any(request.path.startswith(path) for path in exempt_paths):
            return None
        
        # Check if user has an active hibernation plan
        try:
            user_plan = UserHibernationPlan.objects.get(
                user=request.user, 
                is_active=True
            )
            
            # Check if plan is expired
            if user_plan.is_expired():
                return JsonResponse({
                    'error': 'Hibernation plan has expired. Please renew your subscription.',
                    'plan_expired': True,
                    'expires_at': user_plan.expires_at.isoformat()
                }, status=402)  # Payment Required
            
            # Add plan info to request for use in views
            request.user_plan = user_plan
            
        except UserHibernationPlan.DoesNotExist:
            # Check if this is a file operation that requires a plan
            file_operation_paths = [
                '/api/media-files/upload/',
                '/api/media-files/',
                '/api/uppy/',
            ]
            
            if any(request.path.startswith(path) for path in file_operation_paths):
                # Check if user is within free tier limit (15GB)
                from django.db.models import Sum
                from .models import MediaFile
                
                total_storage_bytes = MediaFile.objects.filter(
                    user=request.user, 
                    is_deleted=False
                ).aggregate(total=Sum('file_size'))['total'] or 0
                
                free_tier_limit_bytes = 15 * 1024 * 1024 * 1024  # 15GB
                
                if total_storage_bytes >= free_tier_limit_bytes:
                    return JsonResponse({
                        'error': 'Free tier limit exceeded (15GB)',
                        'plan_required': True,
                        'message': 'You have reached the 15GB free tier limit. Please subscribe to a hibernation plan to continue uploading files.',
                        'free_tier_used': total_storage_bytes,
                        'free_tier_limit': free_tier_limit_bytes
                    }, status=402)  # Payment Required
                
                # User is within free tier, allow the operation
                return None
        
        return None


class RateLimitMiddleware(MiddlewareMixin):
    """
    Rate limiting middleware to prevent DoS attacks and abuse
    """
    
    def process_request(self, request):
        """Apply rate limiting to requests"""
        # Skip for non-authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
        
        # Get user identifier
        user_id = request.user.id
        user_key = f"rate_limit_user_{user_id}"
        
        # Different limits for different types of operations
        if request.path.startswith('/api/uppy/'):
            # Upload operations - allow concurrent batch uploads (3 workers × 50 files = 150 requests)
            limit = 400  # 400 requests per minute (for concurrent batch uploads)
            window = 60  # 1 minute window
        elif request.path.startswith('/api/media-files/'):
            # File operations - moderate limit
            limit = 30  # 30 requests per minute
            window = 60  # 1 minute window
        else:
            # Other API calls - more lenient
            limit = 100  # 100 requests per minute
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
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'message': f'Too many requests. Limit: {limit} requests per {window} seconds',
                'retry_after': window,
                'limit': limit,
                'window': window
            }, status=429)  # Too Many Requests
        
        # Add current request
        requests.append(current_time)
        
        # Store updated requests
        cache.set(user_key, requests, window + 10)  # Cache for slightly longer than window
        
        return None


class FileSizeLimitMiddleware(MiddlewareMixin):
    """
    Middleware to enforce file size limits before processing
    """
    
    def process_request(self, request):
        """Check file size limits before processing"""
        # Only check multipart/form-data requests
        if not request.content_type or not request.content_type.startswith('multipart/form-data'):
            return None
        
        # Check Content-Length header
        content_length = request.META.get('CONTENT_LENGTH')
        if content_length:
            try:
                content_length = int(content_length)
                max_size = getattr(settings, 'MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024)  # 5GB default
                
                if content_length > max_size:
                    return JsonResponse({
                        'error': 'File too large',
                        'message': f'File size exceeds maximum allowed size of {max_size // (1024*1024)}MB',
                        'max_size': max_size,
                        'received_size': content_length
                    }, status=413)  # Payload Too Large
                    
            except (ValueError, TypeError):
                pass  # Invalid content length, let Django handle it
        
        return None


class UploadValidationMiddleware(MiddlewareMixin):
    """
    Middleware to validate upload requests before processing
    """
    
    def process_request(self, request):
        """Validate upload requests"""
        # Only check upload endpoints
        if not any(request.path.startswith(path) for path in ['/api/uppy/', '/api/media-files/upload/']):
            return None
        
        # Skip for non-authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
        
        # Check if user has exceeded concurrent upload limit
        user_id = request.user.id
        concurrent_key = f"concurrent_uploads_{user_id}"
        current_uploads = cache.get(concurrent_key, 0)
        
        max_concurrent = getattr(settings, 'MAX_CONCURRENT_UPLOADS', 3)
        if current_uploads >= max_concurrent:
            return JsonResponse({
                'error': 'Too many concurrent uploads',
                'message': f'Maximum {max_concurrent} concurrent uploads allowed',
                'current_uploads': current_uploads,
                'max_concurrent': max_concurrent
            }, status=429)
        
        return None
    
    def process_response(self, request, response):
        """Track upload completion"""
        # Only track upload endpoints
        if not any(request.path.startswith(path) for path in ['/api/uppy/', '/api/media-files/upload/']):
            return response
        
        # Skip for non-authenticated users
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return response
        
        # Track upload completion
        user_id = request.user.id
        concurrent_key = f"concurrent_uploads_{user_id}"
        
        if request.method == 'POST':
            # Increment on upload start
            current_uploads = cache.get(concurrent_key, 0)
            cache.set(concurrent_key, current_uploads + 1, 3600)  # 1 hour TTL
        elif request.method in ['PUT', 'PATCH'] and response.status_code in [200, 201]:
            # Decrement on upload completion
            current_uploads = cache.get(concurrent_key, 0)
            if current_uploads > 0:
                cache.set(concurrent_key, current_uploads - 1, 3600)
        
        return response
