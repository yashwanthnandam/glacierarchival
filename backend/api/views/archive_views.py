"""
Archive and storage configuration views.

This module contains ViewSets for managing:
- Archive jobs (ArchiveJobViewSet)
- S3 configuration (S3ConfigViewSet)
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import ArchiveJob, S3Config
from ..serializers import ArchiveJobSerializer, S3ConfigSerializer


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
