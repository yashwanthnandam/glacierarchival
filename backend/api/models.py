from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.crypto import get_random_string
from datetime import timedelta
import uuid
from django.conf import settings
from cryptography.fernet import Fernet
from .constants import (
    MEDIA_FILE_STATUS_CHOICES, ARCHIVE_JOB_TYPE_CHOICES,
    EMAIL_VERIFICATION_EXPIRY_HOURS
)

class S3Config(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='s3_config')
    bucket_name = models.CharField(max_length=255, db_index=True)
    aws_access_key = models.CharField(max_length=255)
    aws_secret_key_encrypted = models.TextField(blank=True, null=True)  # Store encrypted secret key
    region = models.CharField(max_length=50, default='us-east-1')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "S3 Configuration"
        verbose_name_plural = "S3 Configurations"

    def __str__(self):
        return f"{self.user.username} - {self.bucket_name}"

    def set_secret_key(self, secret_key):
        """Encrypt and store the AWS secret key - MANDATORY"""
        if not secret_key:
            raise ValueError("AWS secret key is required and cannot be empty")
        
        # Validate encryption key is available
        if not hasattr(settings, 'ENCRYPTION_KEY') or not settings.ENCRYPTION_KEY:
            raise ValueError("Encryption is mandatory but ENCRYPTION_KEY is not configured")
        
        try:
            f = Fernet(settings.ENCRYPTION_KEY.encode())
            self.aws_secret_key_encrypted = f.encrypt(secret_key.encode()).decode()
        except Exception as e:
            raise ValueError(f"Failed to encrypt secret key: {str(e)}")

    def get_secret_key(self):
        """Decrypt and return the AWS secret key - MANDATORY"""
        if not self.aws_secret_key_encrypted:
            return None
        
        # Validate encryption key is available
        if not hasattr(settings, 'ENCRYPTION_KEY') or not settings.ENCRYPTION_KEY:
            raise ValueError("Encryption is mandatory but ENCRYPTION_KEY is not configured")
        
        try:
            f = Fernet(settings.ENCRYPTION_KEY.encode())
            return f.decrypt(self.aws_secret_key_encrypted.encode()).decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt secret key: {str(e)}")

    @property
    def aws_secret_key(self):
        """Property to maintain backward compatibility"""
        return self.get_secret_key()

    @aws_secret_key.setter
    def aws_secret_key(self, value):
        """Property setter to maintain backward compatibility"""
        self.set_secret_key(value)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class MediaFile(models.Model):

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_files', db_index=True)
    filename = models.CharField(max_length=255, db_index=True)
    original_filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField(help_text='File size in bytes')
    file_type = models.CharField(max_length=100, db_index=True)
    s3_key = models.CharField(max_length=500, blank=True, null=True, db_index=True)
    status = models.CharField(max_length=20, choices=MEDIA_FILE_STATUS_CHOICES, default='uploaded', db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    archived_at = models.DateTimeField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    checksum = models.CharField(max_length=64, blank=True, null=True, help_text='File checksum for integrity')
    glacier_archive_id = models.CharField(max_length=255, blank=True, null=True, help_text='Glacier archive ID')
    restore_tier = models.CharField(max_length=20, choices=[
        ('Expedited', 'Expedited (1-5 min)'),
        ('Standard', 'Standard (3-5 hours)'),
        ('Bulk', 'Bulk (5-12 hours)'),
    ], default='Standard', help_text='Glacier restore tier')
    is_deleted = models.BooleanField(default=False, help_text='Soft delete flag')
    deleted_at = models.DateTimeField(blank=True, null=True, help_text='When the file was soft deleted')
    relative_path = models.CharField(max_length=1000, blank=True, null=True, db_index=True, help_text='Relative path of the file within the folder structure')
    encryption_metadata = models.JSONField(blank=True, null=True, help_text='Encryption metadata including algorithm, IV, key info')
    is_encrypted = models.BooleanField(default=False, help_text='Whether the file is encrypted')
    storage_cost = models.DecimalField(max_digits=10, decimal_places=4, blank=True, null=True, help_text='Storage cost in USD')
    last_accessed = models.DateTimeField(blank=True, null=True, help_text='Last time the file was accessed')

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'uploaded_at']),
            models.Index(fields=['file_type', 'status']),
            models.Index(fields=['user', 'relative_path', 'is_deleted']),  # For folder queries
            models.Index(fields=['user', 'is_deleted', 'uploaded_at']),   # For optimized listing
        ]
        verbose_name = "Media File"
        verbose_name_plural = "Media Files"

    def __str__(self):
        return f"{self.original_filename} - {self.status}"

    @property
    def file_size_mb(self):
        """Return file size in MB"""
        return round(self.file_size / (1024 * 1024), 2)

    @property
    def is_archived(self):
        """Check if file is archived"""
        return self.status == 'archived'

    @property
    def is_restored(self):
        """Check if file is restored"""
        return self.status == 'restored'

class ArchiveJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='archive_jobs', db_index=True)
    media_file = models.ForeignKey(MediaFile, on_delete=models.CASCADE, related_name='jobs', db_index=True)
    job_type = models.CharField(max_length=20, choices=ARCHIVE_JOB_TYPE_CHOICES, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    progress = models.IntegerField(default=0, help_text='Progress percentage')
    retry_count = models.IntegerField(default=0, help_text='Number of retry attempts')
    glacier_job_id = models.CharField(max_length=255, blank=True, null=True, help_text='Glacier job ID for restore operations')
    estimated_completion = models.DateTimeField(blank=True, null=True, help_text='Estimated completion time for restore')

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'job_type']),
            models.Index(fields=['status', 'started_at']),
        ]
        verbose_name = "Archive Job"
        verbose_name_plural = "Archive Jobs"

    def __str__(self):
        return f"{self.job_type} - {self.media_file.filename} - {self.status}"

    @property
    def duration(self):
        """Calculate job duration"""
        if self.completed_at:
            return self.completed_at - self.started_at
        return timezone.now() - self.started_at

    @property
    def is_completed(self):
        """Check if job is completed"""
        return self.status == 'completed'

    @property
    def is_failed(self):
        """Check if job failed"""
        return self.status == 'failed'

class EmailVerification(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_verification')
    token = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    verified = models.BooleanField(default=False, db_index=True)
    expires_at = models.DateTimeField(help_text='Token expiration time')

    class Meta:
        verbose_name = "Email Verification"
        verbose_name_plural = "Email Verifications"

    def __str__(self):
        return f"{self.user.email} - {'Verified' if self.verified else 'Pending'}"

    def is_expired(self):
        """Check if verification token is expired"""
        return timezone.now() > self.expires_at

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = get_random_string(32)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
        super().save(*args, **kwargs)


class PasswordResetToken(models.Model):
    """Password reset token model"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    used = models.BooleanField(default=False, db_index=True)
    expires_at = models.DateTimeField(help_text='Token expiration time')

    class Meta:
        verbose_name = "Password Reset Token"
        verbose_name_plural = "Password Reset Tokens"

    def __str__(self):
        return f"{self.user.username} - {self.token}"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = get_random_string(32)
        if not self.expires_at:
            # Password reset tokens expire in 1 hour
            self.expires_at = timezone.now() + timedelta(hours=1)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.used and not self.is_expired()


class HibernationPlan(models.Model):
    """Hibernation plan definitions"""
    name = models.CharField(max_length=100, help_text='Plan name (e.g., deep_freeze, smart_hibernate)')
    storage_tier = models.CharField(max_length=20, help_text='Storage tier (100gb, 500gb, 1tb)')
    aws_storage_type = models.CharField(max_length=50, default='deep_archive', help_text='AWS storage type')
    restore_time_hours = models.IntegerField(default=12, help_text='Restore time in hours')
    user_cost_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='User cost in INR')
    annual_price_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Annual price in INR')
    margin_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Margin in INR')
    free_retrieval_gb = models.IntegerField(default=10, help_text='Free retrieval in GB')
    retrieval_period_months = models.IntegerField(default=6, help_text='Retrieval period in months')
    user_message = models.TextField(default='', help_text='User message')
    description = models.TextField(default='', help_text='Plan description')
    is_active = models.BooleanField(default=True, help_text='Whether this plan is available for subscription')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Additional fields for new structure
    monthly_price_inr = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Monthly price in INR')
    storage_limit_gb = models.IntegerField(default=100, help_text='Storage limit in GB')
    aws_storage_class = models.CharField(max_length=50, default='DEEP_ARCHIVE', help_text='AWS storage class (DEEP_ARCHIVE, GLACIER, STANDARD)')
    retrieval_policy = models.TextField(default='', help_text='Retrieval policy description')

    class Meta:
        verbose_name = "Hibernation Plan"
        verbose_name_plural = "Hibernation Plans"
        unique_together = ['name', 'storage_tier']

    @property
    def storage_size_bytes(self):
        """Convert storage_limit_gb to bytes"""
        return self.storage_limit_gb * (1024 ** 3)
    
    @property
    def monthly_cost_usd(self):
        """Convert monthly price from INR to USD (approximate)"""
        # Approximate conversion rate: 1 USD = 83 INR
        return float(self.monthly_price_inr) / 83.0

    def __str__(self):
        return f"{self.name} - {self.storage_tier}"


class UserHibernationPlan(models.Model):
    """User's hibernation plan subscription"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hibernation_plans')
    plan = models.ForeignKey(HibernationPlan, on_delete=models.CASCADE, related_name='user_subscriptions')
    is_active = models.BooleanField(default=True, help_text='Whether this subscription is active')
    subscribed_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=timezone.now, help_text='Subscription expiration date')
    storage_used_bytes = models.BigIntegerField(default=0, help_text='Storage used in bytes')
    retrieval_used_gb = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Retrieval used in GB')
    retrieval_period_start = models.DateTimeField(default=timezone.now, help_text='Start of retrieval period')

    class Meta:
        verbose_name = "User Hibernation Plan"
        verbose_name_plural = "User Hibernation Plans"

    def __str__(self):
        return f"{self.user.username} - {self.plan.name}"


