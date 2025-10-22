"""
Cache management utilities for the API application.

This module contains functions for managing user-specific cache invalidation,
versioning, and cleanup operations.
"""
import time
from django.core.cache import cache

# Cache configuration constants
CACHE_TIMEOUTS = {
    'files_list': 300,        # 5 minutes
    'folder_structure': 600,  # 10 minutes  
    'user_version': 86400,    # 24 hours
    'cost_snapshot': 3600,    # 1 hour
}


def atomic_cache_version_increment(user_id):
    """
    Atomically increment cache version for a user to prevent race conditions.
    Returns the new version number.
    """
    cache_version_key = f"user_cache_version_{user_id}"
    
    try:
        # Try atomic increment first (works with Redis)
        new_version = cache.incr(cache_version_key)
    except (AttributeError, TypeError):
        # Fallback for non-Redis backends - use get-set-check pattern
        max_retries = 5
        for attempt in range(max_retries):
            current_version = cache.get(cache_version_key, 0)
            new_version = current_version + 1
            
            # Try to set only if version hasn't changed
            if cache.add(f"{cache_version_key}_lock", "1", 1):  # 1 second lock
                try:
                    # Double-check version hasn't changed
                    check_version = cache.get(cache_version_key, 0)
                    if check_version == current_version:
                        cache.set(cache_version_key, new_version, CACHE_TIMEOUTS['user_version'])
                        break
                    else:
                        # Version changed, retry
                        current_version = check_version
                        new_version = current_version + 1
                        cache.set(cache_version_key, new_version, CACHE_TIMEOUTS['user_version'])
                        break
                finally:
                    cache.delete(f"{cache_version_key}_lock")
            else:
                # Lock failed, wait and retry
                time.sleep(0.01 * (attempt + 1))
        else:
            # Max retries exceeded, use simple increment
            current_version = cache.get(cache_version_key, 0)
            new_version = current_version + 1
            cache.set(cache_version_key, new_version, CACHE_TIMEOUTS['user_version'])
    
    return new_version


def clear_user_cache_patterns(user_id):
    """
    Clear all cache patterns for a user using dynamic pattern matching.
    This is a secondary cleanup after cache versioning.
    """
    try:
        # Define cache key patterns for this user
        patterns_to_clear = [
            # File listing patterns
            f"files_{user_id}_*",
            f"folder_structure_{user_id}*",
            f"cost_snapshot:{user_id}*",
            
            # Rate limiting patterns
            f"rate_limit_{user_id}_*",
            f"rate_limit_user_{user_id}*",
            f"concurrent_uploads_{user_id}*",
            
            # Any other user-specific patterns
            f"*_{user_id}_*",
        ]
        
        # For Redis backend, use pattern deletion
        if hasattr(cache, 'delete_pattern'):
            # Redis supports pattern deletion
            for pattern in patterns_to_clear:
                try:
                    cache.delete_pattern(pattern)
                    print(f"Cleared cache pattern: {pattern}")
                except Exception as e:
                    print(f"Failed to clear pattern {pattern}: {e}")
        else:
            # For non-Redis backends, clear known specific keys
            specific_keys = [
                f"folder_structure_{user_id}",
                f"cost_snapshot:{user_id}",
                f"rate_limit_{user_id}_upload",
                f"rate_limit_{user_id}_file_ops",
                f"concurrent_uploads_{user_id}",
            ]
            
            # Add common file listing variations
            common_variations = [
                f"files_{user_id}_root__true_1_50",
                f"files_{user_id}_root__true_1_100",
                f"files_{user_id}_root__false",
                f"files_{user_id}_root__true_1_25",
                f"files_{user_id}_root__true_2_50",
                f"files_{user_id}_root__true_2_100",
            ]
            
            specific_keys.extend(common_variations)
            
            # Clear specific keys
            cache.delete_many(specific_keys)
            print(f"Cleared {len(specific_keys)} specific cache keys for user {user_id}")
            
    except Exception as e:
        print(f"Cache pattern clearing error for user {user_id}: {e}")


def invalidate_user_cache(user_id, reason="general"):
    """
    Comprehensive cache invalidation for a user.
    This is the main function to call when user data changes.
    """
    try:
        # Primary: Increment cache version (invalidates ALL cached data)
        new_version = atomic_cache_version_increment(user_id)
        print(f"Cache version incremented for user {user_id}: {new_version} (reason: {reason})")
        
        # Secondary: Clear specific patterns for immediate cleanup
        clear_user_cache_patterns(user_id)
        
        return new_version
        
    except Exception as e:
        print(f"Cache invalidation error for user {user_id}: {e}")
        return None
