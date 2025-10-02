from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth.models import User
from django.utils import timezone
import boto3
from botocore.exceptions import ClientError
import uuid

from .models import MediaFile, ArchiveJob, S3Config
from .serializers import MediaFileSerializer, ArchiveJobSerializer, UserSerializer, S3ConfigSerializer

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class S3ConfigViewSet(viewsets.ModelViewSet):
    serializer_class = S3ConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return S3Config.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class MediaFileViewSet(viewsets.ModelViewSet):
    serializer_class = MediaFileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        return MediaFile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        media_file = MediaFile.objects.create(user=request.user, filename=f"{uuid.uuid4()}_{file.name}", original_filename=file.name, file_size=file.size, file_type=file.content_type, status='uploaded')
        return Response(MediaFileSerializer(media_file).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        media_file = self.get_object()
        try:
            s3_config = S3Config.objects.get(user=request.user)
        except S3Config.DoesNotExist:
            return Response({'error': 'S3 configuration required'}, status=status.HTTP_400_BAD_REQUEST)
        job = ArchiveJob.objects.create(user=request.user, media_file=media_file, job_type='archive', status='in_progress')
        try:
            s3_key = f"archives/{request.user.username}/{media_file.filename}"
            media_file.s3_key = s3_key
            media_file.status = 'archived'
            media_file.archived_at = timezone.now()
            media_file.save()
            job.status = 'completed'
            job.progress = 100
            job.completed_at = timezone.now()
            job.save()
            return Response({'message': 'File archived successfully', 'job_id': job.id})
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        media_file = self.get_object()
        if media_file.status != 'archived':
            return Response({'error': 'File is not archived'}, status=status.HTTP_400_BAD_REQUEST)
        job = ArchiveJob.objects.create(user=request.user, media_file=media_file, job_type='restore', status='in_progress')
        media_file.status = 'restoring'
        media_file.save()
        return Response({'message': 'Restore initiated', 'job_id': job.id})

class ArchiveJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ArchiveJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ArchiveJob.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        jobs = self.get_queryset()
        return Response({'total_jobs': jobs.count(), 'pending': jobs.filter(status='pending').count(), 'in_progress': jobs.filter(status='in_progress').count(), 'completed': jobs.filter(status='completed').count(), 'failed': jobs.filter(status='failed').count()})