class Payment(models.Model):
    """Payment records for hibernation plan subscriptions"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_METHOD_CHOICES = [
        ('razorpay', 'Razorpay'),
        ('upi', 'UPI'),
        ('card', 'Card'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    hibernation_plan = models.ForeignKey(HibernationPlan, on_delete=models.CASCADE, related_name='payments')
    user_hibernation_plan = models.ForeignKey(UserHibernationPlan, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    razorpay_order_id = models.CharField(max_length=255, unique=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    amount_inr = models.DecimalField(max_digits=10, decimal_places=2, help_text='Amount in INR')
    currency = models.CharField(max_length=3, default='INR')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='razorpay')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.amount_inr} INR - {self.status}"


class UserActivity(models.Model):
    """Track user activities for analytics and abuse prevention"""
    ACTIVITY_TYPE_CHOICES = [
        ('upload', 'Upload'),
        ('download', 'Download'),
        ('delete', 'Delete'),
        ('restore', 'Restore'),
        ('archive', 'Archive'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities', db_index=True)
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    file_size_bytes = models.BigIntegerField(default=0, help_text='File size in bytes')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text='User IP address')
    user_agent = models.TextField(blank=True, null=True, help_text='User agent string')
    
    # Monthly tracking fields
    month = models.DateField(db_index=True, help_text='Month for tracking (first day of month)')
    daily_uploads = models.IntegerField(default=0, help_text='Daily upload count')
    daily_downloads = models.IntegerField(default=0, help_text='Daily download count')
    daily_storage_changes = models.BigIntegerField(default=0, help_text='Daily storage changes in bytes')
    
    # Additional metadata
    file_id = models.IntegerField(null=True, blank=True, help_text='MediaFile ID if applicable')
    success = models.BooleanField(default=True, help_text='Whether the activity was successful')
    error_message = models.TextField(blank=True, null=True, help_text='Error message if failed')
    
    class Meta:
        verbose_name = "User Activity"
        verbose_name_plural = "User Activities"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'activity_type']),
            models.Index(fields=['user', 'month']),
            models.Index(fields=['activity_type', 'timestamp']),
            models.Index(fields=['user', 'activity_type', 'month']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"


class UserLifetimeUsage(models.Model):
    """Track lifetime usage for abuse prevention"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='lifetime_usage', db_index=True)
    total_uploaded_bytes = models.BigIntegerField(default=0, help_text='Total bytes uploaded')
    total_downloaded_bytes = models.BigIntegerField(default=0, help_text='Total bytes downloaded')
    total_deleted_bytes = models.BigIntegerField(default=0, help_text='Total bytes deleted')
    peak_storage_bytes = models.BigIntegerField(default=0, help_text='Peak storage usage in bytes')
    files_uploaded_count = models.IntegerField(default=0, help_text='Total files uploaded')
    files_downloaded_count = models.IntegerField(default=0, help_text='Total files downloaded')
    files_deleted_count = models.IntegerField(default=0, help_text='Total files deleted')
    last_updated = models.DateTimeField(auto_now=True, help_text='Last update timestamp')
    
    # Abuse detection metrics
    upload_delete_ratio = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text='Upload/delete ratio')
    rapid_cycles_count = models.IntegerField(default=0, help_text='Count of rapid upload/delete cycles')
    abuse_score = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, help_text='Abuse score (0-1)')
    
    class Meta:
        verbose_name = "User Lifetime Usage"
        verbose_name_plural = "User Lifetime Usages"
    
    def __str__(self):
        return f"{self.user.username} - Lifetime Usage"
    
    @property
    def total_uploaded_gb(self):
        """Convert total uploaded bytes to GB"""
        return round(self.total_uploaded_bytes / (1024**3), 2)
    
    @property
    def total_downloaded_gb(self):
        """Convert total downloaded bytes to GB"""
        return round(self.total_downloaded_bytes / (1024**3), 2)
    
    @property
    def peak_storage_gb(self):
        """Convert peak storage bytes to GB"""
        return round(self.peak_storage_bytes / (1024**3), 2)
    
    def calculate_abuse_score(self):
        """Calculate abuse score based on usage patterns"""
        score = 0.0
        
        # High upload/delete ratio (abuse indicator)
        if self.files_uploaded_count > 0:
            delete_ratio = self.files_deleted_count / self.files_uploaded_count
            if delete_ratio > 0.8:  # More than 80% deletion rate
                score += min(0.4, delete_ratio - 0.8) * 2
        
        # Rapid cycles (upload and delete within short time)
        if self.rapid_cycles_count > 10:
            score += min(0.3, (self.rapid_cycles_count - 10) * 0.02)
        
        # Excessive lifetime usage
        if self.total_uploaded_gb > 100:  # More than 100GB lifetime
            score += min(0.3, (self.total_uploaded_gb - 100) * 0.01)
        
        self.abuse_score = min(1.0, score)
        return self.abuse_score


