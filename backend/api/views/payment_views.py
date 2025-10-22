"""
Payment views for handling Razorpay payment processing and webhooks.

This module contains the PaymentViewSet with all payment-related functionality including:
- Payment order creation
- Payment verification
- Webhook handling for Razorpay events
- Payment statistics and status
"""
import json
import hmac
import hashlib
import logging
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Payment, UserHibernationPlan
from ..serializers import PaymentSerializer, CreatePaymentSerializer, VerifyPaymentSerializer
from ..payment_service import PaymentService

logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payments"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def create_order(self, request):
        """Create a payment order for hibernation plan subscription"""
        try:
            serializer = CreatePaymentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            plan_id = serializer.validated_data['plan_id']
            amount_inr = serializer.validated_data['amount_inr']
            
            payment_service = PaymentService(request.user)
            result = payment_service.create_payment_order(plan_id, amount_inr)
            
            return Response(result, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def verify_payment(self, request):
        """Verify payment and complete subscription"""
        try:
            serializer = VerifyPaymentSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            payment_id = request.data.get('payment_id')
            if not payment_id:
                return Response({'error': 'payment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            razorpay_order_id = serializer.validated_data['razorpay_order_id']
            razorpay_payment_id = serializer.validated_data['razorpay_payment_id']
            razorpay_signature = serializer.validated_data['razorpay_signature']
            
            payment_service = PaymentService(request.user)
            result = payment_service.verify_and_complete_payment(
                payment_id, razorpay_order_id, razorpay_payment_id, razorpay_signature
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def webhook(self, request):
        """Handle Razorpay webhook events"""
        try:
            # Get webhook signature
            razorpay_signature = request.headers.get('X-Razorpay-Signature')
            webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', settings.RAZORPAY_KEY_SECRET)
            
            if not razorpay_signature:
                return Response({'error': 'Missing signature'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify webhook signature
            body = request.body.decode('utf-8')
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(expected_signature, razorpay_signature):
                return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Parse webhook data
            webhook_data = json.loads(body)
            event_type = webhook_data.get('event')
            
            if event_type == 'payment.captured':
                self._handle_payment_captured(webhook_data)
            elif event_type == 'payment.failed':
                self._handle_payment_failed(webhook_data)
            elif event_type == 'order.paid':
                self._handle_order_paid(webhook_data)
            
            return Response({'status': 'success'})
            
        except Exception as e:
            # Log the error for debugging
            logger.error(f"Webhook error: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _handle_payment_captured(self, webhook_data):
        """Handle payment captured event"""
        try:
            payment_data = webhook_data.get('payload', {}).get('payment', {})
            razorpay_payment_id = payment_data.get('entity', {}).get('id')
            razorpay_order_id = payment_data.get('entity', {}).get('order_id')
            
            if razorpay_payment_id and razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id,
                    razorpay_payment_id__isnull=True
                ).first()
                
                if payment:
                    payment.razorpay_payment_id = razorpay_payment_id
                    payment.status = 'success'
                    payment.paid_at = timezone.now()
                    payment.save()
                    
                    # Create user hibernation plan if not exists
                    if not payment.user_hibernation_plan:
                        expires_at = timezone.now() + timedelta(days=365)
                        
                        user_plan = UserHibernationPlan.objects.create(
                            user=payment.user,
                            plan=payment.hibernation_plan,
                            expires_at=expires_at,
                            is_active=True
                        )
                        
                        payment.user_hibernation_plan = user_plan
                        payment.save()
                        
        except Exception as e:
            logger.error(f"Payment captured handler error: {str(e)}")
    
    def _handle_payment_failed(self, webhook_data):
        """Handle payment failed event"""
        try:
            payment_data = webhook_data.get('payload', {}).get('payment', {})
            razorpay_order_id = payment_data.get('entity', {}).get('order_id')
            
            if razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id
                ).first()
                
                if payment:
                    payment.status = 'failed'
                    payment.save()
                    
        except Exception as e:
            logger.error(f"Payment failed handler error: {str(e)}")
    
    def _handle_order_paid(self, webhook_data):
        """Handle order paid event"""
        try:
            order_data = webhook_data.get('payload', {}).get('order', {})
            razorpay_order_id = order_data.get('entity', {}).get('id')
            
            if razorpay_order_id:
                payment = Payment.objects.filter(
                    razorpay_order_id=razorpay_order_id
                ).first()
                
                if payment and payment.status == 'pending':
                    payment.status = 'success'
                    payment.paid_at = timezone.now()
                    payment.save()
                    
        except Exception as e:
            logger.error(f"Order paid handler error: {str(e)}")

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get payment statistics"""
        try:
            from ..payment_logger import PaymentLogger
            stats = PaymentLogger.get_payment_stats()
            
            if stats is None:
                return Response({'error': 'Failed to get payment stats'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response(stats)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get payment status"""
        try:
            payment_id = request.query_params.get('payment_id')
            if not payment_id:
                return Response({'error': 'payment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            payment_service = PaymentService(request.user)
            result = payment_service.get_payment_status(payment_id)
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
