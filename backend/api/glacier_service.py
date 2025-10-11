"""
AWS Glacier service for real deep archival
"""
import boto3
import time
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
from django.utils import timezone
from .models import MediaFile, ArchiveJob
from .constants import GLACIER_VAULT_NAME, GLACIER_RESTORE_TIERS


class GlacierService:
    """Service for AWS Glacier operations"""
    
    def __init__(self, user):
        self.user = user
        self.glacier_client = boto3.client('glacier')
        self.s3_client = boto3.client('s3')
        self.vault_name = GLACIER_VAULT_NAME
    
    def archive_to_glacier(self, media_file, job):
        """Archive file to AWS Glacier"""
        try:
            # First, download file from S3 to local temp
            temp_file_path = self._download_from_s3(media_file.s3_key)
            
            # Upload to Glacier
            with open(temp_file_path, 'rb') as file_data:
                response = self.glacier_client.upload_archive(
                    vaultName=self.vault_name,
                    archiveDescription=f"Media file: {media_file.original_filename}",
                    body=file_data
                )
            
            # Store Glacier archive ID
            media_file.glacier_archive_id = response['archiveId']
            media_file.status = 'archived'
            media_file.archived_at = timezone.now()
            media_file.save()
            
            # Delete from S3 (optional - you might want to keep a copy)
            self.s3_client.delete_object(
                Bucket=media_file.s3_config.bucket_name,
                Key=media_file.s3_key
            )
            
            # Update job
            job.status = 'completed'
            job.progress = 100
            job.completed_at = timezone.now()
            job.save()
            
            # Clean up temp file
            os.remove(temp_file_path)
            
            return job
            
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
            raise e
    
    def initiate_restore(self, media_file, job, restore_tier='Standard'):
        """Initiate restore from Glacier (takes hours)"""
        try:
            # Initiate restore job
            response = self.glacier_client.initiate_job(
                vaultName=self.vault_name,
                jobParameters={
                    'Type': 'archive-retrieval',
                    'ArchiveId': media_file.glacier_archive_id,
                    'Tier': restore_tier,
                    'Description': f"Restore {media_file.original_filename}"
                }
            )
            
            # Store Glacier job ID
            job.glacier_job_id = response['jobId']
            job.status = 'in_progress'
            job.progress = 0
            job.save()
            
            # Update media file status
            media_file.status = 'restoring'
            media_file.save()
            
            return job
            
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
            raise e
    
    def check_restore_status(self, job):
        """Check if Glacier restore job is complete"""
        try:
            response = self.glacier_client.describe_job(
                vaultName=self.vault_name,
                jobId=job.glacier_job_id
            )
            
            if response['Completed']:
                # Download restored file
                self._download_restored_file(job)
                
                job.status = 'completed'
                job.progress = 100
                job.completed_at = timezone.now()
                job.save()
                
                # Update media file
                media_file = job.media_file
                media_file.status = 'restored'
                media_file.save()
                
                return True
            else:
                # Update progress based on job status
                if response['StatusCode'] == 'InProgress':
                    job.progress = 50  # Approximate progress
                elif response['StatusCode'] == 'Succeeded':
                    job.progress = 90
                
                job.save()
                return False
                
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
            raise e
    
    def _download_restored_file(self, job):
        """Download restored file from Glacier"""
        try:
            # Get job output
            response = self.glacier_client.get_job_output(
                vaultName=self.vault_name,
                jobId=job.glacier_job_id
            )
            
            # Upload to S3
            media_file = job.media_file
            restore_key = f"uploads/{self.user.username}/{media_file.filename}"
            
            self.s3_client.upload_fileobj(
                response['body'],
                media_file.s3_config.bucket_name,
                restore_key
            )
            
            # Update media file S3 key
            media_file.s3_key = restore_key
            media_file.save()
            
        except Exception as e:
            raise e
    
    def _download_from_s3(self, s3_key):
        """Download file from S3 to temporary location"""
        import tempfile
        import os
        
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.s3_client.download_fileobj(
            media_file.s3_config.bucket_name,
            s3_key,
            temp_file
        )
        temp_file.close()
        
        return temp_file.name
    
    def get_restore_estimate(self, restore_tier='Standard'):
        """Get estimated restore time"""
        estimates = {
            'Expedited': '1-5 minutes',
            'Standard': '3-5 hours',
            'Bulk': '5-12 hours'
        }
        return estimates.get(restore_tier, '3-5 hours')


class GlacierJobManager:
    """Manager for Glacier restore jobs"""
    
    @staticmethod
    def process_pending_restores():
        """Process pending restore jobs (call this periodically)"""
        pending_jobs = ArchiveJob.objects.filter(
            job_type='restore',
            status='in_progress',
            glacier_job_id__isnull=False
        )
        
        for job in pending_jobs:
            try:
                glacier_service = GlacierService(job.user)
                glacier_service.check_restore_status(job)
            except Exception as e:
                print(f"Error checking restore status for job {job.id}: {e}")
    
    @staticmethod
    def get_restore_tiers():
        """Get available restore tiers with costs and times"""
        return {
            'Expedited': {
                'time': '1-5 minutes',
                'cost': 'High',
                'description': 'Fastest restore option'
            },
            'Standard': {
                'time': '3-5 hours',
                'cost': 'Standard',
                'description': 'Default restore option'
            },
            'Bulk': {
                'time': '5-12 hours',
                'cost': 'Lowest',
                'description': 'Cheapest restore option'
            }
        }
