"""
Management command to fix stuck files in 'uploading' status.

This command updates all files that are stuck in 'uploading' status to 'uploaded' status.
This is safe because files in 'uploading' status have already been uploaded to S3.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import MediaFile


class Command(BaseCommand):
    help = 'Fix stuck files in uploading status'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='Fix files for specific user ID only',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        user_id = options.get('user_id')
        dry_run = options.get('dry_run', False)
        
        # Build query
        query = MediaFile.objects.filter(
            status='uploading',
            is_deleted=False
        )
        
        if user_id:
            query = query.filter(user_id=user_id)
        
        stuck_files = query.all()
        total_count = stuck_files.count()
        
        if total_count == 0:
            self.stdout.write(
                self.style.SUCCESS('No stuck files found!')
            )
            return
        
        self.stdout.write(
            f'Found {total_count} files stuck in "uploading" status'
        )
        
        if user_id:
            self.stdout.write(f'For user ID: {user_id}')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN - No changes will be made')
            )
            # Show some examples
            for i, file in enumerate(stuck_files[:5]):
                self.stdout.write(f'  {i+1}. {file.original_filename} (ID: {file.id})')
            if total_count > 5:
                self.stdout.write(f'  ... and {total_count - 5} more files')
        else:
            # Update the files
            with transaction.atomic():
                updated_count = query.update(status='uploaded')
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated {updated_count} files from "uploading" to "uploaded" status'
                )
            )
