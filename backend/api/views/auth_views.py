"""
Authentication views for user registration, email verification, and password management.

This module contains all authentication-related view functions including:
- User registration
- Email verification
- Password reset functionality
- User information retrieval
"""
import logging
from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import EmailVerification, PasswordResetToken
from ..serializers import UserSerializer
from ..services import EmailService
from ..constants import EMAIL_VERIFICATION_EXPIRY_HOURS

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    """Register a new user account"""
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        user.is_active = False  # User must verify email before activation
        user.save()
        
        # Create email verification
        verification = EmailVerification.objects.create(user=user)
        
        # Send verification email
        try:
            EmailService.send_verification_email(user, verification.token, request)
            return Response({
                'message': 'Registration successful. Please check your email to verify your account.',
                'user_id': user.id
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Failed to send verification email: {str(e)}")
            return Response({
                'error': f'Registration successful but failed to send verification email: {str(e)}. Please contact support.'
            }, status=status.HTTP_201_CREATED)
    
    # Format validation errors for better frontend handling
    error_messages = []
    for field, errors in serializer.errors.items():
        for error in errors:
            if field == 'email' and 'already exists' in str(error):
                error_messages.append('A user with this email already exists. Please use a different email.')
            elif field == 'username' and 'already exists' in str(error):
                error_messages.append('A user with this username already exists. Please choose a different username.')
            elif field == 'password':
                error_messages.append(f'Password error: {str(error)}')
            else:
                error_messages.append(f'{field.title()}: {str(error)}')
    
    return Response({
        'error': '; '.join(error_messages) if error_messages else 'Invalid registration data.',
        'details': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_email(request):
    """Verify user email with token"""
    token = request.data.get('token')
    if not token:
        return Response({'error': 'Token is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        verification = EmailVerification.objects.get(token=token)
        if verification.is_expired():
            return Response({'error': 'Verification token has expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        if verification.verified:
            return Response({'error': 'Email already verified'}, status=status.HTTP_400_BAD_REQUEST)
        
        verification.verified = True
        verification.user.is_active = True
        verification.user.save()
        verification.save()
        
        return Response({'message': 'Email verified successfully'}, status=status.HTTP_200_OK)
    except EmailVerification.DoesNotExist:
        return Response({'error': 'Invalid verification token'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def resend_verification(request):
    """Resend email verification"""
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        if user.is_active:
            return Response({'error': 'Email already verified'}, status=status.HTTP_400_BAD_REQUEST)
        
        verification, created = EmailVerification.objects.get_or_create(user=user)
        if not created:
            # Generate new token and reset expiry
            verification.token = get_random_string(32)
            verification.verified = False
            verification.expires_at = timezone.now() + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
            verification.save()
        
        EmailService.send_verification_email(user, verification.token, request)
        return Response({
            'message': 'Verification email sent. The link will be valid for 7 days.'
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def request_password_reset(request):
    """Request password reset - send reset email"""
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        
        # Create password reset token
        reset_token = PasswordResetToken.objects.create(user=user)
        
        # Send password reset email
        EmailService.send_password_reset_email(user, reset_token.token, request)
        
        return Response({
            'message': 'Password reset email sent successfully. Please check your email.'
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        # Don't reveal if email exists or not for security
        return Response({
            'message': 'If an account with this email exists, a password reset email has been sent.'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Failed to send password reset email: {str(e)}")
        return Response({'error': 'Failed to send password reset email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    """Reset password using token"""
    token = request.data.get('token')
    new_password = request.data.get('password')
    
    if not token or not new_password:
        return Response({'error': 'Token and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Find valid reset token
        reset_token = PasswordResetToken.objects.get(token=token, used=False)
        
        if reset_token.is_expired():
            return Response({'error': 'Reset token has expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update user password
        user = reset_token.user
        user.set_password(new_password)
        user.save()
        
        # Mark token as used
        reset_token.used = True
        reset_token.save()
        
        return Response({
            'message': 'Password reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)
        
    except PasswordResetToken.DoesNotExist:
        return Response({'error': 'Invalid or expired reset token'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to reset password: {str(e)}")
        return Response({'error': 'Failed to reset password'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user(request):
    """Get current user information"""
    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'email': request.user.email,
        'is_active': request.user.is_active
    })
