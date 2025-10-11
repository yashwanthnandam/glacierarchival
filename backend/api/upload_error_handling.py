"""
Comprehensive error handling for upload operations
"""
from django.http import JsonResponse
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)

class UploadError(Exception):
    """Base exception for upload errors"""
    def __init__(self, message, error_type=None, details=None, status_code=400):
        self.message = message
        self.error_type = error_type
        self.details = details
        self.status_code = status_code
        super().__init__(message)

class FileSizeError(UploadError):
    """File size related errors"""
    def __init__(self, file_size, max_size, filename=None):
        self.file_size = file_size
        self.max_size = max_size
        self.filename = filename
        super().__init__(
            message=f"File size exceeds maximum allowed size of {max_size // (1024*1024)}MB",
            error_type="FILE_SIZE_EXCEEDED",
            details={
                "file_size": file_size,
                "max_size": max_size,
                "filename": filename,
                "file_size_mb": file_size // (1024*1024),
                "max_size_mb": max_size // (1024*1024)
            },
            status_code=413
        )

class StorageLimitError(UploadError):
    """Storage limit related errors"""
    def __init__(self, current_usage, limit, additional_size=0):
        self.current_usage = current_usage
        self.limit = limit
        self.additional_size = additional_size
        super().__init__(
            message="Storage limit exceeded. Please subscribe to a hibernation plan to continue.",
            error_type="STORAGE_LIMIT_EXCEEDED",
            details={
                "current_usage": current_usage,
                "limit": limit,
                "additional_size": additional_size,
                "current_usage_gb": current_usage / (1024**3),
                "limit_gb": limit / (1024**3),
                "remaining_space": max(0, limit - current_usage)
            },
            status_code=402
        )

class ConcurrentUploadError(UploadError):
    """Concurrent upload limit errors"""
    def __init__(self, current_uploads, max_concurrent):
        self.current_uploads = current_uploads
        self.max_concurrent = max_concurrent
        super().__init__(
            message=f"Too many concurrent uploads. Maximum {max_concurrent} allowed.",
            error_type="CONCURRENT_UPLOAD_LIMIT",
            details={
                "current_uploads": current_uploads,
                "max_concurrent": max_concurrent,
                "remaining_slots": max(0, max_concurrent - current_uploads)
            },
            status_code=429
        )

class RateLimitError(UploadError):
    """Rate limit errors"""
    def __init__(self, limit, window, retry_after=None):
        self.limit = limit
        self.window = window
        self.retry_after = retry_after or window
        super().__init__(
            message=f"Rate limit exceeded. Limit: {limit} requests per {window} seconds",
            error_type="RATE_LIMIT_EXCEEDED",
            details={
                "limit": limit,
                "window": window,
                "retry_after": self.retry_after
            },
            status_code=429
        )

class FileTypeError(UploadError):
    """File type validation errors"""
    def __init__(self, file_type, allowed_types, filename=None):
        self.file_type = file_type
        self.allowed_types = allowed_types
        self.filename = filename
        super().__init__(
            message=f"File type '{file_type}' is not allowed",
            error_type="INVALID_FILE_TYPE",
            details={
                "file_type": file_type,
                "allowed_types": allowed_types,
                "filename": filename
            },
            status_code=400
        )

class SessionSizeError(UploadError):
    """Upload session size errors"""
    def __init__(self, session_size, max_session_size):
        self.session_size = session_size
        self.max_session_size = max_session_size
        super().__init__(
            message=f"Upload session size exceeds maximum allowed size of {max_session_size // (1024**3)}GB",
            error_type="SESSION_SIZE_EXCEEDED",
            details={
                "session_size": session_size,
                "max_session_size": max_session_size,
                "session_size_gb": session_size / (1024**3),
                "max_session_size_gb": max_session_size / (1024**3)
            },
            status_code=413
        )

class FileCountError(UploadError):
    """File count limit errors"""
    def __init__(self, file_count, max_files):
        self.file_count = file_count
        self.max_files = max_files
        super().__init__(
            message=f"Too many files selected. Maximum {max_files} files per upload.",
            error_type="TOO_MANY_FILES",
            details={
                "file_count": file_count,
                "max_files": max_files,
                "excess_files": max(0, file_count - max_files)
            },
            status_code=400
        )

