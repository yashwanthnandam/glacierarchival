from django.core.management.base import BaseCommand
from django.conf import settings
import boto3
import json

class Command(BaseCommand):
    help = 'Configure S3 bucket CORS policy for local development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bucket',
            type=str,
            help='S3 bucket name (defaults to AWS_STORAGE_BUCKET_NAME from settings)',
        )
        parser.add_argument(
            '--region',
            type=str,
            default='ap-south-1',
            help='AWS region (default: ap-south-1)',
        )

    def handle(self, *args, **options):
        bucket_name = options['bucket'] or settings.AWS_STORAGE_BUCKET_NAME
        region = options['region']
        
        if not bucket_name:
            self.stdout.write(
                self.style.ERROR('Bucket name is required. Set AWS_STORAGE_BUCKET_NAME in settings or use --bucket BUCKET_NAME')
            )
            return
        
        # Create S3 client
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY,
                region_name=region
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to create S3 client: {str(e)}')
            )
            return
        
        # CORS configuration for local development
        cors_configuration = {
            'CORSRules': [
                {
                    'AllowedHeaders': ['*'],
                    'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    'AllowedOrigins': [
                        'http://localhost:3000',
                        'http://127.0.0.1:3000',
                        'http://localhost:5173',
                        'http://127.0.0.1:5173',
                        'https://datahibernate.in',  # Production domain
                        'https://www.datahibernate.in'
                    ],
                    'ExposeHeaders': ['ETag', 'x-amz-request-id'],
                    'MaxAgeSeconds': 3000
                }
            ]
        }
        
        try:
            # Apply CORS configuration
            s3_client.put_bucket_cors(
                Bucket=bucket_name,
                CORSConfiguration=cors_configuration
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'CORS configuration applied successfully to bucket: {bucket_name}')
            )
            self.stdout.write('Allowed origins:')
            for origin in cors_configuration['CORSRules'][0]['AllowedOrigins']:
                self.stdout.write(f'  - {origin}')
            
            # Verify the configuration
            self.stdout.write('\nVerifying CORS configuration...')
            response = s3_client.get_bucket_cors(Bucket=bucket_name)
            self.stdout.write(
                self.style.SUCCESS('CORS configuration verified!')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Failed to configure CORS: {str(e)}')
            )
            if 'AccessDenied' in str(e):
                self.stdout.write(
                    self.style.WARNING('Make sure your AWS credentials have s3:PutBucketCors permission')
                )
