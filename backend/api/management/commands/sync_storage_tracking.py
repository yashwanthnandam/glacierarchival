"""
Management command to sync storage tracking for existing users
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.models import Sum
from api.models import MediaFile, UserLifetimeUsage, UserMonthlyLimits
from api.storage_tracking_service import StorageTrackingService
from django.utils import timezone


class Command(BaseCommand):
    help = 'Sync storage tracking for existing users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='Sync storage tracking for specific user ID',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        user_id = options.get('user_id')
        dry_run = options.get('dry_run', False)
        
        if user_id:
            users = User.objects.filter(id=user_id)
            if not users.exists():
                self.stdout.write(
                    self.style.ERROR(f'User with ID {user_id} not found')
                )
                return
        else:
            users = User.objects.all()
        
        self.stdout.write(f'Processing {users.count()} users...')
        
        for user in users:
            self.stdout.write(f'Processing user: {user.username}')
            
            try:
                # Calculate current storage usage
                current_storage = MediaFile.objects.filter(
                    user=user,
                    is_deleted=False
                ).aggregate(total=Sum('file_size'))['total'] or 0
                
                # Calculate lifetime statistics
                lifetime_stats = self._calculate_lifetime_stats(user)
                
                if dry_run:
                    self.stdout.write(
                        f'  Would create lifetime usage: {lifetime_stats}'
                    )
                    self.stdout.write(
                        f'  Current storage: {current_storage / (1024**3):.2f} GB'
                    )
                    continue
                
                # Create or update lifetime usage
                lifetime_usage, created = UserLifetimeUsage.objects.get_or_create(
                    user=user,
                    defaults=lifetime_stats
                )
                
                if not created:
                    # Update existing record
                    for key, value in lifetime_stats.items():
                        setattr(lifetime_usage, key, value)
                    lifetime_usage.save()
                
                # Create monthly limit for current month
                current_month = timezone.now().replace(day=1).date()
                monthly_limit, created = UserMonthlyLimits.objects.get_or_create(
                    user=user,
                    month=current_month,
                    defaults={
                        'upload_limit_bytes': 15 * 1024**3,  # 15GB
                        'download_limit_bytes': 50 * 1024**3,  # 50GB
                        'storage_limit_bytes': 15 * 1024**3,  # 15GB
                        'current_storage_bytes': current_storage,
                        'storage_peak_bytes': current_storage,
                    }
                )
                
                if not created:
                    monthly_limit.current_storage_bytes = current_storage
                    if current_storage > monthly_limit.storage_peak_bytes:
                        monthly_limit.storage_peak_bytes = current_storage
                    monthly_limit.save()
                
                # Sync storage usage
                storage_tracker = StorageTrackingService(user)
                storage_tracker.sync_storage_usage()
                
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ Synced storage tracking for {user.username}')
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ✗ Failed to sync {user.username}: {str(e)}')
                )
        
        self.stdout.write(
            self.style.SUCCESS('Storage tracking sync completed!')
        )

    def _calculate_lifetime_stats(self, user):
        """Calculate lifetime statistics for a user"""
        # Get all files for the user
        files = MediaFile.objects.filter(user=user)
        
        # Calculate uploaded files (not deleted)
        uploaded_files = files.filter(is_deleted=False)
        total_uploaded_bytes = uploaded_files.aggregate(
            total=Sum('file_size')
        )['total'] or 0
        
        # Calculate deleted files
        deleted_files = files.filter(is_deleted=True)
        total_deleted_bytes = deleted_files.aggregate(
            total=Sum('file_size')
        )['total'] or 0
        
        # Calculate peak storage (current storage since we don't have historical data)
        current_storage = uploaded_files.aggregate(
            total=Sum('file_size')
        )['total'] or 0
        
        # Count files
        files_uploaded_count = uploaded_files.count()
        files_deleted_count = deleted_files.count()
        
        # Calculate upload/delete ratio
        upload_delete_ratio = 0.0
        if files_uploaded_count > 0:
            upload_delete_ratio = files_deleted_count / files_uploaded_count
        
        return {
            'total_uploaded_bytes': total_uploaded_bytes,
            'total_downloaded_bytes': 0,  # No historical download data
            'total_deleted_bytes': total_deleted_bytes,
            'peak_storage_bytes': current_storage,
            'files_uploaded_count': files_uploaded_count,
            'files_downloaded_count': 0,  # No historical download data
            'files_deleted_count': files_deleted_count,
            'upload_delete_ratio': upload_delete_ratio,
            'rapid_cycles_count': 0,  # No historical data
            'abuse_score': 0.0,  # Will be calculated on first access
        }
