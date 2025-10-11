from django.contrib import admin
from django.utils.html import format_html
from .models import UploadedFile, UploadSession

@admin.register(UploadedFile)
class UploadedFileAdmin(admin.ModelAdmin):
    list_display = ['original_name', 'user', 'file_size_mb', 'file_type', 'parent_directory', 'uploaded_at', 'is_processed']
    list_filter = ['is_processed', 'file_type', 'uploaded_at', 'user']
    search_fields = ['original_name', 'user__username', 'parent_directory', 'relative_path']
    readonly_fields = ['upload_id', 'uploaded_at', 'last_accessed', 'file_size_mb', 'file_url']
    fieldsets = (
        ('File Information', {
            'fields': ('user', 'file', 'original_name', 'file_size', 'file_type')
        }),
        ('Directory Structure', {
            'fields': ('relative_path', 'parent_directory', 'upload_session')
        }),
        ('Storage Information', {
            'fields': ('s3_key', 's3_etag'),
            'classes': ('collapse',)
        }),
        ('Processing Status', {
            'fields': ('is_processed', 'processing_error')
        }),
        ('Metadata', {
            'fields': ('upload_id', 'uploaded_at', 'last_accessed', 'file_size_mb', 'file_url'),
            'classes': ('collapse',)
        }),
    )
    
    def file_size_mb(self, obj):
        return f"{obj.file_size_mb} MB"
    file_size_mb.short_description = "File Size (MB)"
    
    def file_url(self, obj):
        if obj.file_url:
            return format_html('<a href="{}" target="_blank">View File</a>', obj.file_url)
        return "No file"
    file_url.short_description = "File URL"

@admin.register(UploadSession)
class UploadSessionAdmin(admin.ModelAdmin):
    list_display = ['session_id', 'user', 'status', 'total_files', 'uploaded_files', 'failed_files', 'progress_percent', 'created_at']
    list_filter = ['status', 'created_at', 'user']
    search_fields = ['session_id', 'user__username', 'root_directory']
    readonly_fields = ['session_id', 'created_at', 'progress_percent', 'duration']
    fieldsets = (
        ('Session Information', {
            'fields': ('user', 'session_id', 'status', 'root_directory')
        }),
        ('Upload Progress', {
            'fields': ('total_files', 'uploaded_files', 'failed_files', 'progress_percent')
        }),
        ('Directory Structure', {
            'fields': ('directory_structure',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'started_at', 'completed_at', 'duration'),
            'classes': ('collapse',)
        }),
        ('Error Handling', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
    )
    
    def progress_percent(self, obj):
        percent = obj.progress_percent
        color = 'green' if percent == 100 else 'orange' if percent > 0 else 'red'
        return format_html(
            '<span style="color: {};">{:.1f}%</span>',
            color, percent
        )
    progress_percent.short_description = "Progress"
    
    def duration(self, obj):
        duration = obj.duration
        if duration:
            total_seconds = int(duration.total_seconds())
            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            if hours > 0:
                return f"{hours}h {minutes}m {seconds}s"
            elif minutes > 0:
                return f"{minutes}m {seconds}s"
            else:
                return f"{seconds}s"
        return "In progress"
    duration.short_description = "Duration"
