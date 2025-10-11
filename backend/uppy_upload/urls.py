from django.urls import path
from . import views

urlpatterns = [
    # S3 Upload endpoints
    path('presigned-url/', views.S3UploadView.as_view(), name='s3_presigned_url'),
    path('upload-complete/', views.S3UploadCompleteView.as_view(), name='s3_upload_complete'),
    path('create-session/', views.create_upload_session, name='create_upload_session'),
    path('upload-progress/', views.get_upload_progress, name='get_upload_progress'),
    path('files/', views.list_uploaded_files, name='list_uploaded_files'),
]
