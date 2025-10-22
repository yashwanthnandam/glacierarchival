"""
Main views module - imports and re-exports all views from the views package.

This module maintains backward compatibility by importing all ViewSets and functions
from the views package and re-exporting them for existing imports.
"""

# Import all ViewSets and functions from the views package
from .views import (
    # Authentication functions
    register_user,
    verify_email,
    resend_verification,
    request_password_reset,
    reset_password,
    get_user,
    
    # File management
    MediaFileViewSet,
    create_folder,
    
    # Payment processing
    PaymentViewSet,
    
    # Archive and storage
    ArchiveJobViewSet,
    S3ConfigViewSet,
    
    # Subscription management
    HibernationPlanViewSet,
    UserHibernationPlanViewSet,
    
    # Cache utilities
    atomic_cache_version_increment,
    clear_user_cache_patterns,
    invalidate_user_cache,
)

# Re-export everything for backward compatibility
__all__ = [
    # Authentication functions
    'register_user',
    'verify_email',
    'resend_verification',
    'request_password_reset',
    'reset_password',
    'get_user',
    
    # File management
    'MediaFileViewSet',
    'create_folder',
    
    # Payment processing
    'PaymentViewSet',
    
    # Archive and storage
    'ArchiveJobViewSet',
    'S3ConfigViewSet',
    
    # Subscription management
    'HibernationPlanViewSet',
    'UserHibernationPlanViewSet',
    
    # Cache utilities
    'atomic_cache_version_increment',
    'clear_user_cache_patterns',
    'invalidate_user_cache',
]