"""
Service layer for business logic
"""
import boto3
import uuid
import hashlib
import os
from datetime import timedelta
from botocore.exceptions import ClientError
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail
from .models import MediaFile, ArchiveJob, S3Config, EmailVerification, HibernationPlan, UserHibernationPlan
from .constants import (
    MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_FILES_PER_UPLOAD,
    S3_CHUNK_SIZE, S3_MULTIPART_THRESHOLD, EMAIL_VERIFICATION_EXPIRY_HOURS,
    DOWNLOAD_URL_EXPIRY_SECONDS, RESTORE_TIME_ESTIMATES
)
from .utils import calculate_file_checksum, sanitize_filename
from .base_service import BaseService
from .error_handling import APIError
from .upload_error_handling import (
    FileSizeError, StorageLimitError, SessionSizeError,
    FileCountError, validate_file_size, validate_storage_limit,
    validate_session_size, validate_file_count, handle_upload_error
)


class S3Service:
    """Service for S3 operations"""
    
    def __init__(self, user):
        self.user = user
        self.s3_config = self._get_s3_config()
        self.s3_client = self._get_s3_client()
        self.hibernation_service = HibernationPlanService(user)
    
    def _get_s3_config(self):
        """Get S3 configuration for user"""
        try:
            return S3Config.objects.get(user=self.user)
        except S3Config.DoesNotExist:
            raise ValueError("S3 configuration required")
    
    def _get_s3_client(self):
        """Get S3 client with Transfer Acceleration"""
        return boto3.client(
            's3',
            aws_access_key_id=self.s3_config.aws_access_key,
            aws_secret_access_key=self.s3_config.aws_secret_key,
            region_name=self.s3_config.region
        )
    
    def _get_aws_storage_class(self, hibernation_storage_type):
        """Map hibernation plan storage type to AWS S3 storage class"""
        storage_class_mapping = {
            'deep_archive': 'DEEP_ARCHIVE',
            'glacier_flexible': 'GLACIER',
            'glacier_instant': 'GLACIER_IR',  # Glacier Instant Retrieval
        }
        return storage_class_mapping.get(hibernation_storage_type, 'STANDARD')
    
    def check_rate_limits(self, operation_type='upload', file_size_bytes=0):
        """Check rate limits based on hibernation plan"""
        user_plan = self.hibernation_service.get_user_plan()
        if not user_plan:
            raise ValueError("Active hibernation plan required")
        
        plan = user_plan.plan
        
        if operation_type == 'upload':
            # Check storage limits
            if not self.hibernation_service.check_storage_limit(file_size_bytes):
                raise ValueError(f"Storage limit exceeded. Current usage: {self.hibernation_service.get_storage_usage_percentage():.1f}%")
        
        elif operation_type == 'restore':
            # Check retrieval limits
            file_size_gb = file_size_bytes / (1024**3)
            if plan.free_retrieval_gb > 0 and user_plan.retrieval_remaining_gb < file_size_gb:
                # Retrieval is included in plan
                pass
        
        return True
    
    # --- Safe key helpers (simple, clean, backward-compatible) ---
    def _sanitize_segment(self, segment: str) -> str:
        """Sanitize one path segment: lowercase, replace spaces/() with '-', keep a-z0-9-_."""
        if not segment:
            return segment
        import re
        safe = segment.lower()
        safe = safe.replace('(', '-').replace(')', '-')
        safe = re.sub(r"\s+", '-', safe)
        # Remove characters not in allowed set (a-z, 0-9, '-', '_', '.', '/'). Slash is handled by caller
        safe = re.sub(r"[^a-z0-9\-_.]", '', safe)
        # Collapse repeated dashes
        safe = re.sub(r"-+", '-', safe)
        return safe.strip('-')

    def _sanitize_path(self, relative_path: str, fallback_filename: str | None) -> str:
        """Sanitize a provided relative_path. If it includes a filename (has a dot in last segment),
        sanitize that filename; otherwise return sanitized directory path. Does not prepend uploads/{user}.
        """
        if not relative_path:
            return ''
        parts = [p for p in relative_path.split('/') if p not in (None, '', '.')]
        if not parts:
            return ''
        # Determine if last part is a filename (has dot and not dotfile-only)
        last = parts[-1]
        is_filename = ('.' in last and not last.startswith('.'))
        sanitized_parts = [self._sanitize_segment(p) for p in parts]
        # If sanitization removed last part and we expected a filename, fallback
        if is_filename and not sanitized_parts[-1]:
            sanitized_parts[-1] = self._sanitize_segment(fallback_filename or last)
        # Remove any empty segments created by sanitization
        sanitized_parts = [p for p in sanitized_parts if p]
        return '/'.join(sanitized_parts)
    
    def list_objects(self):
        """List objects in S3 bucket for testing connection"""
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_config.bucket_name,
                MaxKeys=1
            )
            return response
        except Exception as e:
            raise Exception(f"S3 connection test failed: {str(e)}")
    
    def upload_file(self, file, relative_path=None):
        """Upload file to S3 with free tier and hibernation plan enforcement"""
        print(f"S3Service.upload_file called for: {file.name}, relative_path: {relative_path}")
        
        # Check hibernation plan limits
        user_plan = self.hibernation_service.get_user_plan()
        
        if not user_plan:
            # Check free tier limit (15GB) using new error handling
            from django.db.models import Sum
            from .models import MediaFile
            
            total_storage_bytes = MediaFile.objects.filter(
                user=self.user, 
                is_deleted=False
            ).aggregate(total=Sum('file_size'))['total'] or 0
            
            try:
                validate_storage_limit(total_storage_bytes, file.size)
            except StorageLimitError as e:
                raise e
        else:
            # Check storage limits for paid plans
            if not self.hibernation_service.check_storage_limit(file.size):
                raise ValueError(f"Storage limit exceeded. Current usage: {self.hibernation_service.get_storage_usage_percentage():.1f}%")
        
        # Sanitize filename and ensure it fits with UUID prefix
        sanitized_name = sanitize_filename(file.name)
        uuid_prefix = str(uuid.uuid4())
        
        # Calculate available space for filename (255 - UUID length - underscore)
        max_filename_length = 255 - len(uuid_prefix) - 1  # -1 for underscore
        
        # Truncate filename if needed
        if len(sanitized_name) > max_filename_length:
            name, ext = os.path.splitext(sanitized_name)
            sanitized_name = name[:max_filename_length - len(ext)] + ext
        
        unique_filename = f"{uuid_prefix}_{sanitized_name}"
        
        # Final safety check - ensure total length doesn't exceed 255
        if len(unique_filename) > 255:
            # If still too long, use just the UUID with a short suffix
            unique_filename = f"{uuid_prefix}_file"
        
        if relative_path:
            # Simple, clean, backward-compatible sanitization: lowercase and replace spaces/() with '-'
            sanitized = relative_path.strip().lower().replace('(', '-').replace(')', '-').replace(' ', '-')
            sanitized = sanitized.strip('/')
            # Always treat provided path as a folder path; append generated unique filename
            s3_key = f"uploads/{self.user.username}/{sanitized}/{unique_filename}"
        else:
            s3_key = f"uploads/{self.user.username}/{unique_filename}"
        
        # Reset file pointer to beginning (in case it was read for checksum)
        file.seek(0)
        
        # Read file content once to avoid file handle issues
        file_content = file.read()
        file.seek(0)  # Reset for S3 upload attempt
        
        print(f"Uploading to S3: bucket={self.s3_config.bucket_name}, key={s3_key}")
        try:
            # Create a new file-like object from content for S3 upload
            from io import BytesIO
            file_obj = BytesIO(file_content)
            file_obj.seek(0)
            
            # Determine storage class based on hibernation plan or use standard for free tier
            if user_plan:
                aws_storage_class = self._get_aws_storage_class(user_plan.plan.aws_storage_type)
            else:
                aws_storage_class = 'STANDARD'  # Free tier uses standard storage
            
            self.s3_client.upload_fileobj(
                file_obj,
                self.s3_config.bucket_name,
                s3_key,
                ExtraArgs={
                    'ContentType': file.content_type,
                    'StorageClass': aws_storage_class
                }
            )
            print(f"S3 upload successful for: {s3_key}")
        except Exception as e:
            print(f"S3 upload failed for {s3_key}: {str(e)}")
            
            # Check if it's an AWS credentials error or local storage configuration
            error_str = str(e)
            if any(error in error_str for error in [
                "InvalidAccessKeyId", 
                "SignatureDoesNotMatch", 
                "Could not connect to the endpoint URL",
                "local.amazonaws.com"
            ]):
                print(f"Using local storage fallback for testing: {s3_key}")
                return self._upload_to_local_storage_with_content(file_content, s3_key, unique_filename)
            else:
                raise
        
        return s3_key, unique_filename
    
    def _upload_to_local_storage_with_content(self, file_content, s3_key, unique_filename):
        """Upload file content to local storage for testing when S3 credentials are invalid"""
        try:
            # Create local storage directory
            local_storage_dir = os.path.join(settings.MEDIA_ROOT, 'uploads', self.user.username)
            os.makedirs(local_storage_dir, exist_ok=True)
            
            # Create local file path
            local_file_path = os.path.join(local_storage_dir, os.path.basename(s3_key))
            
            # Write file content to local storage
            with open(local_file_path, 'wb') as local_file:
                local_file.write(file_content)
            
            print(f"File saved to local storage: {local_file_path}")
            
            # Return the s3_key format for consistency (but it's actually local)
            return s3_key, unique_filename
            
        except Exception as e:
            print(f"Local storage upload failed: {str(e)}")
            raise
    
    def copy_file(self, source_key, dest_key):
        """Copy file within S3"""
        copy_source = {
            'Bucket': self.s3_config.bucket_name,
            'Key': source_key
        }
        
        self.s3_client.copy_object(
            CopySource=copy_source,
            Bucket=self.s3_config.bucket_name,
            Key=dest_key
        )
    
    def delete_file(self, s3_key):
        """Delete file from S3"""
        self.s3_client.delete_object(
            Bucket=self.s3_config.bucket_name,
            Key=s3_key
        )
    
    def delete_glacier_archive(self, glacier_archive_id):
        """Delete Glacier archive (simulated - in real implementation, this would delete from Glacier)"""
        # In a real implementation, you would use Glacier API to delete the archive
        # For now, we'll just log it since we're simulating Glacier
        print(f"Simulated deletion of Glacier archive: {glacier_archive_id}")
        # Note: In production, you would implement actual Glacier deletion here
    
    def generate_download_url(self, s3_key, expires_in=DOWNLOAD_URL_EXPIRY_SECONDS):
        """Generate presigned download URL"""
        return self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.s3_config.bucket_name, 'Key': s3_key},
            ExpiresIn=expires_in
        )
    
    def create_multipart_upload(self, s3_key, content_type='application/octet-stream'):
        """Create multipart upload and return upload ID with hibernation plan storage class"""
        try:
            # Get user's hibernation plan for storage class
            user_plan = self.hibernation_service.get_user_plan()
            
            # Determine storage class based on hibernation plan or use standard for free tier
            if user_plan:
                aws_storage_class = self._get_aws_storage_class(user_plan.plan.aws_storage_type)
            else:
                aws_storage_class = 'STANDARD'  # Free tier uses standard storage
            
            response = self.s3_client.create_multipart_upload(
                Bucket=self.s3_config.bucket_name,
                Key=s3_key,
                ContentType=content_type,
                StorageClass=aws_storage_class
            )
            return response['UploadId']
        except Exception as e:
            print(f"Error creating multipart upload for {s3_key}: {str(e)}")
            raise
    
    def generate_presigned_url_for_chunk(self, s3_key, upload_id, part_number, expires_in=3600):
        """Generate presigned URL for uploading a chunk"""
        try:
            return self.s3_client.generate_presigned_url(
                'upload_part',
                Params={
                    'Bucket': self.s3_config.bucket_name,
                    'Key': s3_key,
                    'UploadId': upload_id,
                    'PartNumber': part_number
                },
                ExpiresIn=expires_in
            )
        except Exception as e:
            print(f"Error generating presigned URL for chunk {part_number}: {str(e)}")
            raise
    
    def complete_multipart_upload(self, s3_key, upload_id, parts):
        """Complete multipart upload"""
        try:
            response = self.s3_client.complete_multipart_upload(
                Bucket=self.s3_config.bucket_name,
                Key=s3_key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts}
            )
            return response
        except Exception as e:
            print(f"Error completing multipart upload for {s3_key}: {str(e)}")
            raise
    
    def abort_multipart_upload(self, s3_key, upload_id):
        """Abort multipart upload"""
        try:
            self.s3_client.abort_multipart_upload(
                Bucket=self.s3_config.bucket_name,
                Key=s3_key,
                UploadId=upload_id
            )
        except Exception as e:
            print(f"Error aborting multipart upload for {s3_key}: {str(e)}")
            raise
    
    def calculate_storage_cost(self, file_size_bytes, storage_class='standard', currency='USD'):
        """Calculate storage cost based on file size and storage class"""
        # AWS S3 pricing (as of 2024) - per GB per month
        pricing_usd = {
            'standard': 0.023,  # S3 Standard
            'ia': 0.0125,       # S3 Standard-IA
            'glacier': 0.004,   # S3 Glacier
            'deep_archive': 0.00099  # S3 Glacier Deep Archive
        }
        
        # Indian Rupee pricing (as of 2024) - per GB per month
        pricing_inr = {
            'standard': 1.92,      # ₹1.92/GB/month (S3 Standard)
            'ia': 1.04,            # ₹1.04/GB/month (S3 Standard-IA)
            'glacier': 0.33,       # ₹0.33/GB/month (S3 Glacier)
            'deep_archive': 0.08   # ₹0.08/GB/month (S3 Glacier Deep Archive)
        }
        
        # Convert bytes to GB
        file_size_gb = file_size_bytes / (1024 ** 3)
        
        # Calculate monthly cost
        if currency.upper() == 'INR':
            monthly_cost = file_size_gb * pricing_inr.get(storage_class, pricing_inr['standard'])
        else:
            monthly_cost = file_size_gb * pricing_usd.get(storage_class, pricing_usd['standard'])
        
        return round(monthly_cost, 4)
    
    def calculate_storage_cost_with_gst(self, file_size_bytes, storage_class='standard', gst_rate=18.0):
        """Calculate storage cost in INR with GST"""
        base_cost = self.calculate_storage_cost(file_size_bytes, storage_class, 'INR')
        gst_amount = base_cost * (gst_rate / 100)
        total_cost = base_cost + gst_amount
        
        return {
            'base_cost': round(base_cost, 4),
            'gst_amount': round(gst_amount, 4),
            'total_cost': round(total_cost, 4),
            'gst_rate': gst_rate
        }
    
    def get_smart_tier_suggestion(self, file_size_bytes, file_type):
        """Suggest optimal storage tier based on file characteristics"""
        file_size_gb = file_size_bytes / (1024 ** 3)
        
        # Large files (>1GB) benefit from Glacier Deep Archive
        if file_size_gb > 1:
            return {
                'suggested_tier': 'deep_archive',
                'reason': 'Large file - significant cost savings with Deep Archive',
                'cost_savings': self.calculate_storage_cost(file_size_bytes, 'standard') - self.calculate_storage_cost(file_size_bytes, 'deep_archive'),
                'retrieval_time': '12+ hours'
            }
        
        # Media files that are rarely accessed
        if file_type.startswith(('video/', 'audio/')) and file_size_gb > 0.1:
            return {
                'suggested_tier': 'glacier',
                'reason': 'Media file - good candidate for Glacier storage',
                'cost_savings': self.calculate_storage_cost(file_size_bytes, 'standard') - self.calculate_storage_cost(file_size_bytes, 'glacier'),
                'retrieval_time': '3-5 hours'
            }
        
        # Small files stay in Standard
        return {
            'suggested_tier': 'standard',
            'reason': 'Small file - Standard storage is optimal',
            'cost_savings': 0,
            'retrieval_time': 'Instant'
        }

    def batch_delete_files(self, s3_keys):
        """Delete multiple files using S3 batch delete API for maximum speed"""
        if not s3_keys:
            return {'deleted': 0, 'failed': 0, 'method': 'batch'}
        
        try:
            # Prepare delete objects for batch operation
            delete_objects = [{'Key': key} for key in s3_keys]
            
            # Use S3 batch delete API
            response = self.s3_client.delete_objects(
                Bucket=self.s3_config.bucket_name,
                Delete={
                    'Objects': delete_objects,
                    'Quiet': False  # Return detailed response
                }
            )
            
            deleted_count = len(response.get('Deleted', []))
            failed_count = len(response.get('Errors', []))
            
            return {
                'deleted': deleted_count,
                'failed': failed_count,
                'method': 'batch',
                'errors': response.get('Errors', []),
                'message': f'Batch deleted {deleted_count} files'
            }
            
        except Exception as e:
            raise Exception(f"S3 batch delete failed: {str(e)}")


