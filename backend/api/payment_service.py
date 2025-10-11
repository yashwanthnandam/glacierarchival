import razorpay
import hashlib
import hmac
import json
import logging
from django.conf import settings
from django.utils import timezone
from .models import Payment, HibernationPlan, UserHibernationPlan
from .payment_logger import PaymentLogger
from datetime import timedelta

logger = logging.getLogger(__name__)


class RazorpayService:
    """Service for handling Razorpay payments"""
    
    def __init__(self):
        self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    def create_order(self, amount_inr, currency='INR', receipt_prefix='hibernation_plan'):
        """Create a Razorpay order"""
        try:
            receipt = f"{receipt_prefix}_{int(timezone.now().timestamp())}"
            
            order_data = {
                'amount': int(amount_inr * 100),  # Convert to paise
                'currency': currency,
                'receipt': receipt,
                'notes': {
                    'service': 'hibernation_plan_subscription',
                    'environment': getattr(settings, 'ENVIRONMENT', 'development')
                }
            }
            
            logger.info(f"Creating Razorpay order: {order_data}")
            order = self.client.order.create(data=order_data)
            logger.info(f"Razorpay order created: {order['id']}")
            
            return order
            
        except Exception as e:
            logger.error(f"Failed to create Razorpay order: {str(e)}")
            raise Exception(f"Failed to create Razorpay order: {str(e)}")
    
    def verify_payment(self, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """Verify payment signature"""
        try:
            # Create signature verification string
            body = f"{razorpay_order_id}|{razorpay_payment_id}"
            
            # Generate expected signature
            expected_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Verify signature
            if hmac.compare_digest(expected_signature, razorpay_signature):
                return True
            else:
                return False
                
        except Exception as e:
            raise Exception(f"Payment verification failed: {str(e)}")
    
    def get_payment_details(self, payment_id):
        """Get payment details from Razorpay"""
        try:
            payment = self.client.payment.fetch(payment_id)
            return payment
        except Exception as e:
            raise Exception(f"Failed to fetch payment details: {str(e)}")


class PaymentService:
    """Service for managing payment flow"""
    
    def __init__(self, user):
        self.user = user
        self.razorpay_service = RazorpayService()
    
    def create_payment_order(self, plan_id, amount_inr):
        """Create a payment order for hibernation plan subscription"""
        try:
            # Get the plan
            plan = HibernationPlan.objects.get(id=plan_id, is_active=True)
            
            # Check if user already has an active plan
            existing_plan = UserHibernationPlan.objects.filter(
                user=self.user, 
                is_active=True
            ).first()
            
            if existing_plan:
                raise ValueError("User already has an active hibernation plan")
            
            # Create Razorpay order
            razorpay_order = self.razorpay_service.create_order(amount_inr)
            
            # Create payment record
            payment = Payment.objects.create(
                user=self.user,
                hibernation_plan=plan,
                razorpay_order_id=razorpay_order['id'],
                amount_inr=amount_inr,
                currency='INR',
                status='pending'
            )
            
            return {
                'payment_id': payment.id,
                'razorpay_order_id': razorpay_order['id'],
                'amount': razorpay_order['amount'],
                'currency': razorpay_order['currency'],
                'key_id': settings.RAZORPAY_KEY_ID,
                'plan': {
                    'id': plan.id,
                    'name': plan.get_name_display(),
                    'storage_tier': plan.get_storage_tier_display(),
                    'amount_inr': str(plan.annual_price_inr)
                }
            }
            
        except HibernationPlan.DoesNotExist:
            raise ValueError("Invalid hibernation plan")
        except Exception as e:
            raise Exception(f"Failed to create payment order: {str(e)}")
    
    def verify_and_complete_payment(self, payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """Verify payment and complete subscription"""
        try:
            # Get payment record
            payment = Payment.objects.get(
                id=payment_id,
                user=self.user,
                razorpay_order_id=razorpay_order_id,
                status='pending'
            )
            
            # Verify payment signature
            if not self.razorpay_service.verify_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature):
                payment.status = 'failed'
                payment.save()
                raise ValueError("Payment verification failed")
            
            # Get payment details from Razorpay
            razorpay_payment = self.razorpay_service.get_payment_details(razorpay_payment_id)
            
            if razorpay_payment['status'] != 'captured':
                payment.status = 'failed'
                payment.save()
                raise ValueError("Payment not captured")
            
            # Update payment record
            payment.razorpay_payment_id = razorpay_payment_id
            payment.razorpay_signature = razorpay_signature
            payment.status = 'success'
            payment.paid_at = timezone.now()
            payment.save()
            
            # Create user hibernation plan
            expires_at = timezone.now() + timedelta(days=365)  # 1 year subscription
            
            user_plan = UserHibernationPlan.objects.create(
                user=self.user,
                plan=payment.hibernation_plan,
                expires_at=expires_at,
                is_active=True
            )
            
            # Link payment to user plan
            payment.user_hibernation_plan = user_plan
            payment.save()
            
            return {
                'success': True,
                'payment_id': payment.id,
                'user_plan_id': user_plan.id,
                'plan': {
                    'id': user_plan.plan.id,
                    'name': user_plan.plan.get_name_display(),
                    'storage_tier': user_plan.plan.get_storage_tier_display(),
                    'expires_at': user_plan.expires_at.isoformat()
                }
            }
            
        except Payment.DoesNotExist:
            raise ValueError("Payment record not found")
        except Exception as e:
            # Mark payment as failed if verification fails
            try:
                payment = Payment.objects.get(id=payment_id, user=self.user)
                payment.status = 'failed'
                payment.save()
            except:
                pass
            raise Exception(f"Payment verification failed: {str(e)}")
    
    def get_payment_status(self, payment_id):
        """Get payment status"""
        try:
            payment = Payment.objects.get(id=payment_id, user=self.user)
            return {
                'payment_id': payment.id,
                'status': payment.status,
                'amount_inr': str(payment.amount_inr),
                'plan': {
                    'id': payment.hibernation_plan.id,
                    'name': payment.hibernation_plan.get_name_display(),
                    'storage_tier': payment.hibernation_plan.get_storage_tier_display()
                },
                'created_at': payment.created_at.isoformat(),
                'paid_at': payment.paid_at.isoformat() if payment.paid_at else None
            }
        except Payment.DoesNotExist:
            raise ValueError("Payment not found")
