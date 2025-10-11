from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from api.admin import celery_admin_site

def api_root(request):
    return JsonResponse({
        'message': 'Glacier Archival API',
        'version': '1.0.0',
        'endpoints': {
            'admin': '/admin/',
            'api': '/api/',
        }
    })

urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('celery-admin/', celery_admin_site.urls),
    path('api/', include('api.urls')),
    path('api/uppy/', include('uppy_upload.urls')),
]

# Serve static files during development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
