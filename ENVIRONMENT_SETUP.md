# Environment Configuration Template
# Copy this file to .env and fill in your actual values

# Django Settings
SECRET_KEY=your-super-secret-key-here-change-this-in-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# CORS Settings
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://yourdomain.com

# Database (if using PostgreSQL in production)
# DATABASE_URL=postgresql://user:password@localhost:5432/glacierarchival

# AWS S3 Configuration
AWS_STORAGE_BUCKET_NAME=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=Glacier Archival Platform <noreply@yourdomain.com>

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Redis (for Celery)
REDIS_URL=redis://localhost:6379/0
