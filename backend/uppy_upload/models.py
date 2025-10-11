from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class UploadedFile(models.Model):
    """
    Simplified model for uploaded files using django-storages
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uppy_files')
    
    # File information
    file = models.FileField(upload_to='uploads/%Y/%m/%d/')
    original_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField()
    file_type = models.CharField(max_length=100, blank=True)
    
    # Directory structure support
    relative_path = models.CharField(max_length=1000, blank=True, help_text='Relative path within the uploaded directory')
    parent_directory = models.CharField(max_length=500, blank=True, help_text='Parent directory name')
    upload_session = models.ForeignKey('UploadSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='files')
    
    # Metadata
    upload_id = models.UUIDField(default=uuid.uuid4, unique=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_accessed = models.DateTimeField(auto_now=True)
    
    # Status and processing
    is_processed = models.BooleanField(default=False)
    processing_error = models.TextField(blank=True)
    
    # Storage information
    s3_key = models.CharField(max_length=1000, blank=True)
    s3_etag = models.CharField(max_length=100, blank=True)
    
    # Encryption information
    encryption_metadata = models.JSONField(blank=True, null=True, help_text='Encryption metadata including algorithm, IV, key info')
    is_encrypted = models.BooleanField(default=False, help_text='Whether the file is encrypted')
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'uploaded_at']),
            models.Index(fields=['user', 'parent_directory']),
            models.Index(fields=['upload_id']),
        ]
    
    def __str__(self):
        return f"{self.original_name} ({self.user.username})"
    
    @property
    def file_size_mb(self):
        """Return file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)
    
    @property
    def file_url(self):
        """Return the file URL"""
        if self.file:
            return self.file.url
        return None
    
    def to_media_file(self):
        """Convert this UploadedFile to a MediaFile record"""
        from api.models import MediaFile
        
        # Try to find an existing MediaFile using multiple strategies for legacy rows
        existing = None
        # 1) Exact s3_key match if present
        if self.s3_key:
            existing = MediaFile.objects.filter(user=self.user, s3_key=self.s3_key).first()
        # 2) Match by original_filename + size regardless of relative_path
        if not existing:
            existing = MediaFile.objects.filter(
                user=self.user,
                original_filename=self.original_name,
                file_size=self.file_size
            ).order_by('-uploaded_at').first()
        # 3) Match by original_filename case-insensitive + size
        if not existing:
            existing = MediaFile.objects.filter(
                user=self.user,
                file_size=self.file_size,
                original_filename__iexact=self.original_name
            ).order_by('-uploaded_at').first()
        
        if existing:
            # If it exists but is soft-deleted, undelete it and update s3_key/status
            if existing.is_deleted:
                existing.is_deleted = False
                existing.deleted_at = None
                if self.s3_key:
                    existing.s3_key = self.s3_key
                # Prefer current sanitized relative_path if provided
                if self.relative_path is not None:
                    existing.relative_path = self.relative_path
                if existing.status != 'uploaded':
                    existing.status = 'uploaded'
                existing.save(update_fields=['is_deleted', 'deleted_at', 's3_key', 'status', 'relative_path'])
            return existing
        
        # Create new MediaFile
        media_file = MediaFile.objects.create(
            user=self.user,
            original_filename=self.original_name,
            file_size=self.file_size,
            file_type=self.file_type,
            relative_path=self.relative_path,
            s3_key=self.s3_key,
            status='uploaded',
            uploaded_at=self.uploaded_at,
            last_accessed=self.last_accessed,
            encryption_metadata=self.encryption_metadata,
            is_encrypted=self.is_encrypted
        )
        
        return media_file


class UploadSession(models.Model):
    """
    Track upload sessions for directory uploads
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uppy_sessions')
    session_id = models.UUIDField(default=uuid.uuid4, unique=True)
    
    # Upload metadata
    total_files = models.IntegerField(default=0)
    uploaded_files = models.IntegerField(default=0)
    failed_files = models.IntegerField(default=0)
    
    # Directory information
    root_directory = models.CharField(max_length=500, blank=True)
    directory_structure = models.JSONField(default=dict, blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('uploading', 'Uploading'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Error handling
    error_message = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['session_id']),
        ]
    
    def __str__(self):
        return f"Upload Session {self.session_id} - {self.status}"
    
    @property
    def progress_percent(self):
        """Calculate upload progress percentage"""
        if self.total_files == 0:
            return 0
        return round((self.uploaded_files / self.total_files) * 100, 1)
    
    @property
    def duration(self):
        """Calculate upload duration"""
        if self.completed_at and self.started_at:
            return self.completed_at - self.started_at
        elif self.started_at:
            return timezone.now() - self.started_at
        return None