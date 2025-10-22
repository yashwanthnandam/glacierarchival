"""
Utility functions for the API
"""
import hashlib
import os
from typing import List, Dict, Any
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from .constants import MAX_FILE_SIZE


def validate_file_size(file_size: int) -> bool:
    """Validate file size against maximum allowed size"""
    return file_size <= MAX_FILE_SIZE


def calculate_file_checksum(file) -> str:
    """Calculate SHA256 checksum of a file"""
    file.seek(0)
    hash_sha256 = hashlib.sha256()
    for chunk in iter(lambda: file.read(4096), b""):
        hash_sha256.update(chunk)
    file.seek(0)  # Reset file pointer to beginning
    return hash_sha256.hexdigest()


def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.2f} {size_names[i]}"


def validate_email_address(email: str) -> bool:
    """Validate email address format"""
    try:
        validate_email(email)
        return True
    except ValidationError:
        return False


def invalidate_user_cache(user_id: int, reason: str = None) -> None:
    """Invalidate user-specific cache entries"""
    from django.core.cache import cache
    cache_patterns = [
        f"files_{user_id}_*",
        f"user_files_{user_id}_*",
        f"user_folders_{user_id}_*",
        f"user_stats_{user_id}_*",
    ]
    
    # Clear cache entries matching patterns
    for pattern in cache_patterns:
        try:
            cache.delete_many(cache.keys(pattern))
        except Exception:
            # If pattern matching fails, just continue
            pass
    
    # Also increment cache version to invalidate all cached queries
    try:
        current_version = cache.get(f"user_cache_version_{user_id}", 0)
        cache.set(f"user_cache_version_{user_id}", current_version + 1, 86400)
    except Exception:
        pass


def sanitize_filename(filename: str) -> str:
    """Sanitize filename by removing dangerous characters"""
    # Remove path separators and other dangerous characters
    dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    # Limit filename length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename


def get_file_type_category(file_type: str) -> str:
    """Get file type category (image, video, document, etc.)"""
    file_type = file_type.lower()
    
    if file_type.startswith('image/'):
        return 'image'
    elif file_type.startswith('video/'):
        return 'video'
    elif file_type.startswith('audio/'):
        return 'audio'
    elif file_type in ['application/pdf']:
        return 'document'
    elif file_type.startswith('text/'):
        return 'text'
    elif 'zip' in file_type or 'rar' in file_type or 'tar' in file_type:
        return 'archive'
    else:
        return 'other'


def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """Split a list into chunks of specified size"""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]


def safe_get(dictionary: Dict, key: str, default: Any = None) -> Any:
    """Safely get value from dictionary with default"""
    return dictionary.get(key, default)


def is_valid_uuid(uuid_string: str) -> bool:
    """Check if string is a valid UUID"""
    try:
        import uuid
        uuid.UUID(uuid_string)
        return True
    except ValueError:
        return False
