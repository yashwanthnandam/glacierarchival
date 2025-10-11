import logging
from django.conf import settings
from django.utils import timezone
from .models import Payment

logger = logging.getLogger(__name__)

class PaymentLogger:
    """Utility class for payment logging and monitoring"""
    
    @staticmethod
    def log_payment_attempt(payment_id, plan_id, amount, user_id):
        """Log payment attempt"""
        logger.info(f"Payment attempt - ID: {payment_id}, Plan: {plan_id}, Amount: {amount}, User: {user_id}")
    
    @staticmethod
    def log_payment_success(payment_id, razorpay_payment_id, amount):
        """Log successful payment"""
        logger.info(f"Payment success - ID: {payment_id}, Razorpay ID: {razorpay_payment_id}, Amount: {amount}")
    
    @staticmethod
    def log_payment_failure(payment_id, error_message, amount):
        """Log failed payment"""
        logger.error(f"Payment failure - ID: {payment_id}, Error: {error_message}, Amount: {amount}")
    
    @staticmethod
    def log_webhook_event(event_type, payment_id, status):
        """Log webhook events"""
        logger.info(f"Webhook event - Type: {event_type}, Payment ID: {payment_id}, Status: {status}")
    
    @staticmethod
    def get_payment_stats():
        """Get payment statistics for monitoring"""
        try:
            total_payments = Payment.objects.count()
            successful_payments = Payment.objects.filter(status='success').count()
            failed_payments = Payment.objects.filter(status='failed').count()
            pending_payments = Payment.objects.filter(status='pending').count()
            
            success_rate = (successful_payments / total_payments * 100) if total_payments > 0 else 0
            
            return {
                'total_payments': total_payments,
                'successful_payments': successful_payments,
                'failed_payments': failed_payments,
                'pending_payments': pending_payments,
                'success_rate': round(success_rate, 2)
            }
        except Exception as e:
            logger.error(f"Error getting payment stats: {str(e)}")
            return None
