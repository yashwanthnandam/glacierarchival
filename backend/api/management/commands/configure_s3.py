from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import S3Config
import os

class Command(BaseCommand):
    help = 'Configure S3 settings for a user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Username to configure S3 for (default: admin)',
        )
        parser.add_argument(
            '--bucket',
            type=str,
            help='S3 bucket name (required)',
        )
        parser.add_argument(
            '--access-key',
            type=str,
            help='AWS Access Key ID (required)',
        )
        parser.add_argument(
            '--secret-key',
            type=str,
            help='AWS Secret Access Key (required)',
        )
        parser.add_argument(
            '--region',
            type=str,
            default='us-east-1',
            help='AWS region (default: us-east-1)',
        )

    def handle(self, *args, **options):
        username = options['username']
        bucket = options['bucket']
        access_key = options['access_key']
        secret_key = options['secret_key']
        region = options['region']
        
        # Validate required fields
        if not bucket:
            self.stdout.write(
                self.style.ERROR('Bucket name is required. Use --bucket BUCKET_NAME')
            )
            return
        
        if not access_key:
            self.stdout.write(
                self.style.ERROR('Access key is required. Use --access-key ACCESS_KEY')
            )
            return
        
        if not secret_key:
            self.stdout.write(
                self.style.ERROR('Secret key is required. Use --secret-key SECRET_KEY')
            )
            return
        
        # Get user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'User "{username}" not found')
            )
            return
        
        # Create or update S3 config
        s3_config, created = S3Config.objects.get_or_create(
            user=user,
            defaults={
                'bucket_name': bucket,
                'aws_access_key': access_key,
                'aws_secret_key': secret_key,
                'region': region
            }
        )
        
        if not created:
            # Update existing config
            s3_config.bucket_name = bucket
            s3_config.aws_access_key = access_key
            s3_config.aws_secret_key = secret_key
            s3_config.region = region
            s3_config.save()
        
        action = 'created' if created else 'updated'
        self.stdout.write(
            self.style.SUCCESS(f'S3 configuration {action} successfully for {username}')
        )
        self.stdout.write(f'Bucket: {bucket}')
        self.stdout.write(f'Region: {region}')
        self.stdout.write(f'Access Key: {access_key[:8]}...')
        
        # Test the configuration
        self.stdout.write('\nTesting S3 configuration...')
        try:
            from api.services import S3Service
            s3_service = S3Service(user)
            # Try to list objects to test the connection
            s3_service.list_objects()
            self.stdout.write(
                self.style.SUCCESS('S3 configuration test passed!')
            )
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f'S3 configuration test failed: {str(e)}')
            )
            self.stdout.write('Please check your credentials and bucket permissions.')
