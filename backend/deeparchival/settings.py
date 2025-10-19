import os
from pathlib import Path
from dotenv import load_dotenv
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

# Load environment variables from .env file
load_dotenv()

# Initialize Sentry
sentry_sdk.init(
    dsn="https://110d09152b148181a66fe8695869ea6f@o4510179546693632.ingest.us.sentry.io/4510179548856320",
    integrations=[
        DjangoIntegration(
            transaction_style='url',
            middleware_spans=True,
            signals_spans=True,
            cache_spans=True,
        ),
        LoggingIntegration(
            level=None,  # Capture all logs
            event_level=None,  # Send all logs as events
        ),
    ],
    # Performance Monitoring
    traces_sample_rate=0.1,  # Capture 10% of transactions for performance monitoring
    # Set sample rate for profiling - this is relative to traces_sample_rate
    profiles_sample_rate=0.1,
    # Send default PII (Personally Identifiable Information)
    send_default_pii=True,
    # Environment
    environment=os.getenv('ENVIRONMENT', 'production'),
    # Release tracking
    release=os.getenv('RELEASE_VERSION', '1.0.0'),
    # Additional options
    attach_stacktrace=True,
    max_breadcrumbs=50,
)

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

# Encryption key for sensitive data - MANDATORY
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    # Generate a new key if not provided (for development only)
    from cryptography.fernet import Fernet
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"⚠️  Generated new ENCRYPTION_KEY for development: {ENCRYPTION_KEY}")
    print("⚠️  Please set ENCRYPTION_KEY environment variable in production!")
    print("⚠️  Example: export ENCRYPTION_KEY='your-secure-key-here'")

# Validate encryption key format - MANDATORY
try:
    from cryptography.fernet import Fernet
    Fernet(ENCRYPTION_KEY.encode())  # Test if key is valid
    print("✅ Encryption key validated successfully")
except Exception as e:
    raise ValueError(f"Invalid ENCRYPTION_KEY format: {str(e)}")

DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'storages',
    'deeparchival',
    'api',
    'uppy_upload',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'api.security_middleware.SecurityHeadersMiddleware',  # Security headers
    'api.security_middleware.XSSProtectionMiddleware',  # XSS protection
    'api.security_middleware.InputValidationMiddleware',  # Input validation
    'api.security_middleware.SecurityLoggingMiddleware',  # Security logging
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'api.security_middleware.RateLimitMiddleware',  # Enhanced rate limiting
    'api.middleware.FileSizeLimitMiddleware',  # File size limits
    'api.middleware.UploadValidationMiddleware',  # Upload validation
    'api.middleware.HibernationPlanMiddleware',  # Hibernation plan enforcement
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'deeparchival.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'deeparchival.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'glacierarchival'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# CORS Configuration - Security Hardened
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
# Celery Configuration
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_ACKS_LATE = True

# Celery Beat schedule
# from celery.schedules import crontab
# CELERY_BEAT_SCHEDULE = {
#     'sync-restore-status-every-15-min': {
#         'task': 'api.sync_restore_status',
#         'schedule': crontab(minute='*/15'),
#     },
#     'snapshot-storage-costs-nightly': {
#         'task': 'api.snapshot_storage_costs',
#         'schedule': crontab(hour=2, minute=0),
#     },
# }

# Razorpay Configuration
import os
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

if ENVIRONMENT == 'production':
    RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
    RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')
else:
    # Development/test mode
    RAZORPAY_KEY_ID = os.getenv('RAZORPAY_TEST_KEY_ID', 'rzp_test_1234567890')
    RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_TEST_KEY_SECRET', 'test_secret_key')

# Validate required settings
if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise ValueError("Razorpay credentials not configured properly")

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'api.cookie_auth.CookieJWTAuthentication',  # Custom cookie-based JWT auth
        'rest_framework_simplejwt.authentication.JWTAuthentication',  # Fallback to header-based
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'upload': '500/hour',  # Upload-specific rate limiting
        'auth': '20/hour'      # Authentication rate limiting
    }
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,

    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JWK_URL': None,
    'LEEWAY': 0,

    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',

    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',

    'JTI_CLAIM': 'jti',

    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}

# Secure Cookie Settings
COOKIE_SECURE = not DEBUG  # Only secure cookies in production
COOKIE_HTTPONLY = True     # Always use httpOnly cookies
COOKIE_SAMESITE = 'Strict' # Strict SameSite policy
COOKIE_DOMAIN = None       # Set to your domain in production

# CSRF Settings for Cookie-based Authentication
CSRF_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_HTTPONLY = False  # CSRF token needs to be accessible to JavaScript
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173').split(',')

# AWS S3 Configuration
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
AWS_S3_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_S3_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_S3_REGION_NAME = os.getenv('AWS_REGION')
AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'

# Django-Storages Configuration
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = 'private'
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_ADDRESSING_STYLE = 'virtual'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration - Environment Variables
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'Glacier Archival Platform <noreply@glacierarchival.com>')

# Frontend URL for email verification links
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# File Upload Security Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
FILE_UPLOAD_PERMISSIONS = 0o644
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB max file size
MAX_FILES_PER_UPLOAD = 1000  # Max files per upload session
MAX_CONCURRENT_UPLOADS = 3  # Max concurrent uploads per user
MAX_SESSION_SIZE = 50 * 1024 * 1024 * 1024  # 50GB max session size
FREE_TIER_LIMIT = 15 * 1024 * 1024 * 1024  # 15GB free tier limit

# File Upload Settings
DATA_UPLOAD_MAX_NUMBER_FILES = 10000  # Allow up to 10,000 files in bulk upload
DATA_UPLOAD_MAX_NUMBER_FIELDS = 50000  # Allow up to 50,000 form fields (files + paths)
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB memory limit

# Media files configuration for local storage fallback
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024  # 100MB per file memory limit

# Enterprise Scaling Configuration (Optional - falls back to local memory cache)
try:
    import django_redis
    # Redis Configuration for caching and rate limiting
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': 'redis://127.0.0.1:6379/1',
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'CONNECTION_POOL_KWARGS': {
                    'max_connections': 100,
                    'retry_on_timeout': True,
                }
            }
        }
    }
    print("✅ Redis caching enabled")
except ImportError:
    # Fallback to local memory cache
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }
    print("⚠️  Redis not available, using local memory cache")

# Database connection pooling (only for PostgreSQL) - DISABLED for SQLite
# if 'postgresql' in DATABASES['default']['ENGINE']:
#     DATABASES['default'].update({
#         'CONN_MAX_AGE': 600,  # Keep connections alive for 10 minutes
#         'OPTIONS': {
#             'MAX_CONNS': 100,
#             'MIN_CONNS': 10,
#         }
#     })

# Rate limiting for enterprise scaling - DISABLED for development
REST_FRAMEWORK.update({
    'DEFAULT_THROTTLE_CLASSES': [
        # 'rest_framework.throttling.AnonRateThrottle',
        # 'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        # 'anon': '1000/hour',  # Anonymous users: 1000 requests per hour
        # 'user': '10000/hour',  # Authenticated users: 10000 requests per hour
        # 'presigned_url': '1000/hour',  # Presigned URL requests: 1000 per hour per user
    }
})
