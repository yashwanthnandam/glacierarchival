"""
Custom JWT Authentication Views with httpOnly Cookies
Provides secure token storage using httpOnly cookies to prevent XSS attacks
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.conf import settings
from django.middleware.csrf import get_token
from django.utils import timezone
from datetime import timedelta
import json

from .serializers import UserSerializer


class SecureCookieAuth:
    """Utility class for managing secure httpOnly cookies"""
    
    @staticmethod
    def set_access_token_cookie(response, access_token):
        """Set access token as httpOnly cookie"""
        response.set_cookie(
            'access_token',
            access_token,
            max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
            httponly=True,
            secure=not settings.DEBUG,  # Only secure in production
            samesite='Strict',
            path='/'
        )
    
    @staticmethod
    def set_refresh_token_cookie(response, refresh_token):
        """Set refresh token as httpOnly cookie"""
        response.set_cookie(
            'refresh_token',
            refresh_token,
            max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
            httponly=True,
            secure=not settings.DEBUG,  # Only secure in production
            samesite='Strict',
            path='/'
        )
    
    @staticmethod
    def clear_auth_cookies(response):
        """Clear all authentication cookies"""
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        response.delete_cookie('csrftoken', path='/')
    
    @staticmethod
    def get_token_from_cookie(request, token_name):
        """Get token from httpOnly cookie"""
        return request.COOKIES.get(token_name)


@api_view(['POST'])
@permission_classes([AllowAny])
def secure_login(request):
    """
    Custom login endpoint that stores JWT tokens in httpOnly cookies
    """
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Authenticate user
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response({
                'error': 'Invalid username or password'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return Response({
                'error': 'Account is not active. Please verify your email.'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        # Create response
        response = Response({
            'message': 'Login successful',
            'user': UserSerializer(user).data,
            'csrf_token': get_token(request)  # Include CSRF token for cookie-based auth
        }, status=status.HTTP_200_OK)
        
        # Set httpOnly cookies
        SecureCookieAuth.set_access_token_cookie(response, access_token)
        SecureCookieAuth.set_refresh_token_cookie(response, refresh_token)
        
        return response
        
    except Exception as e:
        return Response({
            'error': 'Login failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def secure_refresh(request):
    """
    Custom refresh endpoint that works with httpOnly cookies
    """
    try:
        # Get refresh token from cookie
        refresh_token = SecureCookieAuth.get_token_from_cookie(request, 'refresh_token')
        
        if not refresh_token:
            return Response({
                'error': 'No refresh token found'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Validate and refresh token
        try:
            refresh = RefreshToken(refresh_token)
            new_access_token = str(refresh.access_token)
            
            # Create response
            response = Response({
                'message': 'Token refreshed successfully',
                'csrf_token': get_token(request)
            }, status=status.HTTP_200_OK)
            
            # Set new access token cookie
            SecureCookieAuth.set_access_token_cookie(response, new_access_token)
            
            return response
            
        except TokenError:
            # Invalid refresh token, clear cookies
            response = Response({
                'error': 'Invalid refresh token'
            }, status=status.HTTP_401_UNAUTHORIZED)
            SecureCookieAuth.clear_auth_cookies(response)
            return response
            
    except Exception as e:
        return Response({
            'error': 'Token refresh failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def secure_logout(request):
    """
    Custom logout endpoint that clears httpOnly cookies
    """
    try:
        # Get refresh token from cookie to blacklist it
        refresh_token = SecureCookieAuth.get_token_from_cookie(request, 'refresh_token')
        
        if refresh_token:
            try:
                # Blacklist the refresh token
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                # Token is already invalid, continue with logout
                pass
        
        # Create response
        response = Response({
            'message': 'Logout successful'
        }, status=status.HTTP_200_OK)
        
        # Clear all auth cookies
        SecureCookieAuth.clear_auth_cookies(response)
        
        return response
        
    except Exception as e:
        return Response({
            'error': 'Logout failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def secure_user_info(request):
    """
    Get current user information (works with cookie-based auth)
    """
    try:
        user_data = UserSerializer(request.user).data
        return Response({
            'user': user_data,
            'csrf_token': get_token(request)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'error': 'Failed to get user information'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def secure_register(request):
    """
    Custom registration endpoint that works with cookie-based auth
    """
    try:
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.is_active = False  # User must verify email before activation
            user.save()
            
            # Create email verification
            from .models import EmailVerification
            from .services import EmailService
            
            verification = EmailVerification.objects.create(user=user)
            
            # Send verification email
            try:
                EmailService.send_verification_email(user, verification.token, request)
                return Response({
                    'message': 'Registration successful. Please check your email to verify your account.',
                    'user_id': user.id
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'error': 'Registration successful but failed to send verification email. Please contact support.'
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
        
    except Exception as e:
        return Response({
            'error': 'Registration failed. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
