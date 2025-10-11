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
                current_usage_gb = total_storage_bytes / (1024**3)
                additional_gb = additional_bytes / (1024**3)
                remaining_gb = max(0, (free_tier_limit_bytes - total_storage_bytes) / (1024**3))
                
                raise APIError(
                    f"Storage limit exceeded! You've used {current_usage_gb:.1f}GB of your 15GB free tier. "
                    f"This upload would add {additional_gb:.1f}GB, but you only have {remaining_gb:.1f}GB remaining. "
                    f"Please upgrade to a hibernation plan to continue uploading.",
                    402,
                    {
                        'plan_required': True,
                        'free_tier_used': total_storage_bytes,
                        'free_tier_limit': free_tier_limit_bytes,
                        'additional_size': additional_bytes,
                        'current_usage_gb': round(current_usage_gb, 1),
                        'additional_gb': round(additional_gb, 1),
                        'remaining_gb': round(remaining_gb, 1),
                        'upgrade_message': 'Upgrade to a hibernation plan to get more storage space.'
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
        current_usage = user_plan.storage_used_bytes
        plan_limit = user_plan.plan.storage_size_bytes
        
        # Check if adding this file would exceed plan limit
        if (current_usage + file_size) > plan_limit:
            current_usage_gb = current_usage / (1024**3)
            file_size_gb = file_size / (1024**3)
            plan_limit_gb = plan_limit / (1024**3)
            remaining_gb = max(0, (plan_limit - current_usage) / (1024**3))
            
            raise APIError(
                f"Storage limit exceeded for your {plan.name} plan! You've used {current_usage_gb:.1f}GB of your {plan_limit_gb:.0f}GB allowance. "
                f"This upload would add {file_size_gb:.1f}GB, but you only have {remaining_gb:.1f}GB remaining. "
                f"Please upgrade to a higher plan or delete some files to continue.",
                402,
                {
                    'plan_required': True,
                    'current_plan': plan.name,
                    'current_usage_gb': round(current_usage_gb, 1),
                    'file_size_gb': round(file_size_gb, 1),
                    'plan_limit_gb': round(plan_limit_gb, 0),
                    'remaining_gb': round(remaining_gb, 1),
                    'upgrade_message': f'Upgrade to a higher plan to get more storage space.'
                }
            )
        
        # Check individual file size limits for specific tiers
        if plan.storage_tier == '100gb' and file_size > 100 * 1024 * 1024 * 1024:
            raise APIError("Individual file size cannot exceed 100GB. Please split the file or upgrade to a higher plan.", 400)
        elif plan.storage_tier == '500gb' and file_size > 500 * 1024 * 1024 * 1024:
            raise APIError("Individual file size cannot exceed 500GB. Please split the file or upgrade to a higher plan.", 400)
        elif plan.storage_tier == '1tb' and file_size > 1024 * 1024 * 1024 * 1024:
            raise APIError("Individual file size cannot exceed 1TB. Please split the file or upgrade to a higher plan.", 400)
        
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