class MediaFileService(BaseService):
    """Service for media file operations"""
    
    def __init__(self, user):
        super().__init__(user)
        self.s3_service = S3Service(user)
        self.hibernation_service = HibernationPlanService(user)
    
    def create_media_file(self, file, relative_path=None):
        """Create media file record and upload to S3 with free tier and hibernation plan enforcement"""
        # Security checks
        self._validate_file(file)
        
        # Check storage limits (free tier or hibernation plan)
        user_plan = self.hibernation_service.get_user_plan()
        
        if not user_plan:
            # Check free tier limit (15GB) using new error handling
            from django.db.models import Sum
            from .models import MediaFile
            
            total_storage_bytes = MediaFile.objects.filter(
                user=self.user, 
                is_deleted=False
            ).aggregate(total=Sum('file_size'))['total'] or 0
            
            try:
                validate_storage_limit(total_storage_bytes, file.size)
            except StorageLimitError as e:
                raise e
        else:
            # Check hibernation plan limits
            self.s3_service.check_rate_limits('upload', file.size)
        
        # Calculate checksum before upload (file handle is still open)
        checksum = self._calculate_checksum(file)
        
        # Check for duplicates based on checksum and relative path
        existing_file = self._check_for_duplicate(checksum, relative_path, file.name)
        if existing_file:
            print(f"Duplicate detected: {file.name} (checksum: {checksum[:8]}...)")
            # Mark as duplicate for tracking
            existing_file._is_duplicate = True
            return existing_file
        
        # Upload to S3
        s3_key, unique_filename = self.s3_service.upload_file(file, relative_path)
        
        # Create database record
        media_file = MediaFile.objects.create(
            user=self.user,
            filename=unique_filename,
            original_filename=sanitize_filename(file.name),
            file_size=file.size,
            file_type=file.content_type,
            s3_key=s3_key,
            status='uploaded',
            checksum=checksum,
            relative_path=relative_path
        )
        
        return media_file
    
    def _check_for_duplicate(self, checksum, relative_path, filename):
        """Check if a file with the same content already exists"""
        # First check by checksum (most reliable)
        existing_by_checksum = MediaFile.objects.filter(
            user=self.user,
            checksum=checksum,
            is_deleted=False
        ).first()
        
        if existing_by_checksum:
            # If same checksum, also check if it's the same relative path
            if existing_by_checksum.relative_path == relative_path:
                print(f"Exact duplicate found: {filename} at {relative_path}")
                return existing_by_checksum
            else:
                print(f"Same content, different path: {filename} (existing: {existing_by_checksum.relative_path})")
                # Could create a symlink or reference here, but for now return None to allow upload
        
        # Also check by filename and relative path (less reliable but catches renames)
        if relative_path:
            existing_by_path = MediaFile.objects.filter(
                user=self.user,
                relative_path=relative_path,
                original_filename=filename,
                is_deleted=False
            ).first()
            
            if existing_by_path:
                print(f"File already exists at path: {relative_path}")
                return existing_by_path
        
        return None
    
    def archive_file(self, media_file):
        """Archive a media file based on user's hibernation plan"""
        if media_file.status != 'uploaded':
            raise ValueError("File must be uploaded before archiving")
        
        # Check hibernation plan limits
        self.s3_service.check_rate_limits('archive', media_file.file_size)
        
        # Get user's hibernation plan to determine storage class
        user_plan = self.hibernation_service.get_user_plan()
        if not user_plan:
            raise ValueError("Active hibernation plan required for archiving")
        
        # Check storage limits
        if not self.hibernation_service.check_storage_limit(media_file.file_size):
            raise ValueError(f"Storage limit exceeded. Current usage: {self.hibernation_service.get_storage_usage_percentage():.1f}%")
        
        # Create archive job
        job = ArchiveJob.objects.create(
            user=self.user,
            media_file=media_file,
            job_type='archive',
            status='in_progress'
        )
        
        try:
            # Derive a safe archive destination key. Some older rows may have empty filename.
            # Prefer the basename of current s3_key, then fallback to filename, then original_filename.
            import os
            source_key = media_file.s3_key
            basename = os.path.basename(source_key or '')
            candidate_name = basename or (media_file.filename or media_file.original_filename)
            if not candidate_name:
                raise ValueError("Cannot determine archive file name")
            archive_key = f"archives/{self.user.username}/{candidate_name}"
            
            # Copy file to archive location
            self.s3_service.copy_file(media_file.s3_key, archive_key)
            
            # Delete original file
            self.s3_service.delete_file(media_file.s3_key)
            
            # Update media file
            media_file.status = 'archived'
            media_file.s3_key = archive_key
            media_file.archived_at = timezone.now()
            media_file.save()
            
            # Update job
            job.status = 'completed'
            job.progress = 100
            job.completed_at = timezone.now()
            job.save()
            
            return job
            
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
            raise e
    
    def restore_file(self, media_file, restore_tier='Standard'):
        """Restore an archived file with hibernation plan limits"""
        if media_file.status != 'archived':
            raise ValueError("File is not archived")
        
        # Check hibernation plan limits
        self.s3_service.check_rate_limits('restore', media_file.file_size)
        
        # Delegate to S3Service for actual restore
        return self.s3_service.restore_file(media_file, restore_tier)
    
    def _validate_file(self, file):
        """Validate file before upload with comprehensive security checks"""
        if not file:
            raise ValueError("File is required")
        
        if not hasattr(file, 'name') or not file.name:
            raise ValueError("File name is required")
        
        if not hasattr(file, 'size') or file.size <= 0:
            raise ValueError("File size must be greater than 0")
        
        # Security: File size validation using new error handling
        try:
            validate_file_size(file.size, file.name)
        except FileSizeError as e:
            raise e
        
        
        # Security: Filename validation (prevent path traversal)
        import os
        filename = os.path.basename(file.name)
        if filename != file.name:
            raise ValueError("Invalid file path - path traversal not allowed")
        
        # Security: Filename length validation
        if len(filename) > 255:
            raise ValueError("Filename too long (max 255 characters)")
    
    def _calculate_checksum(self, file):
        """Calculate file checksum for integrity"""
        return calculate_file_checksum(file)