class UserMonthlyLimits(models.Model):
    """Track monthly usage limits and consumption"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='monthly_limits', db_index=True)
    month = models.DateField(db_index=True, help_text='First day of the month')
    
    # Limits (defaults for free tier)
    upload_limit_bytes = models.BigIntegerField(default=15*1024**3, help_text='Monthly upload limit in bytes (15GB)')
    download_limit_bytes = models.BigIntegerField(default=50*1024**3, help_text='Monthly download limit in bytes (50GB)')
    storage_limit_bytes = models.BigIntegerField(default=15*1024**3, help_text='Monthly storage limit in bytes (15GB)')
    
    # Usage tracking
    uploads_used_bytes = models.BigIntegerField(default=0, help_text='Bytes uploaded this month')
    downloads_used_bytes = models.BigIntegerField(default=0, help_text='Bytes downloaded this month')
    storage_peak_bytes = models.BigIntegerField(default=0, help_text='Peak storage usage this month')
    current_storage_bytes = models.BigIntegerField(default=0, help_text='Current storage usage')
    
    # Activity counts
    upload_count = models.IntegerField(default=0, help_text='Number of uploads this month')
    download_count = models.IntegerField(default=0, help_text='Number of downloads this month')
    delete_count = models.IntegerField(default=0, help_text='Number of deletions this month')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Monthly Limits"
        verbose_name_plural = "User Monthly Limits"
        unique_together = ['user', 'month']
        ordering = ['-month']
        indexes = [
            models.Index(fields=['user', 'month']),
            models.Index(fields=['month']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.month.strftime('%Y-%m')}"
    
    @property
    def upload_usage_percentage(self):
        """Calculate upload usage percentage"""
        if self.upload_limit_bytes == 0:
            return 0
        return min(100, (self.uploads_used_bytes / self.upload_limit_bytes) * 100)
    
    @property
    def download_usage_percentage(self):
        """Calculate download usage percentage"""
        if self.download_limit_bytes == 0:
            return 0
        return min(100, (self.downloads_used_bytes / self.download_limit_bytes) * 100)
    
    @property
    def storage_usage_percentage(self):
        """Calculate storage usage percentage"""
        if self.storage_limit_bytes == 0:
            return 0
        return min(100, (self.current_storage_bytes / self.storage_limit_bytes) * 100)
    
    @property
    def is_upload_limit_exceeded(self):
        """Check if upload limit is exceeded"""
        return self.uploads_used_bytes >= self.upload_limit_bytes
    
    @property
    def is_download_limit_exceeded(self):
        """Check if download limit is exceeded"""
        return self.downloads_used_bytes >= self.download_limit_bytes
    
    @property
    def is_storage_limit_exceeded(self):
        """Check if storage limit is exceeded"""
        return self.current_storage_bytes >= self.storage_limit_bytes
