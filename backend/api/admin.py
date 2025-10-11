from django.contrib import admin
from django.utils.html import format_html
# from celery.result import AsyncResult
from .models import (
    MediaFile, S3Config, ArchiveJob, EmailVerification,
    HibernationPlan, UserHibernationPlan, Payment
)

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

@admin.register(HibernationPlan)
class HibernationPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'storage_tier', 'storage_limit_gb', 'user_cost_inr', 'annual_price_inr', 'is_active']
    list_filter = ['name', 'storage_tier', 'is_active', 'created_at']
    search_fields = ['name', 'storage_tier', 'description']
    readonly_fields = ['created_at', 'updated_at', 'storage_size_bytes', 'monthly_cost_usd']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'storage_tier', 'description', 'is_active')
        }),
        ('Storage Configuration', {
            'fields': ('storage_limit_gb', 'aws_storage_type', 'aws_storage_class', 'restore_time_hours')
        }),
        ('Pricing', {
            'fields': ('user_cost_inr', 'monthly_price_inr', 'annual_price_inr', 'margin_inr')
        }),
        ('Retrieval Policy', {
            'fields': ('free_retrieval_gb', 'retrieval_period_months', 'retrieval_policy')
        }),
        ('User Experience', {
            'fields': ('user_message',)
        }),
        ('Computed Fields', {
            'fields': ('storage_size_bytes', 'monthly_cost_usd'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(UserHibernationPlan)
class UserHibernationPlanAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'is_active', 'subscribed_at', 'expires_at', 'storage_used_bytes']
    list_filter = ['is_active', 'plan__name', 'subscribed_at', 'expires_at']
    search_fields = ['user__username', 'user__email', 'plan__name']
    readonly_fields = ['subscribed_at', 'storage_used_percentage', 'retrieval_remaining_gb']
    fieldsets = (
        ('Subscription Details', {
            'fields': ('user', 'plan', 'is_active', 'subscribed_at', 'expires_at')
        }),
        ('Usage Statistics', {
            'fields': ('storage_used_bytes', 'storage_used_percentage', 'retrieval_used_gb', 'retrieval_remaining_gb')
        }),
        ('Retrieval Period', {
            'fields': ('retrieval_period_start',)
        }),
    )
    
    def storage_used_percentage(self, obj):
        if obj.plan and obj.plan.storage_size_bytes > 0:
            percentage = (obj.storage_used_bytes / obj.plan.storage_size_bytes) * 100
            return f"{percentage:.1f}%"
        return "0%"
    storage_used_percentage.short_description = "Storage Used %"
    
    def retrieval_remaining_gb(self, obj):
        if obj.plan and obj.plan.free_retrieval_gb > 0:
            remaining = obj.plan.free_retrieval_gb - float(obj.retrieval_used_gb)
            return f"{remaining:.1f} GB"
        return "Unlimited"
    retrieval_remaining_gb.short_description = "Retrieval Remaining"

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'hibernation_plan', 'amount_inr', 'status', 'payment_method', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at', 'paid_at']
    search_fields = ['user__username', 'user__email', 'hibernation_plan__name', 'razorpay_order_id', 'razorpay_payment_id']
    readonly_fields = ['created_at', 'updated_at', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']
    fieldsets = (
        ('Payment Details', {
            'fields': ('user', 'hibernation_plan', 'user_hibernation_plan', 'amount_inr', 'status', 'payment_method')
        }),
        ('Razorpay Information', {
            'fields': ('razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'paid_at'),
            'classes': ('collapse',)
        }),
    )

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