class EmailService:
    """Service for email operations"""
    
    @staticmethod
    def send_verification_email(user, token, request=None):
        """Send email verification"""
        subject = 'Verify your Glacier Archival account'
        
        # Determine the frontend URL dynamically
        if request:
            # Check for frontend-specific headers first
            frontend_host = request.META.get('HTTP_X_FORWARDED_HOST') or request.META.get('HTTP_ORIGIN')
            
            if frontend_host:
                # Extract host from origin (e.g., "http://localhost:5173" -> "localhost:5173")
                if '://' in frontend_host:
                    frontend_host = frontend_host.split('://')[1]
                scheme = 'https' if request.is_secure() else 'http'
                frontend_url = f"{scheme}://{frontend_host}"
            else:
                # Fallback: try to detect frontend port from common patterns
                host = request.get_host()
                if ':8000' in host:  # Backend port
                    frontend_host = host.replace(':8000', ':5173')  # Frontend port
                    scheme = 'https' if request.is_secure() else 'http'
                    frontend_url = f"{scheme}://{frontend_host}"
                else:
                    # Use the request's origin for dynamic URL
                    scheme = 'https' if request.is_secure() else 'http'
                    frontend_url = f"{scheme}://{host}"
        else:
            # Fallback to settings or environment
            frontend_url = settings.FRONTEND_URL
        
        verification_url = f"{frontend_url}/verify-email?token={token}"
        
        # Get expiry days from settings
        from .constants import EMAIL_VERIFICATION_EXPIRY_HOURS
        expiry_days = EMAIL_VERIFICATION_EXPIRY_HOURS / 24
        
        message = f"""
        Hello {user.username},
        
        Thank you for registering with Glacier Archival System!
        
        Please click the link below to verify your email address:
        {verification_url}
        
        This link will expire in {expiry_days:.0f} days.
        
        If you didn't create this account, please ignore this email.
        
        Best regards,
        Glacier Archival Team
        """
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )


