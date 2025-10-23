"""
File management views for handling file uploads, downloads, and operations.

This module contains:
- MediaFileViewSet for file operations
- create_folder function for folder management
"""
import re
import uuid
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Q, Sum, Count
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from ..models import MediaFile
from ..serializers import MediaFileSerializer
from ..services import S3Service
from ..utils import sanitize_filename
from .cache_utils import invalidate_user_cache
import logging

logger = logging.getLogger(__name__)


class MediaFileViewSet(viewsets.ModelViewSet):
    """ViewSet for managing media files"""
    serializer_class = MediaFileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def get_queryset(self):
        return MediaFile.objects.filter(user=self.request.user, is_deleted=False)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def list_optimized(self, request):
        """Optimized file listing with folder/search filters and optional pagination.

        Query params supported:
        - folder: 'root' for root-level or a path like 'photos/2024'
        - search: substring match on original_filename (case-insensitive)
        - paginate: 'false' to return all matched results (default is paginated)
        - page, page_size: pagination controls when paginate != 'false'
        """
        user_id = request.user.id
        folder_path = request.query_params.get('folder', '')
        search_query = request.query_params.get('search', '').strip()
        paginate = request.query_params.get('paginate', 'true').lower() != 'false'
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        
        # Support cache busting via `_t` param (bypass cache when present)
        cache_bust = request.query_params.get('_t')
        if cache_bust:
            cache_key = f"files_{user_id}_{folder_path}_{search_query}_{paginate}_{page}_{page_size}_bust_{cache_bust}"
        else:
            # Create cache key with version for cache invalidation
            cache_version = cache.get(f"user_cache_version_{user_id}", 0)
            cache_key = f"files_{user_id}_{folder_path}_{search_query}_{paginate}_{page}_{page_size}_v{cache_version}"
            
            # Try to get from cache first (only when not cache-busting)
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
        folders_data = []
        if folder_path:
            if folder_path == 'root':
                # Root files (no relative_path or relative_path is empty)
                queryset = queryset.filter(Q(relative_path__isnull=True) | Q(relative_path=''))
                
                # Also get folders in root (top-level directories)
                all_files = MediaFile.objects.filter(user_id=user_id, is_deleted=False).exclude(
                    Q(relative_path__isnull=True) | Q(relative_path='')
                )
                top_level_dirs = set()
                for file in all_files:
                    if file.relative_path:
                        first_part = file.relative_path.split('/')[0]
                        top_level_dirs.add(first_part)
                
                # Create folder entries for root view
                for dir_name in sorted(top_level_dirs):
                    # Count files in this directory (including subdirectories)
                    dir_files = all_files.filter(relative_path__startswith=f"{dir_name}/")
                    dir_file_count = dir_files.count()
                    dir_size = sum(file.file_size for file in dir_files if file.file_size)
                    folders_data.append({
                        'name': dir_name,
                        'type': 'folder',
                        'fileCount': dir_file_count,
                        'size': dir_size,
                        'relative_path': dir_name
                    })
            else:
                # Files in specific folder (non-recursive immediate folder scope)
                queryset = queryset.filter(Q(relative_path=folder_path) | Q(relative_path__startswith=f"{folder_path}/"))
                
                # Also create folder entries for subfolders in this view
                all_files_in_folder = MediaFile.objects.filter(
                    user_id=user_id, 
                    is_deleted=False,
                    relative_path__startswith=f"{folder_path}/"
                )
                
                # Get unique subfolder names (all immediate subfolders, not just those with nested folders)
                subfolders = set()
                for file in all_files_in_folder:
                    if file.relative_path:
                        # Remove the current folder path prefix
                        remaining_path = file.relative_path[len(folder_path)+1:] if file.relative_path.startswith(folder_path) else file.relative_path
                        path_parts = remaining_path.split('/')
                        if len(path_parts) >= 1 and path_parts[0]:  # Has at least one subfolder level
                            subfolders.add(path_parts[0])
                
                # Create folder entries for subfolders
                for subfolder_name in sorted(subfolders):
                    subfolder_path = f"{folder_path}/{subfolder_name}"
                    # Count files directly in this subfolder AND files in its subfolders
                    subfolder_files = all_files_in_folder.filter(
                        Q(relative_path=subfolder_path) | Q(relative_path__startswith=f"{subfolder_path}/")
                    )
                    subfolder_file_count = subfolder_files.count()
                    subfolder_size = sum(file.file_size for file in subfolder_files if file.file_size)
                    folders_data.append({
                        'name': subfolder_name,
                        'type': 'folder',
                        'fileCount': subfolder_file_count,
                        'size': subfolder_size,
                        'relative_path': subfolder_path
                    })
        else:
            # Empty folder_path means root level - same as folder_path == 'root'
            # Root files (no relative_path or relative_path is empty)
            queryset = queryset.filter(Q(relative_path__isnull=True) | Q(relative_path=''))
            
            # Also get folders in root (top-level directories)
            all_files = MediaFile.objects.filter(user_id=user_id, is_deleted=False).exclude(
                Q(relative_path__isnull=True) | Q(relative_path='')
            )
            top_level_dirs = set()
            for file in all_files:
                if file.relative_path:
                    first_part = file.relative_path.split('/')[0]
                    top_level_dirs.add(first_part)
            
            # Create folder entries for root view
            for dir_name in sorted(top_level_dirs):
                # Count files in this directory (including subdirectories)
                dir_files = all_files.filter(relative_path__startswith=f"{dir_name}/")
                dir_file_count = dir_files.count()
                dir_size = sum(file.file_size for file in dir_files if file.file_size)
                folders_data.append({
                    'name': dir_name,
                    'type': 'folder',
                    'fileCount': dir_file_count,
                    'size': dir_size,
                    'relative_path': dir_name
                })

        # Debug logging
        print(f"DEBUG: folder_path={folder_path}, folders_data count={len(folders_data)}")
        for folder in folders_data:
            print(f"  Folder: {folder['name']} - {folder['fileCount']} files, {folder['size']} bytes")

        # Apply search filter if provided
        if search_query:
            queryset = queryset.filter(original_filename__icontains=search_query)
        
        # Order by upload date for consistency
        queryset = queryset.order_by('-uploaded_at')
        
        files_data = []
        if paginate:
            paginator = Paginator(queryset, page_size)
            page_obj = paginator.get_page(page)
            for file in page_obj:
                files_data.append({
                    'id': file.id,
                    'original_filename': file.original_filename,
                    'file_size': file.file_size,
                    'file_type': file.file_type,
                    'relative_path': (file.relative_path or ''),
                    'status': file.status,
                    'uploaded_at': file.uploaded_at,
                    's3_key': file.s3_key
                })
            
            result = {
                'files': files_data,
                'folders': folders_data,
                'pagination': {
                    'current_page': page_obj.number,
                    'total_pages': paginator.num_pages,
                    'total_count': paginator.count,
                    'page_size': page_size,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous()
                }
            }
        else:
            # Return all results without pagination
            for file in queryset:
                files_data.append({
                    'id': file.id,
                    'original_filename': file.original_filename,
                    'file_size': file.file_size,
                    'file_type': file.file_type,
                    'relative_path': (file.relative_path or ''),
                    'status': file.status,
                    'uploaded_at': file.uploaded_at,
                    's3_key': file.s3_key
                })
            
            result = {
                'files': files_data,
                'folders': folders_data,
                'total_count': len(files_data)
            }
        
        # Cache the result (only when not cache-busting)
        if not cache_bust:
            cache.set(cache_key, result, 300)  # 5 minutes cache
        
        return Response(result)

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
        """Get presigned URLs for uploading files - supports both single file and bulk uploads"""
        try:
            # Files-in-flight limiter (per user): allow up to MAX_CONCURRENT_UPLOADS * 1000 files
            user_id = getattr(request.user, 'id', None)
            files = request.data.get('files', [])
            if files and user_id:
                max_concurrent = getattr(settings, 'MAX_CONCURRENT_UPLOADS', 100)
                max_total_files = max_concurrent * 1000
                inflight_key = f"user_{user_id}_files_inflight"
                try:
                    current_files = cache.get(inflight_key) or 0
                    
                    # Check limit
                    if current_files + len(files) > max_total_files:
                        return Response({
                            'error': 'Too many files in flight',
                            'message': f'Maximum {max_total_files:,} files can be uploaded concurrently',
                            'current_files': current_files,
                            'requested_files': len(files),
                            'max_total_files': max_total_files
                        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                    
                    # Increment counter
                    cache.set(inflight_key, current_files + len(files), 3600)
                except Exception as e:
                    return Response({'error': f'Cache error: {str(e)}'}, 
                                  status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Check if this is a bulk upload request
            if files:
                # Bulk upload mode - generate presigned URLs for multiple files
                if len(files) > 1000:  # Process in chunks
                    return Response({'error': 'Max 1000 files per batch'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
                
                s3_service = S3Service(request.user)
                presigned_urls = []
                
                # Check if this is the new format (from worker) or old format (multipart)
                first_file = files[0] if files else {}
                
                if 'filename' in first_file and 'fileType' in first_file:
                    # New format from worker - generate POST form presigned URLs
                    for file_info in files:
                        filename = file_info.get('filename')
                        file_type = file_info.get('fileType', 'application/octet-stream')
                        file_size = file_info.get('fileSize', 0)
                        relative_path = file_info.get('relativePath', '')
                        encryption_metadata = file_info.get('encryption_metadata', None)
                        
                        if not filename:
                            continue
                        
                        # Generate unique filename and S3 key
                        sanitized_name = sanitize_filename(filename)
                        uuid_prefix = str(uuid.uuid4())
                        unique_filename = f"{uuid_prefix}_{sanitized_name}"
                        
                        if relative_path:
                            s3_key = f"uploads/{request.user.username}/{relative_path}/{unique_filename}"
                        else:
                            s3_key = f"uploads/{request.user.username}/{unique_filename}"
                        
                        # Generate POST form presigned URL
                        try:
                            s3_client = s3_service.s3_client
                            bucket_name = s3_service.s3_config.bucket_name
                            
                            presigned_post = s3_client.generate_presigned_post(
                                Bucket=bucket_name,
                                Key=s3_key,
                                Fields={
                                    'Content-Type': file_type,
                                },
                                Conditions=[
                                    {'Content-Type': file_type},
                                    ['content-length-range', 0, file_size] if file_size > 0 else ['content-length-range', 0, 1073741824]  # 1GB max
                                ],
                                ExpiresIn=7200  # 2 hours
                            )
                            
                            # Create MediaFile record for POST form upload
                            media_file = MediaFile.objects.create(
                                user=request.user,
                                filename=unique_filename,
                                original_filename=filename,
                                file_size=file_size,
                                file_type=file_type,
                                s3_key=s3_key,
                                relative_path=relative_path,
                                status='uploading',
                                encryption_metadata=encryption_metadata
                            )
                            
                            presigned_urls.append({
                                'filename': filename,
                                's3_key': s3_key,
                                'url': presigned_post['url'],
                                'fields': presigned_post['fields'],
                                'media_file_id': media_file.id
                            })
                        except Exception as e:
                            logger.error(f"Failed to generate presigned POST for {filename}: {str(e)}")
                            continue
                
                else:
                    # Old format - multipart upload presigned URLs
                    for file_info in files:
                        s3_key = file_info.get('s3_key')
                        upload_id = file_info.get('upload_id')
                        chunk_count = file_info.get('chunk_count', 1)
                        
                        if not all([upload_id, s3_key]):
                            continue
                        
                        file_presigned_urls = []
                        for part_number in range(1, chunk_count + 1):
                            presigned_url = s3_service.generate_presigned_url_for_chunk(
                                s3_key, upload_id, part_number
                            )
                            file_presigned_urls.append({
                                'part_number': part_number,
                                'presigned_url': presigned_url
                            })
                        
                        presigned_urls.append({
                            's3_key': s3_key,
                            'upload_id': upload_id,
                            'presigned_urls': file_presigned_urls
                        })
                
                return Response({
                    'presigned_urls': presigned_urls,
                    'batch_id': request.data.get('batch_id')
                })
            
            # Single file mode (legacy support)
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
            logger.error(f"Presigned URL generation failed: {str(e)}")
            return Response({'error': f'Failed to generate presigned URLs: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        # NO finally block - we decrement in complete_upload_batch endpoint

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def complete_upload_batch(self, request):
        """Decrement files-in-flight counter and update file statuses after a batch completes."""
        try:
            user_id = getattr(request.user, 'id', None)
            if not user_id:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)
            
            completed_files = int(request.data.get('completed_files', 0) or 0)
            inflight_key = f"user_{user_id}_files_inflight"
            
            logger.info(f"[complete_upload_batch] User {user_id} completed {completed_files} files")
            
            if completed_files > 0:
                # Decrement the files-in-flight counter
                current = cache.get(inflight_key) or 0
                new_count = max(0, current - completed_files)
                cache.set(inflight_key, new_count, 3600)
                
                # Update file statuses from 'uploading' to 'uploaded' for this user
                # This is safe because files in 'uploading' status have already been uploaded to S3
                updated_count = MediaFile.objects.filter(
                    user_id=user_id,
                    status='uploading',
                    is_deleted=False
                ).update(status='uploaded')
                
                logger.info(f"[complete_upload_batch] Updated {updated_count} files from 'uploading' to 'uploaded' for user {user_id}")
                
                # Invalidate user cache to refresh file listings
                invalidate_user_cache(user_id)
                
                return Response({
                    'success': True, 
                    'remaining_files': new_count,
                    'files_updated': updated_count
                })
            
            return Response({'success': True, 'remaining_files': cache.get(inflight_key) or 0})
        except Exception as e:
            logger.error(f"[complete_upload_batch] Error: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
    def bulk_delete(self, request):
        """Bulk delete multiple files efficiently with database transactions"""
        from django.db import transaction
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
                    'message': 'No files found to delete',
                    'summary': {
                        'total_requested': len(file_ids),
                        'successfully_deleted': 0,
                        'failed_deletions': 0,
                        'aws_deletions': 0
                    },
                    'failed_files': []
                })
            
            # Use database transaction for atomicity with shorter lock time
            import time
            start_time = time.time()
            
            with transaction.atomic():
                logger.info(f"Starting bulk delete for {len(files_to_delete)} files")
                
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
                logger.info(f"Found {len(s3_keys_to_delete)} S3 files and {len(glacier_archives_to_delete)} Glacier archives to delete (collected in {collect_time:.2f}s)")
                
                # Optimize S3 deletions - use batch delete for speed
                logger.info(f"Deleting {len(s3_keys_to_delete)} S3 files using batch delete")
                
                # Use S3 batch delete for much faster processing
                aws_deletions = 0
                if s3_keys_to_delete:
                    try:
                        s3_service = S3Service(request.user)
                        aws_deletions = s3_service.bulk_delete_files(s3_keys_to_delete)
                        logger.info(f"S3 batch delete completed: {aws_deletions} files deleted from S3")
                    except Exception as e:
                        logger.error(f"S3 batch delete failed: {e}")
                        # Continue with database deletion even if S3 fails
                
                # Mark files as deleted in database
                deleted_count = 0
                failed_deletions = []
                
                try:
                    # Use bulk update for better performance
                    current_time = timezone.now()
                    db_start = time.time()
                    
                    deleted_count = files_to_delete.update(
                        is_deleted=True,
                        deleted_at=current_time
                    )
                    db_time = time.time() - db_start
                    logger.info(f"Optimized bulk update completed: {deleted_count} files marked as deleted (took {db_time:.2f}s)")
                    
                except Exception as e:
                    logger.error(f"Bulk update failed, falling back to individual updates: {e}")
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
                
                logger.info(f"Bulk delete completed: {deleted_count} files marked as deleted")
            
            total_time = time.time() - start_time
            logger.info(f"Total bulk delete operation took {total_time:.2f}s")
            
            # Clear cache for this user to ensure folder structure updates
            user_id = request.user.id
            
            try:
                # Use comprehensive cache invalidation
                new_version = invalidate_user_cache(user_id, reason="bulk_delete")
                if new_version:
                    logger.info(f"Successfully invalidated cache for user {user_id} after bulk delete")
                else:
                    logger.warning(f"Cache invalidation failed for user {user_id}")
                
            except Exception as cache_error:
                logger.error(f"Cache clearing error: {cache_error}")
                # Don't fail the delete operation if cache clearing fails
            
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
            logger.error(f"Bulk delete failed: {str(e)}")
            return Response({
                'error': f'Bulk delete failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], parser_classes=[JSONParser])
    def mark_upload_complete(self, request):
        """Mark bulk upload as complete and invalidate cache"""
        user_id = request.user.id
        file_ids = request.data.get('file_ids', [])
        
        try:
            # Optionally finalize specific files: move 'uploading' -> 'uploaded'
            if isinstance(file_ids, list) and file_ids:
                try:
                    updated = MediaFile.objects.filter(
                        id__in=file_ids,
                        user_id=user_id,
                        status='uploading',
                        is_deleted=False
                    ).update(status='uploaded')
                    logger.info(f"[mark_upload_complete] Finalized {updated} files for user {user_id}")
                except Exception as finalize_err:
                    logger.warning(f"[mark_upload_complete] finalize by ids failed: {finalize_err}")
            
            # Validate that all files belong to the user
            if file_ids:
                user_files = MediaFile.objects.filter(
                    id__in=file_ids, 
                    user_id=user_id
                ).count()
                
                if user_files != len(file_ids):
                    return Response({
                        'error': 'Some files do not belong to the user'
                    }, status=status.HTTP_403_FORBIDDEN)
            
            # Comprehensive cache invalidation
            new_version = invalidate_user_cache(user_id, reason="upload_complete")
            
            return Response({
                'message': 'Upload marked as complete and cache invalidated',
                'new_version': new_version,
                'files_processed': len(file_ids)
            })
        except Exception as cache_error:
            return Response({
                'error': f'Cache invalidation error: {cache_error}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def clear_cache(self, request):
        """Clear all cache for the current user - useful for debugging"""
        try:
            user_id = request.user.id
            
            # Comprehensive cache invalidation
            new_version = invalidate_user_cache(user_id, reason="manual_clear")
            
            return Response({
                'message': f'Cache cleared for user {user_id}',
                'cache_version': f'{new_version - 1 if new_version else "unknown"} -> {new_version if new_version else "failed"}'
            })
            
        except Exception as e:
            return Response({
                'error': f'Cache clear failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def clear_cache_patterns(self, request):
        """Clear specific cache patterns for debugging and maintenance"""
        try:
            user_id = request.user.id
            patterns = request.data.get('patterns', [])
            
            if not patterns:
                return Response({
                    'error': 'No patterns provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Clear specific patterns
            from .cache_utils import clear_user_cache_patterns
            clear_user_cache_patterns(user_id, patterns)
            
            return Response({
                'message': f'Cache patterns cleared for user {user_id}',
                'patterns_cleared': patterns
            })
            
        except Exception as e:
            return Response({
                'error': f'Cache pattern clear failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        """Override to add user and invalidate cache"""
        serializer.save(user=self.request.user)
        # Invalidate user cache after file upload
        invalidate_user_cache(self.request.user.id, "file_upload")

    def perform_update(self, serializer):
        """Override to invalidate cache after update"""
        serializer.save()
        invalidate_user_cache(self.request.user.id, "file_update")

    def perform_destroy(self, instance):
        """Override to soft delete and invalidate cache"""
        instance.is_deleted = True
        instance.save()
        invalidate_user_cache(self.request.user.id, "file_delete")

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def folder_structure(self, request):
        """Get folder structure without loading all files"""
        user_id = request.user.id
        
        # Check for cache busting parameter
        cache_bust = request.query_params.get('_t')
        if cache_bust:
            # Force fresh data by using a unique cache key
            cache_key = f"folder_structure_{user_id}_bust_{cache_bust}"
            print(f"[Folder Structure] Cache bust requested: {cache_bust}")
        else:
            # Create cache key with version for cache invalidation
            cache_version = cache.get(f"user_cache_version_{user_id}", 0)
            cache_key = f"folder_structure_{user_id}_v{cache_version}"
        
        # Try cache first (only if not cache busting)
        if not cache_bust:
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
        
        # Cache for 10 minutes (skip caching when cache-busting)
        if not cache_bust:
            cache.set(cache_key, folder_tree, 600)  # 10 minutes
        
        return Response(folder_tree)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def bulk_archive(self, request):
        """Archive multiple files in one request."""
        file_ids = request.data.get('file_ids', [])

        if not file_ids:
            return Response({'error': 'No file IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Only allow archiving uploaded files belonging to user
        files = MediaFile.objects.filter(id__in=file_ids, user=request.user, is_deleted=False)

        from ..services import MediaFileService
        media_service = MediaFileService(request.user)

        succeeded = []
        failed = []
        for media_file in files:
            try:
                if media_file.status != 'uploaded':
                    raise ValueError('File must be uploaded before archiving')
                media_service.archive_file(media_file)
                succeeded.append(media_file.id)
            except Exception as e:
                failed.append({'id': media_file.id, 'error': str(e)})

        return Response({
            'message': 'Bulk archive completed',
            'summary': {
                'total_requested': len(file_ids),
                'successfully_archived': len(succeeded),
                'failed': len(failed)
            },
            'failed_files': failed
        })

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download individual file"""
        media_file = self.get_object()
        
        # Track download activity
        try:
            from ..services import MediaFileService
            media_file_service = MediaFileService(request.user)
            ip_address = request.META.get('REMOTE_ADDR')
            user_agent = request.META.get('HTTP_USER_AGENT')
            media_file_service.track_download(media_file, ip_address, user_agent)
        except Exception as e:
            # Log but don't fail the download
            print(f"Failed to track download: {str(e)}")
        
        try:
            from ..services import S3Service
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

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def bulk_download(self, request):
        """Generate download URLs for multiple files"""
        file_ids = request.data.get('file_ids', [])
        
        if not file_ids:
            return Response({'error': 'No file IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get files that can be downloaded
        files = MediaFile.objects.filter(
            id__in=file_ids, 
            user=request.user, 
            is_deleted=False,
            status__in=['uploaded', 'restored']
        )
        
        if not files.exists():
            return Response({'error': 'No files available for download. Files must be in "uploaded" or "restored" state.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from ..services import S3Service
            s3_service = S3Service(request.user)
            
            download_urls = []
            for media_file in files:
                try:
                    download_url = s3_service.generate_download_url(media_file.s3_key)
                    download_urls.append({
                        'id': media_file.id,
                        'filename': media_file.original_filename,
                        'file_size': media_file.file_size,
                        'download_url': download_url,
                        'is_encrypted': media_file.is_encrypted,
                        'encryption_metadata': media_file.encryption_metadata,
                        'relative_path': media_file.relative_path
                    })
                except Exception as e:
                    download_urls.append({
                        'id': media_file.id,
                        'filename': media_file.original_filename,
                        'error': str(e)
                    })
            
            return Response({
                'download_urls': download_urls,
                'total_files': len(download_urls),
                'successful': len([url for url in download_urls if 'download_url' in url]),
                'failed': len([url for url in download_urls if 'error' in url])
            })
            
        except Exception as e:
            return Response({'error': f'Bulk download failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], parser_classes=[JSONParser])
    def bulk_restore(self, request):
        """Restore multiple archived files in one request."""
        file_ids = request.data.get('file_ids', [])
        restore_tier = request.data.get('restore_tier', 'Standard')

        if not file_ids:
            return Response({'error': 'No file IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

        files = MediaFile.objects.filter(id__in=file_ids, user=request.user, is_deleted=False)

        from ..services import MediaFileService
        media_service = MediaFileService(request.user)

        succeeded = []
        failed = []
        for media_file in files:
            try:
                if media_file.status != 'archived':
                    raise ValueError('File is not archived')
                media_service.restore_file(media_file, restore_tier)
                succeeded.append(media_file.id)
            except Exception as e:
                failed.append({'id': media_file.id, 'error': str(e)})

        return Response({
            'message': 'Bulk restore initiated',
            'summary': {
                'total_requested': len(file_ids),
                'successfully_started': len(succeeded),
                'failed': len(failed),
                'restore_tier': restore_tier
            },
            'failed_files': failed
        })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_folder(request):
    """Create a new folder"""
    try:
        folder_name = request.data.get('folder_name', '').strip()
        parent_path = request.data.get('parent_path', '').strip()
        
        if not folder_name:
            return Response({'error': 'Folder name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate folder name (no special characters that could cause issues)
        if not re.match(r'^[a-zA-Z0-9\s\-_\.]+$', folder_name):
            return Response({
                'error': 'Folder name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, and dots are allowed.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Build the full path
        if parent_path:
            full_path = f"{parent_path}/{folder_name}"
        else:
            full_path = folder_name
        
        # Check if folder already exists
        existing_folder = MediaFile.objects.filter(
            user=request.user,
            relative_path=full_path,
            is_deleted=False,
            file_type='folder'
        ).first()
        
        if existing_folder:
            return Response({'error': f'Folder "{folder_name}" already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create folder entry
        folder = MediaFile.objects.create(
            user=request.user,
            original_filename=folder_name,
            filename=f"{folder_name}/",  # Add trailing slash to indicate it's a folder
            file_size=0,
            file_type='folder',
            status='uploaded',
            relative_path=full_path,
            is_deleted=False
        )
        
        # Invalidate cache for this user to ensure fresh data
        user_id = request.user.id
        cache_version = cache.get(f"user_cache_version_{user_id}", 0)
        cache.set(f"user_cache_version_{user_id}", cache_version + 1, 3600)
        
        return Response({
            'message': f'Folder "{folder_name}" created successfully',
            'folder': {
                'id': folder.id,
                'name': folder_name,
                'relative_path': full_path,
                'type': 'folder'
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
