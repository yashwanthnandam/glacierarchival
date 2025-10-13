from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    MediaFileViewSet, 
    ArchiveJobViewSet, 
    S3ConfigViewSet, 
    HibernationPlanViewSet,
    UserHibernationPlanViewSet,
    PaymentViewSet,
    register_user, 
    verify_email, 
    resend_verification, 
    get_user,
    request_password_reset,
    reset_password
)
from .test_sentry import test_sentry
from .secure_auth import (
    secure_login,
    secure_refresh,
    secure_logout,
    secure_user_info,
    secure_register
)

router = DefaultRouter()
router.register(r'media-files', MediaFileViewSet, basename='mediafile')
router.register(r'archive-jobs', ArchiveJobViewSet, basename='archivejob')
router.register(r's3-config', S3ConfigViewSet, basename='s3config')
router.register(r'hibernation-plans', HibernationPlanViewSet, basename='hibernationplan')
router.register(r'user-hibernation-plans', UserHibernationPlanViewSet, basename='userhibernationplan')
router.register(r'payments', PaymentViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
    
    # Legacy authentication endpoints (for backward compatibility)
    path('auth/register/', register_user, name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/user/', get_user, name='get_user'),
    path('auth/verify-email/', verify_email, name='verify_email'),
    path('auth/resend-verification/', resend_verification, name='resend_verification'),
    path('auth/request-password-reset/', request_password_reset, name='request_password_reset'),
    path('auth/reset-password/', reset_password, name='reset_password'),
    
    # Secure cookie-based authentication endpoints
    path('auth/secure/login/', secure_login, name='secure_login'),
    path('auth/secure/refresh/', secure_refresh, name='secure_refresh'),
    path('auth/secure/logout/', secure_logout, name='secure_logout'),
    path('auth/secure/user/', secure_user_info, name='secure_user_info'),
    path('auth/secure/register/', secure_register, name='secure_register'),
    
    # Test endpoints
    path('test/sentry/', test_sentry, name='test_sentry'),
]