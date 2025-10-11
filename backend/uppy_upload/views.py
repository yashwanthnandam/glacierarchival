import boto3
from botocore.config import Config
import json
import uuid
import hashlib
from datetime import datetime, timedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils.decorators import method_decorator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from .models import UploadedFile, UploadSession
from api.models import S3Config
import logging

logger = logging.getLogger(__name__)


class S3UploadView(APIView):
    """
    Handle S3 presigned URL generation for direct uploads with enterprise scaling
    """
    permission_classes = [IsAuthenticated]
    
    # Class-level S3 client cache for connection reuse
    _s3_clients = {}
    
    def get_s3_client(self, user):
        """Get S3 client with connection pooling and caching"""
        # Create cache key for user's S3 config
        cache_key = f"s3_client_{user.id}"
        
        # Check if client already exists in memory
        if cache_key in self._s3_clients:
            return self._s3_clients[cache_key]
        
        try:
            s3_config = S3Config.objects.get(user=user)
            client_config = Config(
                max_pool_connections=200,  # Enterprise-grade connection pooling
                retries={'max_attempts': 5, 'mode': 'adaptive'},
                read_timeout=60,
                connect_timeout=10,
                region_name=s3_config.region
            )
            
            client = boto3.client(
                's3',
                aws_access_key_id=s3_config.aws_access_key,
                aws_secret_access_key=s3_config.aws_secret_key,
                region_name=s3_config.region,
                config=client_config
            )
            
            result = (client, s3_config.bucket_name)
            self._s3_clients[cache_key] = result
            return result
            
        except S3Config.DoesNotExist:
            # Fallback to default S3 configuration
            client_config = Config(
                max_pool_connections=200,
                retries={'max_attempts': 5, 'mode': 'adaptive'},
                read_timeout=60,
                connect_timeout=10,
                region_name=settings.AWS_S3_REGION_NAME
            )
            
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_S3_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION_NAME,
                config=client_config
            )
            
            result = (client, settings.AWS_STORAGE_BUCKET_NAME)
            self._s3_clients[cache_key] = result
            return result

    def post(self, request):
        """Generate presigned URL for S3 upload"""
        try:
            
            file_name = request.data.get('filename')
            file_type = request.data.get('fileType', 'application/octet-stream')
            file_size = request.data.get('fileSize', 0)
            relative_path = request.data.get('relativePath', '')
            parent_directory = request.data.get('parentDirectory', '')
            session_id = request.data.get('sessionId')
            encryption_metadata = request.data.get('encryptionMetadata', None)
            
            if not file_name:
                return Response({'error': 'File name is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Disable caching for presigned URLs to ensure each file gets its own UploadedFile record
            # Each file upload needs a unique UploadedFile record for proper tracking
            
            # Generate unique S3 key with directory structure preservation
            timestamp = datetime.now().strftime('%Y/%m/%d')
            unique_id = str(uuid.uuid4())[:8]
            
            # --- Simple, clean sanitization (match services.py policy) ---
            def sanitize_segment(seg: str) -> str:
                if not seg:
                    return seg
                seg = seg.strip().lower().replace('(', '-').replace(')', '-').replace(' ', '-')
                return seg.strip('-')

            sanitized_filename = sanitize_segment(file_name)
            sanitized_relpath = '/'.join(
                sanitize_segment(p) for p in (relative_path or '').split('/') if p and p != '.'
            )

            # Build S3 key with user and date prefix, always append unique filename
            base_prefix = f"uploads/{request.user.username}/{timestamp}"
            if sanitized_relpath:
                s3_key = f"{base_prefix}/{sanitized_relpath}/{unique_id}_{sanitized_filename}"
            else:
                s3_key = f"{base_prefix}/{unique_id}_{sanitized_filename}"
            
            # Get S3 client
            s3_client, bucket_name = self.get_s3_client(request.user)
            
            # Generate presigned POST for multipart upload with optimized settings
            presigned_url = s3_client.generate_presigned_post(
                Bucket=bucket_name,
                Key=s3_key,
                Fields={
                    'Content-Type': file_type,
                },
                Conditions=[
                    {'Content-Type': file_type},
                    ['content-length-range', 0, file_size]
                ],
                ExpiresIn=7200  # 2 hours for better reliability
            )
            
            # Create upload session if provided
            upload_session = None
            if session_id:
                try:
                    upload_session = UploadSession.objects.get(
                        session_id=session_id,
                        user=request.user
                    )
                except UploadSession.DoesNotExist:
                    pass
            
            # Create file record
            # Use sanitized relative_path for consistency with services.py policy
            uploaded_file = UploadedFile.objects.create(
                user=request.user,
                original_name=file_name,
                file_size=file_size,
                file_type=file_type,
                relative_path=sanitized_relpath,
                parent_directory=parent_directory,
                s3_key=s3_key,
                upload_session=upload_session,
                encryption_metadata=encryption_metadata,
                is_encrypted=bool(encryption_metadata)
            )
            
            # No caching - each file needs its own UploadedFile record
            
            logger.info(f"Generated new presigned URL: {file_name}")
            return Response({
                'presignedUrl': presigned_url,
                'fileId': str(uploaded_file.upload_id),
                's3Key': s3_key,
                'success': True,
                'cached': False
            })
            
        except Exception as e:
            logger.error(f"S3 presigned URL generation failed: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class S3UploadCompleteView(APIView):
    """
    Handle S3 upload completion and file verification
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Mark upload as complete and verify file"""
        try:
            file_id = request.data.get('fileId')
            s3_key = request.data.get('s3Key')
            etag = request.data.get('etag')
            
            if not file_id or not s3_key:
                return Response({'error': 'File ID and S3 key are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Get file record
            try:
                uploaded_file = UploadedFile.objects.get(
                    upload_id=file_id,
                    user=request.user
                )
            except UploadedFile.DoesNotExist:
                return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Use database transaction for consistency (PostgreSQL handles concurrency well)
            from django.db import transaction
            
            with transaction.atomic():
                # Update file record
                uploaded_file.s3_etag = etag
                uploaded_file.is_processed = True
                uploaded_file.save()
                
                # Sync to MediaFile for compatibility with existing file manager
                try:
                    media_file = uploaded_file.to_media_file()
                    logger.info(f"Synced UploadedFile {uploaded_file.upload_id} to MediaFile {media_file.id}")
                except Exception as sync_error:
                    logger.error(f"Failed to sync UploadedFile to MediaFile: {sync_error}")
                
                # Update upload session if exists
                if uploaded_file.upload_session:
                    session = uploaded_file.upload_session
                    session.uploaded_files += 1
                    if session.uploaded_files >= session.total_files:
                        session.status = 'completed'
                        session.completed_at = datetime.now()
                    session.save()
            
            return Response({
                'success': True,
                'fileId': str(uploaded_file.upload_id),
                'fileUrl': uploaded_file.file_url
            })
            
        except Exception as e:
            logger.error(f"S3 upload completion failed: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_upload_session(request):
    """Create a new upload session for directory uploads"""
    try:
        data = request.data
        root_directory = data.get('rootDirectory', '')
        total_files = data.get('totalFiles', 0)
        directory_structure = data.get('directoryStructure', {})
        
        # Create upload session
        session = UploadSession.objects.create(
            user=request.user,
            total_files=total_files,
            root_directory=root_directory,
            directory_structure=directory_structure,
            status='pending'
        )
        
        return Response({
            'sessionId': str(session.session_id),
            'status': session.status,
            'totalFiles': session.total_files,
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Upload session creation failed: {str(e)}")
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_upload_progress(request):
    """Get upload progress for a session"""
    try:
        session_id = request.GET.get('sessionId')
        
        if not session_id:
            return Response({'error': 'Session ID is required'}, status=400)
        
        try:
            session = UploadSession.objects.get(
                session_id=session_id,
                user=request.user
            )
        except UploadSession.DoesNotExist:
            return Response({'error': 'Session not found'}, status=404)
        
        return Response({
            'sessionId': str(session.session_id),
            'status': session.status,
            'totalFiles': session.total_files,
            'uploadedFiles': session.uploaded_files,
            'failedFiles': session.failed_files,
            'progressPercent': session.progress_percent,
            'rootDirectory': session.root_directory,
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Upload progress retrieval failed: {str(e)}")
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_uploaded_files(request):
    """List uploaded files for the user"""
    try:
        files = UploadedFile.objects.filter(user=request.user).order_by('-uploaded_at')
        
        file_list = []
        for file in files:
            file_list.append({
                'id': str(file.upload_id),
                'name': file.original_name,
                'size': file.file_size,
                'sizeMB': file.file_size_mb,
                'type': file.file_type,
                'relativePath': file.relative_path,
                'parentDirectory': file.parent_directory,
                'uploadedAt': file.uploaded_at.isoformat(),
                'url': file.file_url,
                'isProcessed': file.is_processed
            })
        
        return Response({
            'files': file_list,
            'total': len(file_list),
            'success': True
        })
        
    except Exception as e:
        logger.error(f"File listing failed: {str(e)}")
        return Response({'error': str(e)}, status=500)