from __future__ import annotations

from celery import shared_task
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
import logging
import time

from .models import MediaFile, ArchiveJob
from .services import MediaFileService, S3Service

logger = logging.getLogger(__name__)


@shared_task(name='api.process_bulk_delete', bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def process_bulk_delete(self, batch_job_id, file_ids, user_id):
    """Process bulk delete using true bulk operations for maximum performance."""
    from django.contrib.auth.models import User
    from django.db import transaction
    from django.utils import timezone
    
    try:
        batch_job = ArchiveJob.objects.get(id=batch_job_id)
        user = User.objects.get(id=user_id)
        batch_job.status = 'in_progress'
        batch_job.save()
        
        files = MediaFile.objects.filter(id__in=file_ids, user=user, is_deleted=False)
        s3_service = S3Service(user)
        
        total = files.count()
        logger.info(f"Starting bulk delete for {total} files (job {batch_job_id})")
        
        # Separate files by storage type for bulk operations
        s3_files = []
        files_to_update = []
        
        for media_file in files:
            files_to_update.append(media_file)
            if media_file.s3_key:
                s3_files.append(media_file.s3_key)
        
        succeeded = []
        failed = []
        
        # Step 1: Bulk delete from S3 using batch API
        if s3_files:
            try:
                logger.info(f"Bulk deleting {len(s3_files)} files from S3...")
                s3_result = s3_service.batch_delete_files(s3_files)
                logger.info(f"S3 batch delete result: {s3_result}")
                
                # Track S3 failures
                if s3_result.get('errors'):
                    for error in s3_result['errors']:
                        failed.append({'s3_key': error['Key'], 'error': error['Message']})
                
            except Exception as e:
                logger.error(f"S3 batch delete failed: {e}")
                # Fall back to individual deletes for S3 files
                for media_file in files_to_update:
                    if media_file.s3_key:
                        try:
                            s3_service.delete_file(media_file.s3_key)
                        except Exception as s3_error:
                            logger.warning(f"Failed to delete S3 file {media_file.s3_key}: {s3_error}")
                            failed.append({'id': media_file.id, 'error': f"S3 delete failed: {s3_error}"})
        
        # Step 3: Bulk soft delete in database using Django bulk_update
        try:
            logger.info(f"Bulk updating {len(files_to_update)} files in database...")
            current_time = timezone.now()
            
            # Prepare files for bulk update
            for media_file in files_to_update:
                media_file.is_deleted = True
                media_file.deleted_at = current_time
            
            # Use Django's bulk_update for maximum performance
            MediaFile.objects.bulk_update(
                files_to_update, 
                ['is_deleted', 'deleted_at'], 
                batch_size=1000
            )
            
            # All files processed successfully
            succeeded = [f.id for f in files_to_update]
            
        except Exception as e:
            logger.error(f"Database bulk update failed: {e}")
            # Fall back to individual updates
            for media_file in files_to_update:
                try:
                    media_file.is_deleted = True
                    media_file.deleted_at = timezone.now()
                    media_file.save()
                    succeeded.append(media_file.id)
                except Exception as db_error:
                    logger.error(f"Failed to update file {media_file.id}: {db_error}")
                    failed.append({'id': media_file.id, 'error': f"Database update failed: {db_error}"})
        
        # Store results in cache
        results = {
            'succeeded': succeeded,
            'failed': failed,
            'total': total,
            'completed_at': timezone.now().isoformat(),
            'success_rate': round((len(succeeded) / total) * 100, 1) if total > 0 else 0
        }
        cache.set(f"bulk_delete_results_{batch_job_id}", results, 86400)  # 24 hours
        
        # Complete the batch job
        batch_job.status = 'completed'
        batch_job.progress = 100
        batch_job.completed_at = timezone.now()
        batch_job.save()
        
        # Invalidate user cache
        from .utils import invalidate_user_cache
        try:
            invalidate_user_cache(user_id, reason="bulk_delete")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache for user {user_id}: {e}")
        
        logger.info(f"Bulk delete completed: {len(succeeded)}/{total} succeeded")
        
    except Exception as e:
        logger.error(f"Bulk delete task failed: {e}")
        try:
            batch_job = ArchiveJob.objects.get(id=batch_job_id)
            batch_job.status = 'failed'
            batch_job.error_message = str(e)
            batch_job.save()
        except:
            pass
        raise


@shared_task(name='api.process_bulk_archive', bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def process_bulk_archive(self, batch_job_id, file_ids, user_id):
    """
    Process bulk archive by creating ZIP bundles.
    This is the new approach: bundle files into ZIPs before archiving to Glacier.
    """
    from django.contrib.auth.models import User
    
    try:
        batch_job = ArchiveJob.objects.get(id=batch_job_id)
        user = User.objects.get(id=user_id)
        batch_job.status = 'in_progress'
        batch_job.save()
        
        files = list(MediaFile.objects.filter(id__in=file_ids, user=user, is_deleted=False, status='uploaded'))
        media_service = MediaFileService(user)
        
        total = len(files)
        logger.info(f"Starting bulk archive for {total} files as ZIP bundle (job {batch_job_id})")
        
        succeeded = []
        failed = []
        
        if not files:
            logger.warning(f"No files to archive for job {batch_job_id}")
            batch_job.status = 'completed'
            batch_job.progress = 100
            batch_job.completed_at = timezone.now()
            batch_job.save()
            return
        
        # Bundle files into ZIP and archive
        try:
            logger.info(f"Creating ZIP bundle for {total} files...")
            
            # Archive all files as a single bundle
            bundle = media_service.archive_files_as_bundle(files)
            
            # All files succeeded
            succeeded = [f.id for f in files]
            logger.info(f"Successfully created bundle {bundle.bundle_name} with {total} files")
            
        except Exception as e:
            logger.error(f"Failed to create archive bundle: {e}")
            # All files failed if bundle creation fails
            failed = [{'id': f.id, 'error': str(e)} for f in files]
        
        # Store results in cache
        results = {
            'succeeded': succeeded,
            'failed': failed,
            'total': total,
            'completed_at': timezone.now().isoformat(),
            'success_rate': round((len(succeeded) / total) * 100, 1) if total > 0 else 0
        }
        cache.set(f"bulk_archive_results_{batch_job_id}", results, 86400)  # 24 hours
        
        # Complete the batch job
        batch_job.status = 'completed' if len(succeeded) > 0 else 'failed'
        batch_job.progress = 100
        batch_job.completed_at = timezone.now()
        if len(succeeded) == 0 and failed:
            batch_job.error_message = f"Bundle creation failed: {failed[0]['error']}"
        batch_job.save()
        
        # Invalidate user cache
        from .utils import invalidate_user_cache
        try:
            invalidate_user_cache(user_id, reason="bulk_archive")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache for user {user_id}: {e}")
        
        logger.info(f"Bulk archive completed: {len(succeeded)}/{total} succeeded")
        
    except Exception as e:
        logger.error(f"Bulk archive task failed: {e}")
        try:
            batch_job = ArchiveJob.objects.get(id=batch_job_id)
            batch_job.status = 'failed'
            batch_job.error_message = str(e)
            batch_job.save()
        except:
            pass
        raise


@shared_task(name='api.process_bulk_restore', bind=True, max_retries=3, time_limit=1800, soft_time_limit=1500)
def process_bulk_restore(self, batch_job_id, file_ids, user_id, restore_tier='Standard'):
    """
    Process bulk restore at bundle level.
    Only complete bundles can be restored, not individual files.
    """
    from django.contrib.auth.models import User
    from .models import ArchiveBundle
    
    try:
        batch_job = ArchiveJob.objects.get(id=batch_job_id)
        user = User.objects.get(id=user_id)
        batch_job.status = 'in_progress'
        batch_job.save()
        
        files = MediaFile.objects.filter(id__in=file_ids, user=user, is_deleted=False, status='archived').select_related('archive_bundle')
        media_service = MediaFileService(user)
        
        total = files.count()
        logger.info(f"Starting bulk restore for {total} files (job {batch_job_id})")
        
        succeeded = []
        failed = []
        
        # Group files by bundle
        bundles_to_restore = set()
        files_by_bundle = {}
        
        for media_file in files:
            if media_file.archive_bundle:
                bundles_to_restore.add(media_file.archive_bundle.id)
                if media_file.archive_bundle.id not in files_by_bundle:
                    files_by_bundle[media_file.archive_bundle.id] = []
                files_by_bundle[media_file.archive_bundle.id].append(media_file)
            else:
                # Legacy file without bundle - restore individually
                try:
                    media_service.restore_file(media_file, restore_tier)
                    succeeded.append(media_file.id)
                except Exception as e:
                    logger.error(f"Failed to restore legacy file {media_file.id}: {e}")
                    failed.append({'id': media_file.id, 'error': str(e)})
        
        # Restore bundles (one restore per bundle, not per file)
        logger.info(f"Restoring {len(bundles_to_restore)} unique bundles...")
        current_time = timezone.now()
        
        for bundle_id in bundles_to_restore:
            try:
                bundle = ArchiveBundle.objects.get(id=bundle_id)
                logger.info(f"Initiating restore for bundle {bundle.bundle_name} with {bundle.total_files} files")
                
                # Restore the entire bundle
                media_service.restore_bundle(bundle, restore_tier)
                
                # Mark all files in this bundle as succeeded
                bundle_file_ids = [f.id for f in files_by_bundle[bundle_id]]
                succeeded.extend(bundle_file_ids)
                
                logger.info(f"Successfully initiated restore for bundle {bundle.bundle_name}")
                
            except Exception as e:
                logger.error(f"Failed to restore bundle {bundle_id}: {e}")
                # Mark all files in this bundle as failed
                bundle_file_ids = [f.id for f in files_by_bundle.get(bundle_id, [])]
                for fid in bundle_file_ids:
                    failed.append({'id': fid, 'error': f"Bundle restore failed: {str(e)}"})
        
        # Store results
        results = {
            'succeeded': succeeded,
            'failed': failed,
            'total': total,
            'bundles_restored': len(bundles_to_restore),
            'restore_tier': restore_tier,
            'initiated_at': current_time.isoformat(),
            'success_rate': round((len(succeeded) / total) * 100, 1) if total > 0 else 0
        }
        cache.set(f"bulk_restore_results_{batch_job_id}", results, 86400)
        
        # Complete the batch job
        batch_job.status = 'completed'
        batch_job.progress = 100
        batch_job.completed_at = timezone.now()
        batch_job.save()
        
        # Invalidate user cache
        from .utils import invalidate_user_cache
        try:
            invalidate_user_cache(user_id, reason="bulk_restore")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache for user {user_id}: {e}")
        
        logger.info(f"Bulk restore initiated: {len(succeeded)}/{total} files in {len(bundles_to_restore)} bundles succeeded")
        
    except Exception as e:
        logger.error(f"Bulk restore task failed: {e}")
        try:
            batch_job = ArchiveJob.objects.get(id=batch_job_id)
            batch_job.status = 'failed'
            batch_job.error_message = str(e)
            batch_job.save()
        except:
            pass
        raise


@shared_task(name='api.check_bundle_restores')
def check_bundle_restores():
    """
    Periodic task to check if bundle restores are complete.
    Runs every 30 minutes to check Glacier restore status.
    """
    from .models import ArchiveBundle
    from .services import MediaFileService
    from django.contrib.auth.models import User
    
    # Get all bundles that are currently restoring
    restoring_bundles = ArchiveBundle.objects.filter(status='restoring').select_related('user')
    
    logger.info(f"Checking restore status for {restoring_bundles.count()} bundles")
    
    completed_count = 0
    for bundle in restoring_bundles:
        try:
            service = MediaFileService(bundle.user)
            updated_bundle = service.check_and_complete_bundle_restore(bundle)
            
            if updated_bundle.status == 'restored':
                completed_count += 1
                logger.info(f"Bundle {bundle.bundle_name} restore completed")
                
                # Invalidate user cache
                from .utils import invalidate_user_cache
                try:
                    invalidate_user_cache(bundle.user.id, reason="bundle_restore_complete")
                except Exception as e:
                    logger.warning(f"Failed to invalidate cache for user {bundle.user.id}: {e}")
                    
        except Exception as e:
            logger.error(f"Error checking restore for bundle {bundle.id}: {e}")
    
    logger.info(f"Bundle restore check complete: {completed_count} bundles restored")
    return completed_count


@shared_task(name='api.snapshot_storage_costs')
def snapshot_storage_costs() -> int:
    """Compute and cache per-user storage cost snapshots to speed up overview UI.

    The view can optionally read from cache (key: cost_snapshot:{user_id}) if desired.
    Returns number of users snapshotted.
    """
    # Get distinct users with files
    user_ids = (MediaFile.objects.filter(is_deleted=False)
                .values_list('user_id', flat=True).distinct())

    count = 0
    for user_id in user_ids:
        files = MediaFile.objects.filter(user_id=user_id, is_deleted=False)
        if not files.exists():
            cache.set(f'cost_snapshot:{user_id}', {
                'total_monthly_cost_usd': 0,
                'cost_breakdown': {
                    'standard': 0, 'ia': 0, 'glacier': 0, 'deep_archive': 0
                },
                'file_count': 0,
                'total_size_gb': 0,
            }, 24 * 3600)
            count += 1
            continue

        s3_service = S3Service(files.first().user)
        total_cost = 0
        total_size_bytes = 0
        breakdown = {'standard': 0, 'ia': 0, 'glacier': 0, 'deep_archive': 0}

        for f in files:
            if f.status == 'archived':
                tier = 'deep_archive'
            else:
                tier = 'standard'

            cost = s3_service.calculate_storage_cost(f.file_size, tier, 'USD')
            total_cost += cost
            breakdown[tier] += cost
            total_size_bytes += (f.file_size or 0)

        snapshot = {
            'total_monthly_cost_usd': round(total_cost, 4),
            'cost_breakdown': breakdown,
            'file_count': files.count(),
            'total_size_gb': round((total_size_bytes or 0) / (1024 ** 3), 4),
            'generated_at': timezone.now().isoformat(),
        }
        cache.set(f'cost_snapshot:{user_id}', snapshot, 24 * 3600)
        count += 1

    return count


@shared_task(name='api.cleanup_stuck_jobs')
def cleanup_stuck_jobs():
    """Clean up jobs that have been stuck in pending status for too long."""
    try:
        # Find jobs stuck in pending status for more than 30 minutes
        stuck_cutoff = timezone.now() - timedelta(minutes=30)
        stuck_jobs = ArchiveJob.objects.filter(
            status='pending',
            started_at__lt=stuck_cutoff
        )
        
        stuck_count = stuck_jobs.count()
        if stuck_count > 0:
            logger.warning(f"Found {stuck_count} stuck jobs, marking as failed")
            
            for job in stuck_jobs:
                job.status = 'failed'
                job.error_message = 'Job stuck - marked as failed by cleanup task'
                job.save()
                logger.info(f"Marked stuck job {job.id} ({job.job_type}) as failed")
            
            logger.info(f"Cleaned up {stuck_count} stuck jobs")
        else:
            logger.debug("No stuck jobs found")
            
    except Exception as e:
        logger.error(f"Failed to cleanup stuck jobs: {e}")
        raise


