from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MediaFileViewSet, ArchiveJobViewSet, S3ConfigViewSet, register_user

router = DefaultRouter()
router.register(r'media-files', MediaFileViewSet, basename='mediafile')
router.register(r'archive-jobs', ArchiveJobViewSet, basename='archivejob')
router.register(r's3-config', S3ConfigViewSet, basename='s3config')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', register_user, name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]