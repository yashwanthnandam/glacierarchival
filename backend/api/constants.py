"""
Constants and configuration for the API
"""

# File upload limits
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_TOTAL_SIZE = 1024 * 1024 * 1024  # 1GB
MAX_FILES_PER_UPLOAD = 1000

# S3 configuration
S3_CHUNK_SIZE = 5 * 1024 * 1024  # 5MB chunks for multipart upload
S3_MULTIPART_THRESHOLD = 10 * 1024 * 1024  # 10MB threshold for multipart

# Media file status choices
MEDIA_FILE_STATUS_CHOICES = [
    ('uploaded', 'Uploaded'),
    ('archiving', 'Archiving'),
    ('archived', 'Archived'),
    ('restoring', 'Restoring'),
    ('restored', 'Restored'),
    ('failed', 'Failed'),
]

# Archive job type choices
ARCHIVE_JOB_TYPE_CHOICES = [
    ('archive', 'Archive'),
    ('restore', 'Restore'),
]

# Email verification
import os
EMAIL_VERIFICATION_EXPIRY_HOURS = int(os.getenv('EMAIL_VERIFICATION_EXPIRY_HOURS', '168'))  # Default 7 days

# Download URL expiry
DOWNLOAD_URL_EXPIRY_SECONDS = 3600  # 1 hour

# AWS Glacier configuration
GLACIER_VAULT_NAME = 'glacier-archival-vault'
GLACIER_RESTORE_TIERS = ['Expedited', 'Standard', 'Bulk']

# Restore time estimates (in hours)
RESTORE_TIME_ESTIMATES = {
    'Expedited': 0.1,  # 6 minutes
    'Standard': 4,     # 4 hours
    'Bulk': 8,         # 8 hours
}
