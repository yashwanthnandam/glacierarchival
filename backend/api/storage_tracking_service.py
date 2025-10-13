"""
Storage tracking service for user activity monitoring and abuse prevention
"""
import logging
from datetime import datetime, date
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum
from django.core.cache import cache
from django.contrib.auth.models import User
from .models import (
    UserActivity, 
    UserLifetimeUsage, 
    UserMonthlyLimits, 
    MediaFile, 
    UserHibernationPlan
)

logger = logging.getLogger(__name__)


class StorageTrackingService:
    """Service for tracking user storage activities and preventing abuse"""
    
    def __init__(self, user):
        self.user = user
        self.logger = logging.getLogger(f"{__name__}.{user.username}")
    
    def track_activity(self, activity_type, file_size_bytes=0, file_id=None, 
                      ip_address=None, user_agent=None, success=True, error_message=None):
        """Track user activity"""
        try:
            current_month = timezone.now().replace(day=1).date()
            
            # Create activity record
            activity = UserActivity.objects.create(
                user=self.user,
                activity_type=activity_type,
                file_size_bytes=file_size_bytes,
                file_id=file_id,
                ip_address=ip_address,
                user_agent=user_agent,
                success=success,
                error_message=error_message,
                month=current_month
            )
            
            # Update monthly limits
            self._update_monthly_limits(activity_type, file_size_bytes)
            
            # Update lifetime usage
            self._update_lifetime_usage(activity_type, file_size_bytes)
            
            # Update storage usage if needed
            if activity_type in ['upload', 'delete']:
                self._update_storage_usage(activity_type, file_size_bytes)
            
            self.logger.info(f"Tracked {activity_type} activity: {file_size_bytes} bytes")
            return activity
            
        except Exception as e:
            self.logger.error(f"Failed to track activity: {str(e)}")
            raise
    
    def track_download(self, media_file, ip_address=None, user_agent=None):
        """Track file download and update last_accessed"""
        try:
            # Update last_accessed timestamp
            media_file.last_accessed = timezone.now()
            media_file.save(update_fields=['last_accessed'])
            
            # Track download activity
            self.track_activity(
                activity_type='download',
                file_size_bytes=media_file.file_size,
                file_id=media_file.id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.logger.info(f"Tracked download: {media_file.original_filename}")
            
        except Exception as e:
            self.logger.error(f"Failed to track download: {str(e)}")
            raise
    
    def track_upload(self, media_file, ip_address=None, user_agent=None):
        """Track file upload"""
        try:
            self.track_activity(
                activity_type='upload',
                file_size_bytes=media_file.file_size,
                file_id=media_file.id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.logger.info(f"Tracked upload: {media_file.original_filename}")
            
        except Exception as e:
            self.logger.error(f"Failed to track upload: {str(e)}")
            raise
    
    def track_delete(self, media_file, ip_address=None, user_agent=None):
        """Track file deletion"""
        try:
            self.track_activity(
                activity_type='delete',
                file_size_bytes=media_file.file_size,
                file_id=media_file.id,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.logger.info(f"Tracked deletion: {media_file.original_filename}")
            
        except Exception as e:
            self.logger.error(f"Failed to track deletion: {str(e)}")
            raise
    
    def _update_monthly_limits(self, activity_type, file_size_bytes):
        """Update monthly usage limits"""
        try:
            current_month = timezone.now().replace(day=1).date()
            monthly_limit, created = UserMonthlyLimits.objects.get_or_create(
                user=self.user,
                month=current_month,
                defaults={
                    'upload_limit_bytes': 15 * 1024**3,  # 15GB
                    'download_limit_bytes': 50 * 1024**3,  # 50GB
                    'storage_limit_bytes': 15 * 1024**3,  # 15GB
                }
            )
            
            if activity_type == 'upload':
                monthly_limit.uploads_used_bytes += file_size_bytes
                monthly_limit.upload_count += 1
            elif activity_type == 'download':
                monthly_limit.downloads_used_bytes += file_size_bytes
                monthly_limit.download_count += 1
            elif activity_type == 'delete':
                monthly_limit.delete_count += 1
            
            # Update current storage usage
            monthly_limit.current_storage_bytes = self._calculate_current_storage()
            
            # Update peak storage if current usage is higher
            if monthly_limit.current_storage_bytes > monthly_limit.storage_peak_bytes:
                monthly_limit.storage_peak_bytes = monthly_limit.current_storage_bytes
            
            monthly_limit.save()
            
        except Exception as e:
            self.logger.error(f"Failed to update monthly limits: {str(e)}")
            raise
    
    def _update_lifetime_usage(self, activity_type, file_size_bytes):
        """Update lifetime usage statistics"""
        try:
            lifetime_usage, created = UserLifetimeUsage.objects.get_or_create(
                user=self.user,
                defaults={
                    'total_uploaded_bytes': 0,
                    'total_downloaded_bytes': 0,
                    'total_deleted_bytes': 0,
                    'peak_storage_bytes': 0,
                    'files_uploaded_count': 0,
                    'files_downloaded_count': 0,
                    'files_deleted_count': 0,
                }
            )
            
            if activity_type == 'upload':
                lifetime_usage.total_uploaded_bytes += file_size_bytes
                lifetime_usage.files_uploaded_count += 1
            elif activity_type == 'download':
                lifetime_usage.total_downloaded_bytes += file_size_bytes
                lifetime_usage.files_downloaded_count += 1
            elif activity_type == 'delete':
                lifetime_usage.total_deleted_bytes += file_size_bytes
                lifetime_usage.files_deleted_count += 1
            
            # Update peak storage
            current_storage = self._calculate_current_storage()
            if current_storage > lifetime_usage.peak_storage_bytes:
                lifetime_usage.peak_storage_bytes = current_storage
            
            # Calculate abuse score
            lifetime_usage.calculate_abuse_score()
            lifetime_usage.save()
            
        except Exception as e:
            self.logger.error(f"Failed to update lifetime usage: {str(e)}")
            raise
    
    def _update_storage_usage(self, activity_type, file_size_bytes):
        """Update storage usage in hibernation plan"""
        try:
            user_plan = self._get_user_plan()
            if user_plan:
                if activity_type == 'upload':
                    user_plan.storage_used_bytes += file_size_bytes
                elif activity_type == 'delete':
                    user_plan.storage_used_bytes -= file_size_bytes
                
                user_plan.save(update_fields=['storage_used_bytes'])
                
        except Exception as e:
            self.logger.error(f"Failed to update storage usage: {str(e)}")
            raise
    
    def _calculate_current_storage(self):
        """Calculate current storage usage"""
        try:
            result = MediaFile.objects.filter(
                user=self.user,
                is_deleted=False
            ).aggregate(total=Sum('file_size'))
            
            return result['total'] or 0
            
        except Exception as e:
            self.logger.error(f"Failed to calculate current storage: {str(e)}")
            return 0
    
    def _get_user_plan(self):
        """Get user's hibernation plan"""
        try:
            return UserHibernationPlan.objects.filter(
                user=self.user,
                is_active=True
            ).first()
        except Exception as e:
            self.logger.error(f"Failed to get user plan: {str(e)}")
            return None
    
    def check_abuse(self):
        """Check for abuse patterns"""
        try:
            lifetime_usage = getattr(self.user, 'lifetime_usage', None)
            if not lifetime_usage:
                return False, 0.0
            
            abuse_score = lifetime_usage.calculate_abuse_score()
            is_abuse = abuse_score > 0.7  # Threshold for abuse detection
            
            return is_abuse, abuse_score
            
        except Exception as e:
            self.logger.error(f"Failed to check abuse: {str(e)}")
            return False, 0.0
    
    def check_monthly_limits(self, activity_type, file_size_bytes):
        """Check if monthly limits would be exceeded"""
        try:
            current_month = timezone.now().replace(day=1).date()
            monthly_limit = UserMonthlyLimits.objects.filter(
                user=self.user,
                month=current_month
            ).first()
            
            if not monthly_limit:
                return True, "No monthly limit found"
            
            if activity_type == 'upload':
                if monthly_limit.is_upload_limit_exceeded:
                    return False, "Monthly upload limit exceeded"
                if monthly_limit.uploads_used_bytes + file_size_bytes > monthly_limit.upload_limit_bytes:
                    return False, "Upload would exceed monthly limit"
            
            elif activity_type == 'download':
                if monthly_limit.is_download_limit_exceeded:
                    return False, "Monthly download limit exceeded"
                if monthly_limit.downloads_used_bytes + file_size_bytes > monthly_limit.download_limit_bytes:
                    return False, "Download would exceed monthly limit"
            
            return True, "Within limits"
            
        except Exception as e:
            self.logger.error(f"Failed to check monthly limits: {str(e)}")
            return False, f"Error checking limits: {str(e)}"
    
    def get_usage_stats(self):
        """Get comprehensive usage statistics"""
        try:
            # Get lifetime usage
            lifetime_usage = getattr(self.user, 'lifetime_usage', None)
            
            # Get current month usage
            current_month = timezone.now().replace(day=1).date()
            monthly_limit = UserMonthlyLimits.objects.filter(
                user=self.user,
                month=current_month
            ).first()
            
            # Get current storage
            current_storage = self._calculate_current_storage()
            
            # Get user plan
            user_plan = self._get_user_plan()
            
            stats = {
                'current_storage_bytes': current_storage,
                'current_storage_gb': round(current_storage / (1024**3), 2),
                'lifetime_usage': lifetime_usage,
                'monthly_usage': monthly_limit,
                'user_plan': user_plan,
                'abuse_detected': False,
                'abuse_score': 0.0,
            }
            
            if lifetime_usage:
                stats['abuse_detected'], stats['abuse_score'] = self.check_abuse()
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Failed to get usage stats: {str(e)}")
            raise
    
    def sync_storage_usage(self):
        """Sync storage usage with actual database state"""
        try:
            current_storage = self._calculate_current_storage()
            
            # Update hibernation plan
            user_plan = self._get_user_plan()
            if user_plan:
                user_plan.storage_used_bytes = current_storage
                user_plan.save(update_fields=['storage_used_bytes'])
            
            # Update monthly limits
            current_month = timezone.now().replace(day=1).date()
            monthly_limit = UserMonthlyLimits.objects.filter(
                user=self.user,
                month=current_month
            ).first()
            
            if monthly_limit:
                monthly_limit.current_storage_bytes = current_storage
                if current_storage > monthly_limit.storage_peak_bytes:
                    monthly_limit.storage_peak_bytes = current_storage
                monthly_limit.save()
            
            # Update lifetime usage
            lifetime_usage = getattr(self.user, 'lifetime_usage', None)
            if lifetime_usage:
                if current_storage > lifetime_usage.peak_storage_bytes:
                    lifetime_usage.peak_storage_bytes = current_storage
                lifetime_usage.save()
            
            self.logger.info(f"Synced storage usage: {current_storage} bytes")
            return current_storage
            
        except Exception as e:
            self.logger.error(f"Failed to sync storage usage: {str(e)}")
            raise