def handle_upload_error(error):
    """Convert upload errors to appropriate HTTP responses"""
    if isinstance(error, UploadError):
        return JsonResponse({
            'error': error.message,
            'error_type': error.error_type,
            'details': error.details
        }, status=error.status_code)
    
    # Handle other exceptions
    logger.error(f"Unexpected upload error: {str(error)}")
    return JsonResponse({
        'error': 'An unexpected error occurred during upload',
        'error_type': 'UNEXPECTED_ERROR',
        'details': {
            'message': str(error),
            'type': type(error).__name__
        }
    }, status=500)

def validate_file_size(file_size, filename=None):
    """Validate file size against limits"""
    max_size = getattr(settings, 'MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024)
    if file_size > max_size:
        raise FileSizeError(file_size, max_size, filename)
    return True

def validate_file_type(file_type, filename=None):
    """Validate file type against allowed types"""
    allowed_types = getattr(settings, 'ALLOWED_FILE_TYPES', [])
    if allowed_types and file_type not in allowed_types:
        raise FileTypeError(file_type, allowed_types, filename)
    return True

def validate_storage_limit(current_usage, additional_size=0):
    """Validate storage limits"""
    free_tier_limit = getattr(settings, 'FREE_TIER_LIMIT', 15 * 1024 * 1024 * 1024)
    if (current_usage + additional_size) > free_tier_limit:
        raise StorageLimitError(current_usage, free_tier_limit, additional_size)
    return True

def validate_session_size(session_size):
    """Validate upload session size"""
    max_session_size = getattr(settings, 'MAX_SESSION_SIZE', 50 * 1024 * 1024 * 1024)
    if session_size > max_session_size:
        raise SessionSizeError(session_size, max_session_size)
    return True

def validate_file_count(file_count):
    """Validate file count"""
    max_files = getattr(settings, 'MAX_FILES_PER_UPLOAD', 1000)
    if file_count > max_files:
        raise FileCountError(file_count, max_files)
    return True

def format_bytes(bytes_value):
    """Format bytes to human readable format"""
    if bytes_value == 0:
        return "0 Bytes"
    
    size_names = ["Bytes", "KB", "MB", "GB", "TB"]
    i = 0
    while bytes_value >= 1024 and i < len(size_names) - 1:
        bytes_value /= 1024.0
        i += 1
    
    return f"{bytes_value:.2f} {size_names[i]}"

def get_upload_limits():
    """Get current upload limits for API responses"""
    return {
        "max_file_size": getattr(settings, 'MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024),
        "max_files_per_upload": getattr(settings, 'MAX_FILES_PER_UPLOAD', 1000),
        "max_concurrent_uploads": getattr(settings, 'MAX_CONCURRENT_UPLOADS', 3),
        "max_session_size": getattr(settings, 'MAX_SESSION_SIZE', 50 * 1024 * 1024 * 1024),
        "free_tier_limit": getattr(settings, 'FREE_TIER_LIMIT', 15 * 1024 * 1024 * 1024),
        "allowed_file_types": getattr(settings, 'ALLOWED_FILE_TYPES', [])
    }

def create_error_response(error_type, message, details=None, status_code=400):
    """Create standardized error response"""
    return JsonResponse({
        'error': message,
        'error_type': error_type,
        'details': details or {}
    }, status=status_code)

def log_upload_error(error, user=None, filename=None):
    """Log upload errors with context"""
    context = {
        'error_type': type(error).__name__,
        'error_message': str(error),
        'user_id': user.id if user else None,
        'username': user.username if user else None,
        'filename': filename
    }
    
    if isinstance(error, UploadError):
        context.update({
            'upload_error_type': error.error_type,
            'status_code': error.status_code
        })
    
    logger.error(f"Upload error occurred: {context}")

# Decorator for handling upload errors
def handle_upload_errors(func):
    """Decorator to handle upload errors in views"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except UploadError as e:
            return handle_upload_error(e)
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {str(e)}")
            return JsonResponse({
                'error': 'An unexpected error occurred',
                'error_type': 'UNEXPECTED_ERROR',
                'details': {'message': str(e)}
            }, status=500)
    return wrapper
