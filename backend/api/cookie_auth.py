"""
Custom JWT Authentication Backend for httpOnly Cookies
Handles authentication using tokens stored in httpOnly cookies
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that reads tokens from httpOnly cookies
    """
    
    def get_validated_token(self, raw_token):
        """
        Validates an encoded JSON web token and returns a validated token
        wrapper object.
        """
        messages = []
        for AuthToken in self.get_auth_token_classes():
            try:
                return AuthToken(raw_token)
            except TokenError as e:
                messages.append({'token_class': AuthToken.__name__,
                                'token_type': AuthToken.token_type,
                                'message': e.args[0]})

        raise InvalidToken({
            'detail': 'Given token not valid for any token type',
            'messages': messages,
        })
    
    def get_raw_token(self, header):
        """
        Extracts an unvalidated JSON web token from the given "Authorization"
        header value.
        """
        parts = header.split()

        if len(parts) != 2 or parts[0] != 'Bearer':
            return None

        return parts[1]
    
    def authenticate(self, request):
        """
        Returns a two-tuple of `User` and `Token` if authentication is
        successful. Otherwise returns `None`.
        """
        # First, try to get token from Authorization header (for API calls)
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                try:
                    validated_token = self.get_validated_token(raw_token)
                    return self.get_user(validated_token), validated_token
                except InvalidToken:
                    pass
        
        # If no header token, try to get token from httpOnly cookie
        raw_token = request.COOKIES.get('access_token')
        if raw_token is not None:
            try:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token
            except InvalidToken:
                # Token is invalid, clear the cookie
                logger.warning("Invalid token found in cookie, clearing cookie")
                return None
        
        return None


class CookieRefreshAuthentication(JWTAuthentication):
    """
    Custom JWT authentication for refresh token validation using cookies
    """
    
    def authenticate(self, request):
        """
        Returns a two-tuple of `User` and `Token` if authentication is
        successful. Otherwise returns `None`.
        """
        # Get refresh token from httpOnly cookie
        raw_token = request.COOKIES.get('refresh_token')
        if raw_token is not None:
            try:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token
            except InvalidToken:
                logger.warning("Invalid refresh token found in cookie")
                return None
        
        return None
