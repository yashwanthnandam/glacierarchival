from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def test_sentry(request):
    """
    Test endpoint to verify Sentry integration
    """
    try:
        if request.method == 'GET':
            # Test basic logging
            logger.info("Sentry test endpoint accessed")
            return JsonResponse({
                'status': 'success',
                'message': 'Sentry test endpoint working',
                'method': 'GET'
            })
        
        elif request.method == 'POST':
            # Test error capture
            logger.warning("Testing Sentry error capture")
            
            # This will trigger a Sentry error
            division_by_zero = 1 / 0
            
            return JsonResponse({
                'status': 'error',
                'message': 'This should not be reached'
            })
            
    except Exception as e:
        logger.error(f"Sentry test error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Error captured: {str(e)}'
        }, status=500)
