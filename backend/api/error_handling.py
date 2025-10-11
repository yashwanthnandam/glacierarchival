"""
Common error handling utilities for Django REST Framework
"""
import logging
from rest_framework import status
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
import traceback

logger = logging.getLogger(__name__)

class APIError(Exception):
    """Custom API error class"""
    def __init__(self, message, status_code=status.HTTP_400_BAD_REQUEST, details=None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

def handle_api_error(error, context=None):
    """
    Centralized error handling for API views
    """
    logger.error(f"API Error: {str(error)}", exc_info=True)
    
    if isinstance(error, APIError):
        return Response({
            'error': error.message,
            'details': error.details
        }, status=error.status_code)
    
    if isinstance(error, ValidationError):
        return Response({
            'error': 'Validation failed',
            'details': error.message_dict if hasattr(error, 'message_dict') else str(error)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if isinstance(error, IntegrityError):
        return Response({
            'error': 'Database integrity error',
            'details': str(error)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if isinstance(error, ProtectedError):
        return Response({
            'error': 'Cannot delete this item as it is referenced by other objects',
            'details': str(error)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Generic error handling
    return Response({
        'error': 'An unexpected error occurred',
        'details': str(error) if context and context.get('debug') else 'Internal server error'
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def api_view_error_handler(view_func):
    """
    Decorator to wrap API views with error handling
    """
    def wrapper(*args, **kwargs):
        try:
            return view_func(*args, **kwargs)
        except Exception as e:
            return handle_api_error(e)
    return wrapper

def validate_required_fields(data, required_fields):
    """
    Validate that required fields are present in request data
    """
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        raise APIError(
            f"Missing required fields: {', '.join(missing_fields)}",
            status.HTTP_400_BAD_REQUEST,
            {'missing_fields': missing_fields}
        )

def validate_file_upload(file, max_size=None, allowed_types=None):
    """
    Validate file upload parameters
    """
    if not file:
        raise APIError("No file provided", status.HTTP_400_BAD_REQUEST)
    
    if max_size and file.size > max_size:
        raise APIError(
            f"File size exceeds maximum allowed size of {max_size} bytes",
            status.HTTP_400_BAD_REQUEST
        )
    
    if allowed_types:
        file_type = file.content_type
        if file_type not in allowed_types:
            raise APIError(
                f"File type {file_type} not allowed. Allowed types: {', '.join(allowed_types)}",
                status.HTTP_400_BAD_REQUEST
            )

def safe_get_object_or_404(model_class, **kwargs):
    """
    Safe version of get_object_or_404 that returns proper API error response
    """
    try:
        return model_class.objects.get(**kwargs)
    except model_class.DoesNotExist:
        raise APIError(
            f"{model_class.__name__} not found",
            status.HTTP_404_NOT_FOUND
        )

def paginate_response(queryset, page_size=20, page=1):
    """
    Paginate queryset and return paginated response
    """
    from django.core.paginator import Paginator
    
    paginator = Paginator(queryset, page_size)
    try:
        page_obj = paginator.page(page)
    except:
        page_obj = paginator.page(1)
    
    return {
        'results': page_obj.object_list,
        'count': paginator.count,
        'next': page_obj.next_page_number() if page_obj.has_next() else None,
        'previous': page_obj.previous_page_number() if page_obj.has_previous() else None,
        'num_pages': paginator.num_pages,
        'current_page': page_obj.number
    }

def log_api_request(request, response=None, error=None):
    """
    Log API request details for debugging
    """
    log_data = {
        'method': request.method,
        'path': request.path,
        'user': getattr(request, 'user', None),
        'ip': get_client_ip(request),
        'user_agent': request.META.get('HTTP_USER_AGENT', ''),
    }
    
    if response:
        log_data['status_code'] = response.status_code
        logger.info(f"API Request: {log_data}")
    elif error:
        log_data['error'] = str(error)
        logger.error(f"API Error: {log_data}")

def get_client_ip(request):
    """
    Get client IP address from request
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def create_success_response(data=None, message="Success", status_code=status.HTTP_200_OK):
    """
    Create standardized success response
    """
    response_data = {'message': message}
    if data is not None:
        response_data['data'] = data
    
    return Response(response_data, status=status_code)

def create_error_response(message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Create standardized error response
    """
    response_data = {'error': message}
    if details:
        response_data['details'] = details
    
    return Response(response_data, status=status_code)
