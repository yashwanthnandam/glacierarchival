from __future__ import annotations

from celery import shared_task
from django.utils import timezone
from django.core.cache import cache

from .models import MediaFile, ArchiveJob
from .services import MediaFileService, S3Service


@shared_task(name='api.sync_restore_status')
def sync_restore_status() -> int:
    """Advance files from restoring -> restored when ETA has passed.

    Returns the number of files moved to restored.
    """
    now = timezone.now()
    # Jobs still in progress and ETA passed
    jobs = ArchiveJob.objects.filter(
        job_type='restore', status='in_progress', estimated_completion__isnull=False,
        estimated_completion__lte=now
    ).select_related('media_file', 'user')

    updated = 0
    for job in jobs:
        media_file: MediaFile = job.media_file
        if media_file and media_file.status == 'restoring':
            # Mark as restored (simulated). In real impl, verify Glacier retrieval completion
            media_file.status = 'restored'
            media_file.save(update_fields=['status'])

            job.status = 'completed'
            job.progress = 100
            job.completed_at = now
            job.save(update_fields=['status', 'progress', 'completed_at'])
            updated += 1

    return updated


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


