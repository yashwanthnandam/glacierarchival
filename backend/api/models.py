from django.db import models
from django.contrib.auth.models import User

class S3Config(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='s3_config')
    bucket_name = models.CharField(max_length=255)
    aws_access_key = models.CharField(max_length=255)
    aws_secret_key = models.CharField(max_length=255)
    region = models.CharField(max_length=50, default='us-east-1')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.bucket_name}"

class MediaFile(models.Model):
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('archiving', 'Archiving'),
        ('archived', 'Archived'),
        ('restoring', 'Restoring'),
        ('restored', 'Restored'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_files')
    filename = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255)
    file_size = models.BigIntegerField(help_text='File size in bytes')
    file_type = models.CharField(max_length=100)
    s3_key = models.CharField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='uploaded')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    archived_at = models.DateTimeField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} - {self.status}"

class ArchiveJob(models.Model):
    JOB_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    JOB_TYPE_CHOICES = [
        ('archive', 'Archive'),
        ('restore', 'Restore'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='archive_jobs')
    media_file = models.ForeignKey(MediaFile, on_delete=models.CASCADE, related_name='jobs')
    job_type = models.CharField(max_length=20, choices=JOB_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=JOB_STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    progress = models.IntegerField(default=0, help_text='Progress percentage')

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.job_type} - {self.media_file.filename} - {self.status}"