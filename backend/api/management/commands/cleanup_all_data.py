import os
import boto3
from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.auth.models import User
from api.models import MediaFile, ArchiveJob
from api.services import S3Service
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Delete all files and directories from database and AWS S3/Glacier'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete ALL data',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        if not options['confirm'] and not options['dry_run']:
            self.stdout.write(
                self.style.ERROR(
                    'This will delete ALL files and data from your database and AWS!\n'
                    'Use --confirm to proceed or --dry-run to see what would be deleted.'
                )
            )
            return

        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No data will be deleted'))
        else:
            self.stdout.write(self.style.ERROR('DELETING ALL DATA - This cannot be undone!'))

        # Get all users and initialize S3 service for each
        users = User.objects.all()
        if not users.exists():
            self.stdout.write(self.style.WARNING('No users found in database'))
            return
        
        # Use the first user for S3 operations (or create a system user)
        user = users.first()
        s3_service = S3Service(user)
        
        # Get all files from database
        all_files = MediaFile.objects.all()
        total_files = all_files.count()
        
        self.stdout.write(f'Found {total_files} files in database')
        
        if total_files == 0:
            self.stdout.write(self.style.SUCCESS('No files found in database'))
            return

        # Process files in batches
        batch_size = 100
        deleted_count = 0
        error_count = 0

        for i in range(0, total_files, batch_size):
            batch_files = all_files[i:i + batch_size]
            
            for file_obj in batch_files:
                try:
                    if dry_run:
                        self.stdout.write(f'Would delete: {file_obj.original_filename} ({file_obj.s3_key})')
                    else:
                        # Delete from S3/Glacier
                        self.delete_from_aws(file_obj, s3_service)
                        
                        # Delete from database
                        file_obj.delete()
                        
                        deleted_count += 1
                        
                        if deleted_count % 10 == 0:
                            self.stdout.write(f'Deleted {deleted_count}/{total_files} files...')
                            
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(f'Error deleting {file_obj.original_filename}: {str(e)}')
                    )

        # Clean up other related data
        if not dry_run:
            self.cleanup_related_data()

        # Summary
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would delete {total_files} files')
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleanup complete!\n'
                    f'Deleted: {deleted_count} files\n'
                    f'Errors: {error_count} files\n'
                    f'Remaining: {total_files - deleted_count} files'
                )
            )

    def delete_from_aws(self, file_obj, s3_service):
        """Delete file from AWS S3 and Glacier"""
        try:
            # Delete from S3
            s3_service.delete_file(file_obj.s3_key)
            
            # If file is archived, also delete from Glacier
            if file_obj.status == 'archived' and file_obj.glacier_archive_id:
                try:
                    s3_service.delete_glacier_archive(file_obj.glacier_archive_id)
                except Exception as e:
                    logger.warning(f'Could not delete Glacier archive {file_obj.glacier_archive_id}: {e}')
                    
        except Exception as e:
            logger.error(f'Error deleting {file_obj.s3_key} from AWS: {e}')
            raise

    def cleanup_related_data(self):
        """Clean up related database records"""
        try:
            # Delete all archive jobs
            archive_jobs = ArchiveJob.objects.all()
            archive_count = archive_jobs.count()
            archive_jobs.delete()
            self.stdout.write(f'Deleted {archive_count} archive jobs')

            # Delete all upload jobs
            upload_jobs = UploadJob.objects.all()
            upload_count = upload_jobs.count()
            upload_jobs.delete()
            self.stdout.write(f'Deleted {upload_count} upload jobs')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error cleaning up related data: {str(e)}')
            )

    def cleanup_s3_bucket(self):
        """Clean up entire S3 bucket (optional)"""
        try:
            s3_client = boto3.client('s3')
            bucket_name = settings.AWS_STORAGE_BUCKET_NAME
            
            # List all objects
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket_name)
            
            objects_to_delete = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        objects_to_delete.append({'Key': obj['Key']})
            
            if objects_to_delete:
                # Delete in batches of 1000 (S3 limit)
                for i in range(0, len(objects_to_delete), 1000):
                    batch = objects_to_delete[i:i + 1000]
                    s3_client.delete_objects(
                        Bucket=bucket_name,
                        Delete={'Objects': batch}
                    )
                
                self.stdout.write(f'Deleted {len(objects_to_delete)} objects from S3 bucket')
            else:
                self.stdout.write('No objects found in S3 bucket')
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error cleaning S3 bucket: {str(e)}')
            )
