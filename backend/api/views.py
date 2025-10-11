from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import json
import time
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.crypto import get_random_string
from datetime import timedelta
import boto3
from botocore.exceptions import ClientError
import uuid
import os
from django.core.cache import cache
from django.db.models import Q, Count, Sum
from django.core.paginator import Paginator
from django.db import transaction

from .models import MediaFile, ArchiveJob, S3Config, EmailVerification, HibernationPlan, UserHibernationPlan, Payment
from .serializers import MediaFileSerializer, ArchiveJobSerializer, UserSerializer, S3ConfigSerializer, HibernationPlanSerializer, UserHibernationPlanSerializer, PaymentSerializer, CreatePaymentSerializer, VerifyPaymentSerializer
from .payment_service import PaymentService
from .services import MediaFileService, EmailService, S3Service
from .utils import validate_file_size, calculate_file_checksum, sanitize_filename
from .error_handling import handle_api_error, validate_required_fields, validate_file_upload, create_success_response, create_error_response
from .constants import EMAIL_VERIFICATION_EXPIRY_HOURS

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        user.is_active = False  # User must verify email before activation
        user.save()
        
        # Create email verification
        verification = EmailVerification.objects.create(user=user)
        
        # Send verification email
        try:
            EmailService.send_verification_email(user, verification.token, request)
            return Response({
                'message': 'Registration successful. Please check your email to verify your account.',
                'user_id': user.id
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'error': 'Registration successful but failed to send verification email. Please contact support.'
            }, status=status.HTTP_201_CREATED)
    
    # Format validation errors for better frontend handling
    error_messages = []
    for field, errors in serializer.errors.items():
        for error in errors:
            if field == 'email' and 'already exists' in str(error):
                error_messages.append('A user with this email already exists. Please use a different email.')
            elif field == 'username' and 'already exists' in str(error):
                error_messages.append('A user with this username already exists. Please choose a different username.')
            elif field == 'password':
                error_messages.append(f'Password error: {str(error)}')
            else:
                error_messages.append(f'{field.title()}: {str(error)}')
    
    return Response({
        'error': '; '.join(error_messages) if error_messages else 'Invalid registration data.',
        'details': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_email(request):
    token = request.data.get('token')
    if not token:
        return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        verification = EmailVerification.objects.get(token=token)
        if verification.is_expired():
            return Response({'error': 'Verification token has expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        if verification.verified:
            return Response({'error': 'Email already verified'}, status=status.HTTP_400_BAD_REQUEST)
        
        verification.verified = True
        verification.user.is_active = True
        verification.user.save()
        verification.save()
        
        return Response({'message': 'Email verified successfully'}, status=status.HTTP_200_OK)
    except EmailVerification.DoesNotExist:
        return Response({'error': 'Invalid verification token'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def resend_verification(request):
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        if user.is_active:
            return Response({'error': 'Email already verified'}, status=status.HTTP_400_BAD_REQUEST)
        
        verification, created = EmailVerification.objects.get_or_create(user=user)
        if not created:
            # Generate new token and reset expiry
            verification.token = get_random_string(32)
            verification.verified = False
            verification.expires_at = timezone.now() + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
            verification.save()
        
        EmailService.send_verification_email(user, verification.token, request)
        return Response({
            'message': 'Verification email sent. The link will be valid for 7 days.'
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user(request):
    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'email': request.user.email,
        'is_active': request.user.is_active
    })


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
        return MediaFile.objects.filter(user=self.request.user, is_deleted=False)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def list_optimized(self, request):
        """Optimized file listing with caching and pagination"""
        user_id = request.user.id
        folder_path = request.query_params.get('folder', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        
        # Create cache key
        cache_key = f"files_{user_id}_{folder_path}_{page}_{page_size}"
        
        # Try to get from cache first
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result)
        
        # Build optimized query
        queryset = MediaFile.objects.filter(
            user_id=user_id, 
            is_deleted=False
        ).only(
            'id', 'original_filename', 'file_size', 'file_type', 
            'relative_path', 'status', 'uploaded_at', 's3_key'
        )
        
        # Filter by folder if specified
        if folder_path:
            if folder_path == 'root':
                # Root files (no relative_path or relative_path is empty)
                queryset = queryset.filter(Q(relative_path__isnull=True) | Q(relative_path=''))
            else:
                # Files in specific folder
                queryset = queryset.filter(relative_path__startswith=folder_path)
        
        # Order by upload date for consistency
        queryset = queryset.order_by('-uploaded_at')
        
        # Paginate
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize only necessary fields
        files_data = []
        for file in page_obj:
            files_data.append({
                'id': file.id,
                'original_filename': file.original_filename,
                'file_size': file.file_size,
                'file_type': file.file_type,
                'relative_path': file.relative_path or '',
                'status': file.status,
                'uploaded_at': file.uploaded_at.isoformat(),
                's3_key': file.s3_key
            })
        
        result = {
            'files': files_data,
            'pagination': {
                'current_page': page,
                'total_pages': paginator.num_pages,
                'total_files': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous()
            }
        }
        
        # Cache for 5 minutes
        cache.set(cache_key, result, 300)
        
        return Response(result)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def folder_structure(self, request):
        """Get folder structure without loading all files"""
        user_id = request.user.id
        cache_key = f"folder_structure_{user_id}"
        
        # Try cache first
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result)
        
        # Get folder structure efficiently
        # Only include files that have a directory path (contains '/') or are in root (empty path)
        folders = MediaFile.objects.filter(
            user_id=user_id, 
            is_deleted=False
        ).exclude(
            relative_path__isnull=True
        ).values('relative_path').annotate(
            file_count=Count('id'),
            total_size=Sum('file_size')
        )
        
        # Build folder tree
        folder_tree = {'root': {'files': 0, 'size': 0, 'subfolders': {}}}
        
        for folder in folders:
            path = folder['relative_path']
            if not path:
                folder_tree['root']['files'] += folder['file_count']
                folder_tree['root']['size'] += folder['total_size'] or 0
                continue
            
            # Skip single-level paths (filenames without directory structure)
            if '/' not in path:
                # These are files in root directory without proper directory structure
                # Add them to root count
                folder_tree['root']['files'] += folder['file_count']
                folder_tree['root']['size'] += folder['total_size'] or 0
                continue
            
            # Extract directory path by removing the filename (last part after the last '/')
            # This handles both old format (with filename) and new format (directory only)
            path_parts = path.split('/')
            last_part = path_parts[-1]
            if '.' in last_part and len(last_part.split('.')[-1]) <= 5:  # Likely a filename
                # Remove the filename, keep only directory path
                directory_path = '/'.join(path_parts[:-1])
            else:
                # Already a directory path
                directory_path = path
            
            # Split directory path into parts
            path_parts = directory_path.split('/')
            current = folder_tree['root']
            
            for i, part in enumerate(path_parts):
                if part not in current['subfolders']:
                    current['subfolders'][part] = {
                        'files': 0, 
                        'size': 0, 
                        'subfolders': {}
                    }
                
                current = current['subfolders'][part]
                
                # Add file count and size to this level
                if i == len(path_parts) - 1:  # Last part
                    current['files'] += folder['file_count']
                    current['size'] += folder['total_size'] or 0
        
        # Cache for 10 minutes
        cache.set(cache_key, folder_tree, 600)
        
        return Response(folder_tree)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        try:
            file = request.FILES.get('file')
            validate_file_upload(file)
            
            media_service = MediaFileService(request.user)
            relative_path = request.data.get('relative_path', '')
            root_directory = request.data.get('root_directory', '')
            
            # If root directory is provided and relative_path doesn't start with it, prepend it
            if root_directory and relative_path and not relative_path.startswith(root_directory):
                relative_path = f"{root_directory}/{relative_path}"
            elif root_directory and not relative_path:
                relative_path = root_directory
            
            media_file = media_service.create_media_file(file, relative_path)
            return Response(MediaFileSerializer(media_file).data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return handle_api_error(e)

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def archive(self, request, pk=None):
        media_file = self.get_object()
        
        try:
            media_service = MediaFileService(request.user)
            job = media_service.archive_file(media_file)
            return Response({
                'message': 'File archived successfully', 
                'job_id': job.id
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Archive failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def init_multipart_upload(self, request):
        """Initialize multipart upload and return upload ID"""
        try:
            filename = request.data.get('filename')
            content_type = request.data.get('content_type', 'application/octet-stream')
            relative_path = request.data.get('relative_path', '')
            encryption_metadata = request.data.get('encryption_metadata', None)
            
            if not filename:
                return Response({'error': 'Filename required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate unique filename and S3 key
            sanitized_name = sanitize_filename(filename)
            uuid_prefix = str(uuid.uuid4())
            unique_filename = f"{uuid_prefix}_{sanitized_name}"
            
            if relative_path:
                s3_key = f"uploads/{request.user.username}/{relative_path}"
            else:
                s3_key = f"uploads/{request.user.username}/{unique_filename}"
            
            # Create multipart upload
            s3_service = S3Service(request.user)
            upload_id = s3_service.create_multipart_upload(s3_key, content_type)
            
            return Response({
                'upload_id': upload_id,
                's3_key': s3_key,
                'unique_filename': unique_filename,
                'content_type': content_type,
                'encryption_metadata': encryption_metadata
            })
            
        except Exception as e:
            return Response({'error': f'Failed to initialize multipart upload: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def get_presigned_urls(self, request):
        """Get presigned URLs for uploading chunks"""
        try:
            upload_id = request.data.get('upload_id')
            s3_key = request.data.get('s3_key')
            chunk_count = request.data.get('chunk_count')
            
            if not all([upload_id, s3_key, chunk_count]):
                return Response({'error': 'upload_id, s3_key, and chunk_count required'}, 
                              status=status.HTTP_400_BAD_REQUEST)
            
            s3_service = S3Service(request.user)
            presigned_urls = []
            
            for part_number in range(1, chunk_count + 1):
                presigned_url = s3_service.generate_presigned_url_for_chunk(
                    s3_key, upload_id, part_number
                )
                presigned_urls.append({
                    'part_number': part_number,
                    'presigned_url': presigned_url
                })
            
            return Response({
                'presigned_urls': presigned_urls,
                'upload_id': upload_id,
                's3_key': s3_key
            })
            
        except Exception as e:
            return Response({'error': f'Failed to generate presigned URLs: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def complete_multipart_upload(self, request):
        """Complete multipart upload and create media file record"""
        try:
            upload_id = request.data.get('upload_id')
            s3_key = request.data.get('s3_key')
            unique_filename = request.data.get('unique_filename')
            parts = request.data.get('parts')  # List of {part_number, etag}
            file_size = request.data.get('file_size')
            content_type = request.data.get('content_type')
            relative_path = request.data.get('relative_path', '')
            encryption_metadata = request.data.get('encryption_metadata', None)
            
            if not all([upload_id, s3_key, unique_filename, parts]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Complete multipart upload
            s3_service = S3Service(request.user)
            s3_service.complete_multipart_upload(s3_key, upload_id, parts)
            
            # Calculate storage cost
            storage_cost = s3_service.calculate_storage_cost(file_size, 'standard')
            
            # Create media file record
            media_file = MediaFile.objects.create(
                user=request.user,
                filename=unique_filename,
                original_filename=sanitize_filename(unique_filename.split('_', 1)[1] if '_' in unique_filename else unique_filename),
                file_size=file_size,
                file_type=content_type,
                s3_key=s3_key,
                status='uploaded',
                checksum='',  # Will be calculated if needed
                relative_path=relative_path,
                encryption_metadata=encryption_metadata,
                is_encrypted=bool(encryption_metadata),
                storage_cost=storage_cost,
                last_accessed=timezone.now()
            )
            
            return Response(MediaFileSerializer(media_file).data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': f'Failed to complete multipart upload: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def abort_multipart_upload(self, request):
        """Abort multipart upload"""
        try:
            upload_id = request.data.get('upload_id')
            s3_key = request.data.get('s3_key')
            
            if not all([upload_id, s3_key]):
                return Response({'error': 'upload_id and s3_key required'}, status=status.HTTP_400_BAD_REQUEST)
            
            s3_service = S3Service(request.user)
            s3_service.abort_multipart_upload(s3_key, upload_id)
            
            return Response({'message': 'Multipart upload aborted successfully'})
            
        except Exception as e:
            return Response({'error': f'Failed to abort multipart upload: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def get_smart_tier_suggestion(self, request):
        """Get smart tier suggestion for file upload"""
        try:
            file_size = request.data.get('file_size')
            file_type = request.data.get('file_type', 'application/octet-stream')
            
            # Validate file_size - must be a positive number
            if not file_size or file_size <= 0:
                return Response({'error': 'file_size required and must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Ensure file_size is an integer
            try:
                file_size = int(file_size)
            except (ValueError, TypeError):
                return Response({'error': 'file_size must be a valid number'}, status=status.HTTP_400_BAD_REQUEST)
            
            s3_service = S3Service(request.user)
            suggestion = s3_service.get_smart_tier_suggestion(file_size, file_type)
            
            return Response(suggestion)
            
        except Exception as e:
            return Response({'error': f'Failed to get tier suggestion: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def get_storage_costs(self, request):
        """
        Get storage cost breakdown for user's files.
        Supports both USD and INR with optional GST calculation.
        
        Query Parameters:
        - currency: 'USD' or 'INR' (default: 'USD')
        - include_gst: 'true' or 'false' (default: 'false', only applies to INR)
        """
        try:
            # Get query parameters
            currency = request.query_params.get('currency', 'USD').upper()
            include_gst = request.query_params.get('include_gst', 'false').lower() == 'true'
            
            # Validate currency
            if currency not in ['USD', 'INR']:
                return Response({'error': 'Currency must be USD or INR'}, status=status.HTTP_400_BAD_REQUEST)
            
            files = MediaFile.objects.filter(user=request.user, is_deleted=False)
            
            # Handle empty file set
            if not files.exists():
                base_response = {
                    'total_monthly_cost': 0,
                    'currency': currency,
                    'cost_breakdown': {
                        'standard': 0,
                        'ia': 0,
                        'glacier': 0,
                        'deep_archive': 0
                    },
                    'file_count': 0,
                    'total_size_gb': 0
                }
                
                if currency == 'INR' and include_gst:
                    base_response.update({
                        'gst_amount': 0,
                        'total_with_gst': 0,
                        'gst_rate': 18.0
                    })
                
                return Response(base_response)
            
            total_cost = 0
            cost_breakdown = {
                'standard': 0,
                'ia': 0,
                'glacier': 0,
                'deep_archive': 0
            }
            
            s3_service = S3Service(request.user)
            
            for file in files:
                # Determine storage tier based on file status
                if file.status == 'uploaded':
                    tier = 'standard'
                elif file.status == 'archived':
                    tier = 'deep_archive'
                else:
                    tier = 'standard'
                
                monthly_cost = s3_service.calculate_storage_cost(file.file_size, tier, currency)
                cost_breakdown[tier] += monthly_cost
                total_cost += monthly_cost
            
            # Build response
            response_data = {
                'total_monthly_cost': round(total_cost, 4),
                'currency': currency,
                'cost_breakdown': cost_breakdown,
                'file_count': files.count(),
                'total_size_gb': round(sum(f.file_size for f in files) / (1024**3), 2)
            }
            
            # Add GST calculation for INR if requested
            if currency == 'INR' and include_gst:
                gst_rate = 18.0
                gst_amount = total_cost * (gst_rate / 100)
                total_with_gst = total_cost + gst_amount
                
                response_data.update({
                    'gst_amount': round(gst_amount, 4),
                    'total_with_gst': round(total_with_gst, 4),
                    'gst_rate': gst_rate
                })
            
            return Response(response_data)
            
        except Exception as e:
            return Response({'error': f'Failed to get storage costs: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def auto_hibernate_files(self, request):
        """
        Automatically hibernate files based on usage patterns.
        
        This feature identifies files that haven't been accessed for a specified period
        and moves them to cheaper storage tiers to save costs.
        
        Parameters:
        - days_threshold: Number of days since last access (default: 30)
        - min_size: Minimum file size in bytes to consider (default: 10MB)
        - dry_run: If true, only returns candidates without hibernating (default: false)
        """
        try:
            days_threshold = request.data.get('days_threshold', 30)
            min_size = request.data.get('min_size', 10485760)  # 10MB
            dry_run = request.data.get('dry_run', False)
            
            from django.utils import timezone
            from datetime import timedelta
            
            cutoff_date = timezone.now() - timedelta(days=days_threshold)
            
            # Find files eligible for hibernation
            candidates = MediaFile.objects.filter(
                user=request.user,
                status='uploaded',
                file_size__gte=min_size,
                last_accessed__lt=cutoff_date,
                is_deleted=False
            ).exclude(
                file_type__startswith='text/',  # Keep text files accessible
            )
            
            hibernated_files = []
            total_savings = 0
            
            s3_service = S3Service(request.user)
            
            if not dry_run and candidates.exists():
                # Bulk create hibernation jobs for better performance
                hibernation_jobs = []
                for file in candidates:
                    hibernation_jobs.append(ArchiveJob(
                        user=request.user,
                        media_file=file,
                        job_type='archive',
                        status='in_progress'
                    ))
                
                # Bulk create all jobs at once
                ArchiveJob.objects.bulk_create(hibernation_jobs)
                
                # Process hibernation in batches for better performance
                media_service = MediaFileService(request.user)
                batch_size = 50  # Process 50 files at a time
                
                for i in range(0, len(candidates), batch_size):
                    batch_files = candidates[i:i + batch_size]
                    for file in batch_files:
                        try:
                            media_service.archive_file(file)
                        except Exception as e:
                            print(f"Error hibernating file {file.id}: {e}")
            
            # Calculate savings for all files (optimized)
            for file in candidates:
                current_cost = s3_service.calculate_storage_cost(file.file_size, 'standard', 'INR')
                hibernated_cost = s3_service.calculate_storage_cost(file.file_size, 'deep_archive', 'INR')
                savings = current_cost - hibernated_cost
                
                hibernated_files.append({
                    'file_id': file.id,
                    'filename': file.original_filename,
                    'file_size_mb': file.file_size_mb,
                    'monthly_savings_inr': round(savings, 4)
                })
                
                total_savings += savings
            
            return Response({
                'candidates_found': candidates.count(),
                'files_hibernated': len(hibernated_files) if not dry_run else 0,
                'total_monthly_savings_inr': round(total_savings, 4),
                'hibernated_files': hibernated_files,
                'dry_run': dry_run
            })
            
        except Exception as e:
            return Response({'error': f'Failed to auto-hibernate files: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], parser_classes=[JSONParser])
    def restore(self, request, pk=None):
        media_file = self.get_object()
        restore_tier = request.data.get('restore_tier', 'Standard')
        
        try:
            media_service = MediaFileService(request.user)
            job = media_service.restore_file(media_file, restore_tier)
            
            # Get restore time estimate
            from .constants import RESTORE_TIME_ESTIMATES
            estimated_hours = RESTORE_TIME_ESTIMATES.get(restore_tier, 4)
            
            return Response({
                'message': f'Restore initiated with {restore_tier} tier', 
                'job_id': job.id,
                'estimated_completion': job.estimated_completion,
                'estimated_hours': estimated_hours,
                'status': 'in_progress'
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Restore failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        media_file = self.get_object()
        
        # Update last_accessed timestamp
        media_file.last_accessed = timezone.now()
        media_file.save(update_fields=['last_accessed'])
        
        try:
            s3_service = S3Service(request.user)
            download_url = s3_service.generate_download_url(media_file.s3_key)
            
            response_data = {
                'download_url': download_url,
                'filename': media_file.original_filename,
                'file_size': media_file.file_size,
                'expires_in': 3600,
                'is_encrypted': media_file.is_encrypted,
                'encryption_metadata': media_file.encryption_metadata
            }
            
            return Response(response_data)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Download failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def restore_tiers(self, request):
        """Get available restore tiers with time estimates"""
        from .constants import RESTORE_TIME_ESTIMATES
        
        tiers = []
        for tier, hours in RESTORE_TIME_ESTIMATES.items():
            tiers.append({
                'tier': tier,
                'estimated_hours': hours,
                'description': self._get_tier_description(tier)
            })
        
        return Response(tiers)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def delete_all(self, request):
        """
        Delete all files for the current user with comprehensive safety measures.
        
        Safety features:
        - Requires explicit confirmation (confirm_delete_all=true)
        - Prevents deletion if any files were uploaded in the last 24 hours
        - Soft delete (marks as deleted rather than removing from database)
        
        This is a destructive operation - use with caution!
        """
        try:
            # Get user's files count
            user_files = MediaFile.objects.filter(user=request.user, is_deleted=False)
            total_files = user_files.count()
            
            if total_files == 0:
                return Response({
                    'message': 'No files to delete',
                    'deleted_count': 0
                })
            
            # Safety check: require explicit confirmation
            if hasattr(request, 'data'):
                confirm_delete_all = request.data.get('confirm_delete_all', False)
            else:
                # Handle DRF request vs Django request
                import json
                body = json.loads(request.body.decode('utf-8'))
                confirm_delete_all = body.get('confirm_delete_all', False)
            if not confirm_delete_all:
                return Response({
                    'error': 'Delete all operation requires explicit confirmation',
                    'total_files': total_files,
                    'message': 'Set confirm_delete_all=true to proceed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Additional safety: check for recent files (uploaded in last 24 hours)
            from django.utils import timezone
            from datetime import timedelta
            recent_cutoff = timezone.now() - timedelta(hours=24)
            recent_files = user_files.filter(uploaded_at__gte=recent_cutoff).count()
            
            if recent_files > 0:
                return Response({
                    'error': f'Cannot delete all files: {recent_files} files uploaded in last 24 hours',
                    'total_files': total_files,
                    'recent_files': recent_files,
                    'message': 'Wait 24 hours after last upload or delete files individually'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Proceed with deletion
            s3_service = S3Service(request.user)
            deleted_count = 0
            failed_deletions = []
            
            for media_file in user_files:
                try:
                    # Delete from S3 if file exists
                    if media_file.s3_key:
                        try:
                            s3_service.delete_file(media_file.s3_key)
                        except Exception as e:
                            print(f"Warning: Failed to delete S3 file {media_file.s3_key}: {e}")
                    
                    # Delete from Glacier if archived
                    if media_file.glacier_archive_id:
                        try:
                            s3_service.delete_glacier_archive(media_file.glacier_archive_id)
                        except Exception as e:
                            print(f"Warning: Failed to delete Glacier archive {media_file.glacier_archive_id}: {e}")
                    
                    # Soft delete
                    media_file.is_deleted = True
                    media_file.deleted_at = timezone.now()
                    media_file.save()
                    deleted_count += 1
                    
                except Exception as e:
                    failed_deletions.append({
                        'filename': media_file.original_filename,
                        'error': str(e)
                    })
            
            return Response({
                'message': f'Delete all completed: {deleted_count} files deleted',
                'deleted_count': deleted_count,
                'total_files': total_files,
                'failed_deletions': failed_deletions,
                'success': len(failed_deletions) == 0
            })
            
        except Exception as e:
            return Response({
                'error': f'Delete all failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_tier_description(self, tier):
        """Get description for restore tier"""
        descriptions = {
            'Expedited': 'Fastest restore option (1-5 minutes)',
            'Standard': 'Default restore option (3-5 hours)',
            'Bulk': 'Cheapest restore option (5-12 hours)'
        }
        return descriptions.get(tier, 'Standard restore option')

    def destroy(self, request, pk=None):
        """Delete file from database, S3, and Glacier"""
        media_file = self.get_object()
        
        try:
            s3_service = S3Service(request.user)
            
            # Delete from S3 if file exists
            if media_file.s3_key:
                try:
                    s3_service.delete_file(media_file.s3_key)
                    print(f"Deleted S3 file: {media_file.s3_key}")
                except Exception as e:
                    print(f"Warning: Failed to delete S3 file {media_file.s3_key}: {e}")
            
            # Delete from Glacier if archived
            if media_file.glacier_archive_id:
                try:
                    s3_service.delete_glacier_archive(media_file.glacier_archive_id)
                    print(f"Deleted Glacier archive: {media_file.glacier_archive_id}")
                except Exception as e:
                    print(f"Warning: Failed to delete Glacier archive {media_file.glacier_archive_id}: {e}")
            
            # Soft delete: mark as deleted instead of hard delete
            filename = media_file.original_filename
            media_file.is_deleted = True
            media_file.deleted_at = timezone.now()
            media_file.save()
            
            return Response({
                'message': f'File "{filename}" deleted successfully',
                'deleted_from': {
                    'database': True,
                    's3': bool(media_file.s3_key),
                    'glacier': bool(media_file.glacier_archive_id)
                }
            })
            
        except Exception as e:
            return Response({
                'error': f'Delete failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def bulk_delete(self, request):
        """Bulk delete multiple files efficiently with database transactions"""
        file_ids = request.data.get('file_ids', [])
        
        if not file_ids:
            return Response({
                'error': 'No file IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if len(file_ids) > 1000:
            return Response({
                'error': 'Cannot delete more than 1000 files at once. Please select fewer files or contact support for larger deletions.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get files that belong to the user and are not already deleted
            files_to_delete = MediaFile.objects.filter(
                id__in=file_ids,
                user=request.user,
                is_deleted=False
            )
            
            if not files_to_delete.exists():
                return Response({
                    'error': 'No valid files found to delete'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Initialize S3 service
            s3_service = S3Service(request.user)
            
            # Track results
            deleted_count = 0
            failed_deletions = []
            aws_deletions = {
                's3_success': 0,
                's3_failed': 0,
                'glacier_success': 0,
                'glacier_failed': 0
            }
            
            # Use database transaction for atomicity with shorter lock time
            import time
            start_time = time.time()
            
            with transaction.atomic():
                print(f"Starting bulk delete for {len(files_to_delete)} files")
                
                # Separate S3 keys for batch operations
                s3_keys_to_delete = []
                glacier_archives_to_delete = []
                
                # Collect S3 keys and Glacier archives
                collect_start = time.time()
                for media_file in files_to_delete:
                    if media_file.s3_key:
                        s3_keys_to_delete.append(media_file.s3_key)
                    if media_file.glacier_archive_id:
                        glacier_archives_to_delete.append(media_file.glacier_archive_id)
                
                collect_time = time.time() - collect_start
                print(f"Found {len(s3_keys_to_delete)} S3 files and {len(glacier_archives_to_delete)} Glacier archives to delete (collected in {collect_time:.2f}s)")
                
                # Optimize S3 deletions - use batch delete for speed
                print(f"Deleting {len(s3_keys_to_delete)} S3 files using batch delete")
                
                # Use S3 batch delete for much faster processing
                if s3_keys_to_delete:
                    s3_start = time.time()
                    try:
                        batch_result = s3_service.batch_delete_files(s3_keys_to_delete)
                        aws_deletions['s3_success'] = batch_result.get('deleted', 0)
                        aws_deletions['s3_failed'] = batch_result.get('failed', 0)
                        s3_time = time.time() - s3_start
                        print(f"S3 batch delete completed: {aws_deletions['s3_success']} deleted, {aws_deletions['s3_failed']} failed (took {s3_time:.2f}s)")
                    except Exception as e:
                        print(f"S3 batch delete failed, falling back to individual deletes: {e}")
                        # Fallback to individual deletes
                        for s3_key in s3_keys_to_delete:
                            try:
                                s3_service.delete_file(s3_key)
                                aws_deletions['s3_success'] += 1
                            except Exception as e:
                                aws_deletions['s3_failed'] += 1
                                print(f"Warning: Failed to delete S3 file {s3_key}: {e}")
                
                # Delete Glacier archives individually (no batch API available)
                # Note: Glacier deletions are slow and can take 1-2 seconds each
                if glacier_archives_to_delete:
                    glacier_start = time.time()
                    print(f"Deleting {len(glacier_archives_to_delete)} Glacier archives (this may take time)...")
                    for i, glacier_archive_id in enumerate(glacier_archives_to_delete):
                        try:
                            s3_service.delete_glacier_archive(glacier_archive_id)
                            aws_deletions['glacier_success'] += 1
                            if i % 10 == 0:  # Log every 10th deletion
                                print(f"Deleted Glacier archive {i+1}/{len(glacier_archives_to_delete)}: {glacier_archive_id}")
                        except Exception as e:
                            aws_deletions['glacier_failed'] += 1
                            print(f"Warning: Failed to delete Glacier archive {glacier_archive_id}: {e}")
                    glacier_time = time.time() - glacier_start
                    print(f"Glacier deletion completed: {aws_deletions['glacier_success']} deleted, {aws_deletions['glacier_failed']} failed (took {glacier_time:.2f}s)")
                
                # Soft delete: mark all files as deleted using optimized bulk update
                db_start = time.time()
                print(f"Marking {len(files_to_delete)} files as deleted in database using optimized bulk update")
                try:
                    # Use direct QuerySet update for maximum performance (no object loading)
                    current_time = timezone.now()
                    deleted_count = MediaFile.objects.filter(
                        id__in=file_ids,
                        user=request.user,
                        is_deleted=False
                    ).update(
                        is_deleted=True,
                        deleted_at=current_time
                    )
                    db_time = time.time() - db_start
                    print(f"Optimized bulk update completed: {deleted_count} files marked as deleted (took {db_time:.2f}s)")
                    
                except Exception as e:
                    print(f"Bulk update failed, falling back to individual updates: {e}")
                    # Fallback to individual updates if bulk update fails
                    for media_file in files_to_delete:
                        try:
                            media_file.is_deleted = True
                            media_file.deleted_at = timezone.now()
                            media_file.save()
                            deleted_count += 1
                        except Exception as e:
                            failed_deletions.append({
                                'file_id': media_file.id,
                                'filename': media_file.original_filename,
                                'error': str(e)
                            })
                
                print(f"Bulk delete completed: {deleted_count} files marked as deleted")
            
            total_time = time.time() - start_time
            print(f"=== BULK DELETE SUMMARY ===")
            print(f"Total files processed: {len(files_to_delete)}")
            print(f"Total time taken: {total_time:.2f}s")
            print(f"S3 files deleted: {aws_deletions['s3_success']}")
            print(f"Glacier archives deleted: {aws_deletions['glacier_success']}")
            print(f"Database records updated: {deleted_count}")
            print(f"==========================")
            
            return Response({
                'message': f'Bulk delete completed',
                'summary': {
                    'total_requested': len(file_ids),
                    'successfully_deleted': deleted_count,
                    'failed_deletions': len(failed_deletions),
                    'aws_deletions': aws_deletions
                },
                'failed_files': failed_deletions
            })
            
        except Exception as e:
            return Response({
                'error': f'Bulk delete failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ArchiveJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ArchiveJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ArchiveJob.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
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


class HibernationPlanViewSet(viewsets.ReadOnlyModelViewSet):
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
            from django.conf import settings
            response_data = {
                'plans': grouped_plans,
                'razorpay_key_id': settings.RAZORPAY_KEY_ID
            }
            
            return Response(response_data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payments"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def create_order(self, request):
        """Create a payment order for hibernation plan subscription"""
        try:
            serializer = CreatePaymentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            plan_id = serializer.validated_data['plan_id']
            amount_inr = serializer.validated_data['amount_inr']
            
            payment_service = PaymentService(request.user)
            result = payment_service.create_payment_order(plan_id, amount_inr)
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def verify_payment(self, request):
        """Verify payment and complete subscription"""
        try:
            serializer = VerifyPaymentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            payment_id = request.data.get('payment_id')
            if not payment_id:
                return Response({'error': 'payment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            razorpay_order_id = serializer.validated_data['razorpay_order_id']
            razorpay_payment_id = serializer.validated_data['razorpay_payment_id']
            razorpay_signature = serializer.validated_data['razorpay_signature']
            
            payment_service = PaymentService(request.user)
            result = payment_service.verify_and_complete_payment(
                payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def webhook(self, request):
        """Handle Razorpay webhook events"""
        try:
            import json
            import hmac
            import hashlib
            from django.conf import settings
            
            # Get webhook signature
            razorpay_signature = request.headers.get('X-Razorpay-Signature')
            webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', settings.RAZORPAY_KEY_SECRET)
            
            if not razorpay_signature:
                return Response({'error': 'Missing signature'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify webhook signature
            body = request.body.decode('utf-8')
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(expected_signature, razorpay_signature):
                return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Parse webhook data
            webhook_data = json.loads(body)
            event_type = webhook_data.get('event')
            
            if event_type == 'payment.captured':
                self._handle_payment_captured(webhook_data)
            elif event_type == 'payment.failed':
                self._handle_payment_failed(webhook_data)
            elif event_type == 'order.paid':
                self._handle_order_paid(webhook_data)
            
            return Response({'status': 'success'})
            
        except Exception as e:
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Webhook error: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _handle_payment_captured(self, webhook_data):
        """Handle payment captured event"""
        try:
            payment_data = webhook_data.get('payload', {}).get('payment', {})
            razorpay_payment_id = payment_data.get('entity', {}).get('id')
            razorpay_order_id = payment_data.get('entity', {}).get('order_id')
            
            if razorpay_payment_id and razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id,
                    razorpay_payment_id__isnull=True
                ).first()
                
                if payment:
                    payment.razorpay_payment_id = razorpay_payment_id
                    payment.status = 'success'
                    payment.paid_at = timezone.now()
                    payment.save()
                    
                    # Create user hibernation plan if not exists
                    if not payment.user_hibernation_plan:
                        from datetime import timedelta
                        expires_at = timezone.now() + timedelta(days=365)
                        
                        user_plan = UserHibernationPlan.objects.create(
                            user=payment.user,
                            plan=payment.hibernation_plan,
                            expires_at=expires_at,
                            is_active=True
                        )
                        
                        payment.user_hibernation_plan = user_plan
                        payment.save()
                        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Payment captured handler error: {str(e)}")
    
    def _handle_payment_failed(self, webhook_data):
        """Handle payment failed event"""
        try:
            payment_data = webhook_data.get('payload', {}).get('payment', {})
            razorpay_order_id = payment_data.get('entity', {}).get('order_id')
            
            if razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id
                ).first()
                
                if payment:
                    payment.status = 'failed'
                    payment.save()
                    
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Payment failed handler error: {str(e)}")
    
    def _handle_order_paid(self, webhook_data):
        """Handle order paid event"""
        try:
            order_data = webhook_data.get('payload', {}).get('order', {})
            razorpay_order_id = order_data.get('entity', {}).get('id')
            
            if razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id
                ).first()
                
                if payment and payment.status == 'pending':
                    payment.status = 'success'
                    payment.paid_at = timezone.now()
                    payment.save()
                    
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Order paid handler error: {str(e)}")

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get payment statistics"""
        try:
            from .payment_logger import PaymentLogger
            stats = PaymentLogger.get_payment_stats()
            
            if stats is None:
                return Response({'error': 'Failed to get payment stats'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response(stats)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get payment status"""
        try:
            payment_id = request.query_params.get('payment_id')
            if not payment_id:
                return Response({'error': 'payment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            payment_service = PaymentService(request.user)
            result = payment_service.get_payment_status(payment_id)
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserHibernationPlanViewSet(viewsets.ModelViewSet):
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
            
            # Create user plan (expires in 1 year)
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

    @action(detail=False, methods=['post'])
    def cancel_subscription(self, request):
        """Cancel user's hibernation plan subscription"""
        try:
            user_plan = UserHibernationPlan.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if not user_plan:
                return Response({'error': 'No active plan found'}, status=status.HTTP_404_NOT_FOUND)
            
            user_plan.is_active = False
            user_plan.save()
            
            return Response({'message': 'Subscription cancelled successfully'})
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)