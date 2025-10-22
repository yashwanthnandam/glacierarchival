"""
Subscription views for hibernation plans and user subscriptions.

This module contains ViewSets for managing:
- Hibernation plans (HibernationPlanViewSet)
- User hibernation plan subscriptions (UserHibernationPlanViewSet)
"""
from datetime import timedelta
from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import HibernationPlan, UserHibernationPlan, MediaFile, ArchiveJob
from ..serializers import HibernationPlanSerializer, UserHibernationPlanSerializer


class HibernationPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing hibernation plans (read-only)"""
    serializer_class = HibernationPlanSerializer
    permission_classes = [permissions.AllowAny]  # Allow public access to view plans

    def get_queryset(self):
        return HibernationPlan.objects.filter(is_active=True)

    @action(detail=False, methods=['get'])
    def grouped_by_tier(self, request):
        """Get plans grouped by plan name (tier type)"""
        try:
            plans = self.get_queryset()
            
            # Group plans by plan name (deep_freeze, flexible_archive, instant_archive)
            grouped_plans = {}
            for plan in plans:
                tier_name = plan.name
                if tier_name not in grouped_plans:
                    grouped_plans[tier_name] = []
                grouped_plans[tier_name].append(HibernationPlanSerializer(plan).data)
            
            # Add Razorpay key for frontend
            response_data = {
                'plans': grouped_plans,
                'razorpay_key_id': settings.RAZORPAY_KEY_ID
            }
            
            return Response(response_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserHibernationPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user hibernation plan subscriptions"""
    serializer_class = UserHibernationPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserHibernationPlan.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def current_plan(self, request):
        """Get user's current hibernation plan"""
        try:
            user_plan = UserHibernationPlan.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if not user_plan:
                # Return free tier usage stats instead of 404
                total_storage_bytes = MediaFile.objects.filter(
                    user=request.user, 
                    is_deleted=False
                ).aggregate(total=Sum('file_size'))['total'] or 0
                
                free_tier_limit_bytes = 15 * 1024 * 1024 * 1024  # 15GB
                free_tier_used_gb = total_storage_bytes / (1024**3)
                free_tier_limit_gb = free_tier_limit_bytes / (1024**3)
                free_tier_used_percentage = (total_storage_bytes / free_tier_limit_bytes) * 100
                remaining_bytes = max(0, free_tier_limit_bytes - total_storage_bytes)
                remaining_gb = remaining_bytes / (1024**3)
                
                return Response({
                    'is_free_tier': True,
                    'storage_used_bytes': total_storage_bytes,
                    'storage_used_gb': round(free_tier_used_gb, 2),
                    'storage_limit_bytes': free_tier_limit_bytes,
                    'storage_limit_gb': free_tier_limit_gb,
                    'storage_used_percentage': round(free_tier_used_percentage, 1),
                    'remaining_bytes': remaining_bytes,
                    'remaining_gb': round(remaining_gb, 2),
                    'retrieval_used_gb': 0,
                    'retrieval_remaining_gb': 0,
                    'retrieval_limit_gb': 0,
                    'plan_expires_at': None,
                    'is_expired': False
                })
            
            serializer = UserHibernationPlanSerializer(user_plan)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def storage_usage(self, request):
        """Get detailed storage usage information"""
        try:
            user_plan = UserHibernationPlan.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if not user_plan:
                # Free tier usage
                total_storage_bytes = MediaFile.objects.filter(
                    user=request.user, 
                    is_deleted=False
                ).aggregate(total=Sum('file_size'))['total'] or 0
                
                free_tier_limit_bytes = 15 * 1024 * 1024 * 1024  # 15GB
                remaining_bytes = max(0, free_tier_limit_bytes - total_storage_bytes)
                
                return Response({
                    'plan_type': 'free_tier',
                    'current_usage_bytes': total_storage_bytes,
                    'current_usage_gb': round(total_storage_bytes / (1024**3), 2),
                    'limit_bytes': free_tier_limit_bytes,
                    'limit_gb': 15,
                    'remaining_bytes': remaining_bytes,
                    'remaining_gb': round(remaining_bytes / (1024**3), 2),
                    'usage_percentage': round((total_storage_bytes / free_tier_limit_bytes) * 100, 1),
                    'can_upload': remaining_bytes > 0,
                    'upgrade_required': total_storage_bytes >= free_tier_limit_bytes
                })
            else:
                # Paid plan usage
                current_usage = user_plan.storage_used_bytes
                plan_limit = user_plan.plan.storage_size_bytes
                remaining_bytes = max(0, plan_limit - current_usage)
                
                return Response({
                    'plan_type': 'paid_plan',
                    'plan_name': user_plan.plan.name,
                    'current_usage_bytes': current_usage,
                    'current_usage_gb': round(current_usage / (1024**3), 2),
                    'limit_bytes': plan_limit,
                    'limit_gb': round(plan_limit / (1024**3), 0),
                    'remaining_bytes': remaining_bytes,
                    'remaining_gb': round(remaining_bytes / (1024**3), 2),
                    'usage_percentage': round((current_usage / plan_limit) * 100, 1),
                    'can_upload': remaining_bytes > 0,
                    'upgrade_required': current_usage >= plan_limit
                })
                
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def usage_stats(self, request):
        """Get user's usage statistics"""
        try:
            # Get user's current plan or free tier stats
            user_plan = UserHibernationPlan.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if not user_plan:
                # Return free tier usage stats
                total_storage_bytes = MediaFile.objects.filter(
                    user=request.user, 
                    is_deleted=False
                ).aggregate(total=Sum('file_size'))['total'] or 0
                
                free_tier_limit_bytes = 15 * 1024 * 1024 * 1024  # 15GB
                free_tier_used_gb = total_storage_bytes / (1024**3)
                free_tier_limit_gb = free_tier_limit_bytes / (1024**3)
                free_tier_used_percentage = (total_storage_bytes / free_tier_limit_bytes) * 100
                
                return Response({
                    'is_free_tier': True,
                    'storage_used_bytes': total_storage_bytes,
                    'storage_used_gb': round(free_tier_used_gb, 2),
                    'storage_limit_bytes': free_tier_limit_bytes,
                    'storage_limit_gb': free_tier_limit_gb,
                    'storage_used_percentage': round(free_tier_used_percentage, 1),
                    'retrieval_used_gb': 0,
                    'retrieval_remaining_gb': 0,
                    'retrieval_limit_gb': 0,
                    'plan_expires_at': None,
                    'is_expired': False
                })
            
            # Calculate usage stats for paid plan
            total_storage_bytes = MediaFile.objects.filter(
                user=request.user, 
                is_deleted=False
            ).aggregate(total=Sum('file_size'))['total'] or 0
            
            # Get retrieval usage from archive jobs
            retrieval_bytes = ArchiveJob.objects.filter(
                user=request.user,
                status='completed',
                job_type='restore'
            ).aggregate(total=Sum('file_size'))['total'] or 0
            
            storage_used_gb = total_storage_bytes / (1024**3)
            retrieval_used_gb = retrieval_bytes / (1024**3)
            
            return Response({
                'is_free_tier': False,
                'storage_used_bytes': total_storage_bytes,
                'storage_used_gb': round(storage_used_gb, 2),
                'storage_limit_bytes': user_plan.plan.storage_limit_bytes,
                'storage_limit_gb': user_plan.plan.storage_limit_gb,
                'storage_used_percentage': round((total_storage_bytes / user_plan.plan.storage_limit_bytes) * 100, 1),
                'retrieval_used_gb': round(retrieval_used_gb, 2),
                'retrieval_remaining_gb': round(user_plan.plan.retrieval_limit_gb - retrieval_used_gb, 2),
                'retrieval_limit_gb': user_plan.plan.retrieval_limit_gb,
                'plan_expires_at': user_plan.expires_at,
                'is_expired': user_plan.is_expired
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def subscribe(self, request):
        """Subscribe to a hibernation plan"""
        try:
            plan_id = request.data.get('plan_id')
            if not plan_id:
                return Response({'error': 'plan_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if user already has an active plan
            existing_plan = UserHibernationPlan.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if existing_plan:
                return Response({
                    'error': 'User already has an active plan',
                    'current_plan': UserHibernationPlanSerializer(existing_plan).data
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the plan
            try:
                plan = HibernationPlan.objects.get(id=plan_id, is_active=True)
            except HibernationPlan.DoesNotExist:
                return Response({'error': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Create user hibernation plan
            from datetime import timedelta
            expires_at = timezone.now() + timedelta(days=365)
            
            user_plan = UserHibernationPlan.objects.create(
                user=request.user,
                plan=plan,
                expires_at=expires_at,
                is_active=True
            )
            
            serializer = UserHibernationPlanSerializer(user_plan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
