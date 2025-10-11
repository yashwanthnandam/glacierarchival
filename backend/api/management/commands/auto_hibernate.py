from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from api.models import MediaFile, ArchiveJob
from api.services import MediaFileService
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Automatically hibernate files based on usage patterns'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Number of days since last access to trigger hibernation (default: 30)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be hibernated without actually hibernating',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Hibernate files for specific user only',
        )
        parser.add_argument(
            '--min-size',
            type=int,
            default=10485760,  # 10MB
            help='Minimum file size in bytes to consider for hibernation (default: 10MB)',
        )

    def handle(self, *args, **options):
        days_threshold = options['days']
        dry_run = options['dry_run']
        user_filter = options.get('user')
        min_size = options['min_size']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting auto-hibernation process...')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No files will be hibernated')
            )
        
        # Get users to process
        if user_filter:
            try:
                users = [User.objects.get(username=user_filter)]
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'User "{user_filter}" not found')
                )
                return
        else:
            users = User.objects.all()
        
        total_candidates = 0
        total_hibernated = 0
        total_savings = 0
        
        for user in users:
            candidates, hibernated, savings = self.process_user_hibernation(
                user, days_threshold, min_size, dry_run
            )
            total_candidates += candidates
            total_hibernated += hibernated
            total_savings += savings
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Auto-hibernation completed:\n'
                f'  Files analyzed: {total_candidates}\n'
                f'  Files hibernated: {total_hibernated}\n'
                f'  Estimated monthly savings: ${total_savings:.4f}'
            )
        )

    def process_user_hibernation(self, user, days_threshold, min_size, dry_run):
        """Process hibernation for a specific user"""
        cutoff_date = timezone.now() - timedelta(days=days_threshold)
        
        # Find files eligible for hibernation
        candidates = MediaFile.objects.filter(
            user=user,
            status='uploaded',  # Only uploaded files
            file_size__gte=min_size,  # Minimum size threshold
            last_accessed__lt=cutoff_date,  # Not accessed recently
            is_deleted=False
        ).exclude(
            # Exclude files that are frequently accessed
            file_type__startswith='text/',  # Keep text files accessible
        )
        
        hibernated_count = 0
        total_savings = 0
        
        for file in candidates:
            try:
                # Calculate potential savings
                from api.services import S3Service
                s3_service = S3Service(user)
                current_cost = s3_service.calculate_storage_cost(file.file_size, 'standard')
                hibernated_cost = s3_service.calculate_storage_cost(file.file_size, 'deep_archive')
                savings = current_cost - hibernated_cost
                
                if dry_run:
                    self.stdout.write(
                        f'  Would hibernate: {file.original_filename} '
                        f'({file.file_size_mb:.2f} MB) - Savings: ${savings:.4f}/month'
                    )
                else:
                    # Create hibernation job
                    job = ArchiveJob.objects.create(
                        user=user,
                        media_file=file,
                        job_type='archive',
                        status='in_progress'
                    )
                    
                    # Hibernate the file
                    media_service = MediaFileService(user)
                    media_service.archive_file(file)
                    
                    self.stdout.write(
                        f'  Hibernated: {file.original_filename} '
                        f'({file.file_size_mb:.2f} MB) - Savings: ${savings:.4f}/month'
                    )
                
                hibernated_count += 1
                total_savings += savings
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error hibernating {file.original_filename}: {e}')
                )
        
        return candidates.count(), hibernated_count, total_savings
