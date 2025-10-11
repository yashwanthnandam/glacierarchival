from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import MediaFile
from api.services import S3Service
import boto3
from botocore.exceptions import ClientError


class Command(BaseCommand):
    help = 'Clean up orphaned S3 files and Glacier archives'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Clean up files for specific user only',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_filter = options.get('user')
        
        self.stdout.write(
            self.style.SUCCESS('Starting orphaned files cleanup...')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No files will be deleted')
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
        
        total_orphaned = 0
        total_cleaned = 0
        
        for user in users:
            self.stdout.write(f'Processing user: {user.username}')
            
            try:
                s3_service = S3Service(user)
                orphaned_count, cleaned_count = self.cleanup_user_files(
                    user, s3_service, dry_run
                )
                total_orphaned += orphaned_count
                total_cleaned += cleaned_count
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error processing user {user.username}: {e}')
                )
                continue
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Cleanup complete. Found {total_orphaned} orphaned files, '
                f'cleaned {total_cleaned} files.'
            )
        )

    def cleanup_user_files(self, user, s3_service, dry_run):
        """Clean up orphaned files for a specific user"""
        orphaned_count = 0
        cleaned_count = 0
        
        try:
            # List all S3 objects for this user
            s3_client = s3_service.s3_client
            bucket_name = s3_service.s3_config.bucket_name
            
            # Get all S3 objects
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket_name)
            
            # Get all database files for this user
            db_files = set(
                MediaFile.objects.filter(user=user).values_list('s3_key', flat=True)
            )
            
            # Find orphaned S3 files
            for page in pages:
                if 'Contents' not in page:
                    continue
                    
                for obj in page['Contents']:
                    s3_key = obj['Key']
                    
                    # Skip if this is a database file
                    if s3_key in db_files:
                        continue
                    
                    # Skip if this is not a user file
                    if not s3_key.startswith(f'uploads/{user.username}/'):
                        continue
                    
                    orphaned_count += 1
                    
                    if dry_run:
                        self.stdout.write(f'  Would delete: {s3_key}')
                    else:
                        try:
                            s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
                            self.stdout.write(f'  Deleted: {s3_key}')
                            cleaned_count += 1
                        except ClientError as e:
                            self.stdout.write(
                                self.style.ERROR(f'  Failed to delete {s3_key}: {e}')
                            )
            
            # Clean up old soft-deleted files (older than 30 days)
            from django.utils import timezone
            from datetime import timedelta
            
            cutoff_date = timezone.now() - timedelta(days=30)
            old_deleted_files = MediaFile.objects.filter(
                user=user,
                is_deleted=True,
                deleted_at__lt=cutoff_date
            )
            
            for file in old_deleted_files:
                if dry_run:
                    self.stdout.write(f'  Would permanently delete: {file.original_filename}')
                else:
                    file.delete()
                    self.stdout.write(f'  Permanently deleted: {file.original_filename}')
                    cleaned_count += 1
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error cleaning up files for {user.username}: {e}')
            )
        
        return orphaned_count, cleaned_count
