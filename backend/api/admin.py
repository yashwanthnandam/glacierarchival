from django.contrib import admin
from django.utils.html import format_html
from celery.result import AsyncResult
from .models import MediaFile, S3Config, ArchiveJob, EmailVerification

@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'user', 'file_size', 'uploaded_at', 'status', 'is_deleted']
    list_filter = ['status', 'is_deleted', 'uploaded_at', 'user']
    search_fields = ['original_filename', 'user__username']
    readonly_fields = ['uploaded_at', 'checksum']

@admin.register(S3Config)
class S3ConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'bucket_name', 'region', 'created_at']
    list_filter = ['region', 'created_at']
    search_fields = ['user__username', 'bucket_name']

@admin.register(ArchiveJob)
class ArchiveJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'media_file', 'job_type', 'started_at', 'status']
    list_filter = ['status', 'job_type', 'started_at']
    search_fields = ['media_file__original_filename', 'user__username']

@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'verified', 'created_at', 'expires_at']
    list_filter = ['verified', 'created_at']
    search_fields = ['user__username']

# Custom admin for Celery tasks
class CeleryTaskAdmin(admin.ModelAdmin):
    list_display = ['task_id', 'task_name', 'status', 'created_at', 'progress_display']
    list_filter = ['status']
    search_fields = ['task_id', 'task_name']
    readonly_fields = ['task_id', 'task_name', 'status', 'created_at', 'result', 'progress_display']
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
    
    def progress_display(self, obj):
        if obj.status == 'PROGRESS':
            try:
                result = AsyncResult(obj.task_id)
                if result.state == 'PROGRESS':
                    meta = result.info
                    if isinstance(meta, dict) and 'current' in meta and 'total' in meta:
                        percentage = (meta['current'] / meta['total']) * 100
                        return format_html(
                            '<div style="width: 200px; background-color: #f0f0f0; border-radius: 3px;">'
                            '<div style="width: {}%; background-color: #4CAF50; height: 20px; border-radius: 3px; text-align: center; color: white; line-height: 20px;">'
                            '{:.1f}%</div></div>',
                            percentage, percentage
                        )
            except:
                pass
        return obj.status
    progress_display.short_description = "Progress"

# Register a custom admin view for Celery tasks
from django.contrib.admin import AdminSite
from django.http import JsonResponse
from django.urls import path

class CeleryTaskAdminSite(AdminSite):
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('celery-tasks/', self.celery_tasks_view, name='celery_tasks'),
        ]
        return custom_urls + urls
    
    def celery_tasks_view(self, request):
        """Custom view to display Celery tasks"""
        from celery import current_app
        from celery.result import AsyncResult
        
        # Get active tasks
        inspect = current_app.control.inspect()
        active_tasks = inspect.active()
        
        tasks_data = []
        if active_tasks:
            for worker, tasks in active_tasks.items():
                for task in tasks:
                    task_result = AsyncResult(task['id'])
                    tasks_data.append({
                        'task_id': task['id'],
                        'task_name': task['name'],
                        'status': task_result.status,
                        'worker': worker,
                        'args': task.get('args', []),
                        'kwargs': task.get('kwargs', {}),
                    })
        
        return JsonResponse({'tasks': tasks_data})

# Add custom admin site
celery_admin_site = CeleryTaskAdminSite(name='celery_admin')
# Don't register CeleryTaskAdmin as it's not a Django model