class HibernationPlanService:
    """Service for hibernation plan operations"""
    
    def __init__(self, user):
        self.user = user
    
    def get_user_plan(self):
        """Get user's current hibernation plan"""
        try:
            return UserHibernationPlan.objects.get(user=self.user, is_active=True)
        except UserHibernationPlan.DoesNotExist:
            return None
    
    def subscribe_to_plan(self, plan_id):
        """Subscribe user to a hibernation plan"""
        try:
            plan = HibernationPlan.objects.get(id=plan_id, is_active=True)
        except HibernationPlan.DoesNotExist:
            raise ValueError("Plan not found or inactive")
        
        # Check if user already has an active plan
        existing_plan = self.get_user_plan()
        if existing_plan:
            raise ValueError("User already has an active plan")
        
        # Create user plan (expires in 1 year)
        expires_at = timezone.now() + timedelta(days=365)
        
        user_plan = UserHibernationPlan.objects.create(
            user=self.user,
            plan=plan,
            expires_at=expires_at,
            is_active=True
        )
        
        return user_plan
    
    def cancel_subscription(self):
        """Cancel user's hibernation plan subscription"""
        user_plan = self.get_user_plan()
        if not user_plan:
            raise ValueError("No active plan found")
        
        user_plan.is_active = False
        user_plan.save()
        
        return user_plan
    
    def get_usage_stats(self):
        """Get user's plan usage statistics"""
        user_plan = self.get_user_plan()
        if not user_plan:
            raise ValueError("No active plan found")
        
        # Calculate total storage used by user's files
        from django.db.models import Sum
        total_storage_bytes = MediaFile.objects.filter(
            user=self.user, 
            is_deleted=False
        ).aggregate(total=Sum('file_size'))['total'] or 0
        
        # Update user plan storage usage
        user_plan.storage_used_bytes = total_storage_bytes
        user_plan.save()
        
        return {
            'plan': user_plan.plan,
            'storage_used_bytes': total_storage_bytes,
            'storage_used_gb': round(total_storage_bytes / (1024**3), 2),
            'storage_limit_bytes': user_plan.plan.storage_size_bytes,
            'storage_limit_gb': round(user_plan.plan.storage_size_bytes / (1024**3), 2),
            'storage_used_percentage': user_plan.storage_used_percentage,
            'retrieval_used_gb': float(user_plan.retrieval_used_gb),
            'retrieval_remaining_gb': float(user_plan.retrieval_remaining_gb),
            'retrieval_limit_gb': user_plan.plan.free_retrieval_gb,
            'plan_expires_at': user_plan.expires_at,
            'is_expired': user_plan.is_expired()
        }
    
    def calculate_retrieval_cost(self, file_size_bytes):
        """Calculate retrieval cost for a file"""
        user_plan = self.get_user_plan()
        if not user_plan:
            raise ValueError("No active plan found")
        
        file_size_gb = file_size_bytes / (1024**3)
        
        # Check if user has free retrieval remaining
        if user_plan.retrieval_remaining_gb >= file_size_gb:
            # Use free retrieval
            user_plan.retrieval_used_gb += file_size_gb
            user_plan.save()
            return 0.0
        
        # Calculate cost for additional retrieval
        free_used = user_plan.retrieval_remaining_gb
        additional_gb = file_size_gb - free_used
        
        # Use remaining free retrieval
        if free_used > 0:
            user_plan.retrieval_used_gb += free_used
        
        user_plan.save()
        
        # No additional cost - retrieval is included in plan
        additional_cost = 0
        
        return float(additional_cost)
    
    def check_storage_limit(self, additional_bytes=0):
        """Check if user is within storage limit"""
        user_plan = self.get_user_plan()
        if not user_plan:
            return True  # No plan restrictions
        
        current_usage = user_plan.storage_used_bytes
        total_limit = user_plan.plan.storage_size_bytes
        
        return (current_usage + additional_bytes) <= total_limit
    
    def get_storage_usage_percentage(self):
        """Get current storage usage percentage"""
        user_plan = self.get_user_plan()
        if not user_plan:
            return 0
        
        return user_plan.storage_used_percentage
    
    def reset_retrieval_period(self):
        """Reset retrieval period (called monthly/periodically)"""
        user_plan = self.get_user_plan()
        if not user_plan:
            return
        
        user_plan.reset_retrieval_period()
    
    def get_plan_recommendations(self, total_storage_bytes):
        """Get plan recommendations based on storage needs"""
        total_storage_gb = total_storage_bytes / (1024**3)
        
        # Find plans that can accommodate the storage
        suitable_plans = HibernationPlan.objects.filter(
            is_active=True,
            storage_size_bytes__gte=total_storage_bytes
        ).order_by('user_cost_inr')
        
        recommendations = []
        for plan in suitable_plans:
            # Calculate cost per GB
            cost_per_gb = plan.user_cost_inr / (plan.storage_size_bytes / (1024**3))
            
            recommendations.append({
                'plan': plan,
                'cost_per_gb': cost_per_gb,
                'storage_efficiency': (plan.storage_size_bytes / (1024**3)) / total_storage_gb,
                'recommendation_score': self._calculate_recommendation_score(plan, total_storage_gb)
            })
        
        # Sort by recommendation score (higher is better)
        recommendations.sort(key=lambda x: x['recommendation_score'], reverse=True)
        
        return recommendations
    
    def _calculate_recommendation_score(self, plan, storage_gb):
        """Calculate recommendation score for a plan"""
        score = 0
        
        # Storage efficiency (closer to actual need is better)
        plan_gb = plan.storage_size_bytes / (1024**3)
        efficiency = min(1.0, storage_gb / plan_gb) if plan_gb > 0 else 0
        score += efficiency * 40
        
        # Cost efficiency (lower cost per GB is better)
        cost_per_gb = plan.user_cost_inr / plan_gb if plan_gb > 0 else float('inf')
        cost_score = max(0, 1 - (cost_per_gb / 100))  # Normalize to 0-1
        score += cost_score * 30
        
        # Restore time preference (instant is best)
        if plan.restore_time_hours == 0:
            score += 20
        elif plan.restore_time_hours <= 6:
            score += 15
        elif plan.restore_time_hours <= 12:
            score += 10
        
        # Retrieval benefits
        if plan.free_retrieval_gb == 0:  # Unlimited
            score += 10
        elif plan.free_retrieval_gb >= 10:
            score += 5
        
        return score