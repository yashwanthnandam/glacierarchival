"""
Archive and storage configuration views.

This module contains ViewSets for managing:
- File batch jobs (FileBatchJobViewSet) - unified progress tracking
- Archive jobs (ArchiveJobViewSet)
- S3 configuration (S3ConfigViewSet)
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import ArchiveJob, S3Config, FileBatchJob
from ..serializers import ArchiveJobSerializer, S3ConfigSerializer, FileBatchJobSerializer


class FileBatchJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for unified file batch job tracking.
    Provides simple polling-based progress for upload/delete/archive/restore operations.
    """
    serializer_class = FileBatchJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FileBatchJob.objects.filter(user=self.request.user)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get batch job status (for polling)."""
        try:
            batch = self.get_object()
            serializer = self.get_serializer(batch)
            return Response(serializer.data)
        except FileBatchJob.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def create_batch(self, request):
        """Create a new batch job."""
        try:
            operation = request.data.get('operation')
            total_files = request.data.get('total_files', 0)
            total_size_bytes = request.data.get('total_size_bytes', 0)
            
            if not operation:
                return Response({'error': 'Operation type required'}, status=status.HTTP_400_BAD_REQUEST)
            
            batch = FileBatchJob.objects.create(
                user=request.user,
                operation=operation,
                status='pending',
                total_files=total_files,
                total_size_bytes=total_size_bytes
            )
            
            serializer = self.get_serializer(batch)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        """
        Incrementally update batch progress.
        Primarily used by the upload worker to report succeeded/failed counts.
        """
        from django.db.models import F
        from django.utils import timezone

        try:
            batch = self.get_object()
            # Defensive parsing in case frontend sends strings
            succeeded = int(request.data.get('succeeded', 0) or 0)
            failed = int(request.data.get('failed', 0) or 0)
            succeeded = max(0, succeeded)
            failed = max(0, failed)
            total_inc = succeeded + failed

            if total_inc <= 0:
                serializer = self.get_serializer(batch)
                return Response(serializer.data)

            # Atomic increment of counters
            FileBatchJob.objects.filter(id=batch.id).update(
                succeeded_files=F('succeeded_files') + succeeded,
                failed_files=F('failed_files') + failed,
                processed_files=F('processed_files') + total_inc,
            )

            batch.refresh_from_db()

            # Auto-complete when processed >= total_files
            if batch.total_files and batch.processed_files >= batch.total_files and batch.status in ['pending', 'in_progress']:
                batch.status = 'completed'
                batch.completed_at = timezone.now()
                batch.save(update_fields=['status', 'completed_at'])

            serializer = self.get_serializer(batch)
            return Response(serializer.data)
        except FileBatchJob.DoesNotExist:
            return Response({'error': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active batches for user."""
        active_batches = self.get_queryset().filter(status__in=['pending', 'in_progress'])
        serializer = self.get_serializer(active_batches, many=True)
        return Response({'batches': serializer.data})


class ArchiveJobViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing archive jobs (read-only)"""
    serializer_class = ArchiveJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ArchiveJob.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get archive job statistics"""
        try:
            jobs = self.get_queryset()
            return Response({
                'total_jobs': jobs.count(), 
                'pending': jobs.filter(status='pending').count(), 
                'in_progress': jobs.filter(status='in_progress').count(), 
                'completed': jobs.filter(status='completed').count(), 
                'failed': jobs.filter(status='failed').count()
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class S3ConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for managing S3 configuration"""
    serializer_class = S3ConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return S3Config.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
