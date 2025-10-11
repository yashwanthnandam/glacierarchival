"""
Base service class with common functionality
"""
import logging
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from .error_handling import APIError

logger = logging.getLogger(__name__)

class BaseService:
    """
    Base service class with common functionality
    """
    
    def __init__(self, user: User):
        self.user = user
        self.logger = logger
    
    def log_action(self, action, details=None):
        """Log service actions"""
        log_data = {
            'user': self.user.id if self.user else None,
            'action': action,
            'details': details or {}
        }
        self.logger.info(f"Service Action: {log_data}")
    
    def validate_user(self):
        """Validate that user is authenticated"""
        if not self.user or not self.user.is_authenticated:
            raise APIError("User must be authenticated", 401)
    
    def get_user_plan(self):
        """Get user's active hibernation plan"""
        try:
            from .models import UserHibernationPlan
            return UserHibernationPlan.objects.filter(
                user=self.user,
                is_active=True
            ).first()
        except Exception as e:
            self.logger.error(f"Error getting user plan: {str(e)}")
            return None
    
    def check_free_tier_limit(self, additional_bytes=0):
        """Check if user exceeds free tier limit"""
        try:
            from .models import MediaFile
            from django.db.models import Sum, Count
            
            total_storage_bytes = MediaFile.objects.filter(
                user=self.user,
                is_deleted=False
            ).aggregate(total=Sum('file_size'))['total'] or 0
            
            free_tier_limit_bytes = 15 * 1024 * 1024 * 1024  # 15GB
            
            if (total_storage_bytes + additional_bytes) > free_tier_limit_bytes:
                used_gb = total_storage_bytes / (1024**3)
                limit_gb = free_tier_limit_bytes / (1024**3)
                raise APIError(
                    f"Free tier limit exceeded. You have used {used_gb:.1f}GB of your {limit_gb:.0f}GB free allowance. Please subscribe to a hibernation plan to continue.",
                    402,
                    {
                        'plan_required': True,
                        'free_tier_used': total_storage_bytes,
                        'free_tier_limit': free_tier_limit_bytes
                    }
                )
            
            return True
            
        except APIError:
            raise
        except Exception as e:
            self.logger.error(f"Error checking free tier limit: {str(e)}")
            raise APIError("Error checking storage limits", 500)
    
    def check_hibernation_plan_limits(self, action, file_size=0):
        """Check hibernation plan limits"""
        user_plan = self.get_user_plan()
        
        if not user_plan:
            # No active plan, check free tier
            return self.check_free_tier_limit(file_size)
        
        # Check if plan is expired
        from django.utils import timezone
        if user_plan.expires_at and user_plan.expires_at < timezone.now():
            raise APIError(
                "Your hibernation plan has expired. Please renew your subscription.",
                402,
                {
                    'plan_expired': True,
                    'expires_at': user_plan.expires_at.isoformat()
                }
            )
        
        # Check plan-specific limits
        plan = user_plan.plan
        if plan.storage_tier == '100gb' and file_size > 100 * 1024 * 1024 * 1024:
            raise APIError("File size exceeds 100GB plan limit", 400)
        elif plan.storage_tier == '500gb' and file_size > 500 * 1024 * 1024 * 1024:
            raise APIError("File size exceeds 500GB plan limit", 400)
        elif plan.storage_tier == '1tb' and file_size > 1024 * 1024 * 1024 * 1024:
            raise APIError("File size exceeds 1TB plan limit", 400)
        
        return True
    
    @transaction.atomic
    def safe_create(self, model_class, **kwargs):
        """Safely create model instance with transaction"""
        try:
            instance = model_class.objects.create(**kwargs)
            self.log_action('create', {
                'model': model_class.__name__,
                'instance_id': instance.id
            })
            return instance
        except Exception as e:
            self.logger.error(f"Error creating {model_class.__name__}: {str(e)}")
            raise APIError(f"Failed to create {model_class.__name__}", 500)
    
    @transaction.atomic
    def safe_update(self, instance, **kwargs):
        """Safely update model instance with transaction"""
        try:
            for key, value in kwargs.items():
                setattr(instance, key, value)
            instance.save()
            self.log_action('update', {
                'model': instance.__class__.__name__,
                'instance_id': instance.id,
                'updated_fields': list(kwargs.keys())
            })
            return instance
        except Exception as e:
            self.logger.error(f"Error updating {instance.__class__.__name__}: {str(e)}")
            raise APIError(f"Failed to update {instance.__class__.__name__}", 500)
    
    @transaction.atomic
    def safe_delete(self, instance):
        """Safely delete model instance with transaction"""
        try:
            instance_id = instance.id
            model_name = instance.__class__.__name__
            instance.delete()
            self.log_action('delete', {
                'model': model_name,
                'instance_id': instance_id
            })
            return True
        except Exception as e:
            self.logger.error(f"Error deleting {instance.__class__.__name__}: {str(e)}")
            raise APIError(f"Failed to delete {instance.__class__.__name__}", 500)
    
    def get_user_files(self, filters=None):
        """Get user's files with optional filters"""
        try:
            from .models import MediaFile
            
            queryset = MediaFile.objects.filter(user=self.user, is_deleted=False)
            
            if filters:
                queryset = queryset.filter(**filters)
            
            return queryset
        except Exception as e:
            self.logger.error(f"Error getting user files: {str(e)}")
            raise APIError("Failed to retrieve files", 500)
    
    def calculate_storage_usage(self):
        """Calculate user's storage usage"""
        try:
            from .models import MediaFile
            from django.db.models import Sum, Count
            
            result = MediaFile.objects.filter(
                user=self.user,
                is_deleted=False
            ).aggregate(
                total_size=Sum('file_size'),
                file_count=Count('id')
            )
            
            return {
                'total_size_bytes': result['total_size'] or 0,
                'file_count': result['file_count'] or 0,
                'total_size_gb': (result['total_size'] or 0) / (1024**3)
            }
        except Exception as e:
            self.logger.error(f"Error calculating storage usage: {str(e)}")
            raise APIError("Failed to calculate storage usage", 500)
