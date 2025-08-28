"""
Cache Manager for AI Matching Service
====================================

Manages caching with Redis fallback to in-memory cache for production flexibility.
"""

import logging
import json
import asyncio
from typing import Any, Optional, Dict
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class CacheManager:
    """Manages cache operations with Redis or in-memory fallback."""
    
    def __init__(self):
        self.redis_client = None
        self.in_memory_cache = {}
        self.cache_timestamps = {}
        self.is_initialized = False
        self.use_redis = False
    
    async def initialize(self):
        """Initialize cache - try Redis first, fallback to in-memory."""
        try:
            # Try Redis first
            try:
                import redis.asyncio as redis
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                await self.redis_client.ping()
                self.use_redis = True
                logger.info("✅ Redis cache connected")
            except Exception as redis_error:
                logger.info(f"Redis not available ({redis_error}), using in-memory cache")
                self.use_redis = False
            
            self.is_initialized = True
            logger.info("✅ Cache system initialized")
            
        except Exception as e:
            logger.error(f"Cache initialization failed: {str(e)}")
            # Fallback to in-memory
            self.use_redis = False
            self.is_initialized = True
            logger.info("✅ Using in-memory cache as fallback")
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.is_initialized:
            return None
        
        try:
            if self.use_redis and self.redis_client:
                value = await self.redis_client.get(key)
                if value:
                    return json.loads(value)
                return None
            else:
                # In-memory cache
                if key in self.in_memory_cache:
                    timestamp = self.cache_timestamps.get(key)
                    if timestamp and datetime.now() < timestamp:
                        return self.in_memory_cache[key]
                    else:
                        # Expired
                        del self.in_memory_cache[key]
                        if key in self.cache_timestamps:
                            del self.cache_timestamps[key]
                return None
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 3600):
        """Set value in cache."""
        if not self.is_initialized:
            return False
        
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.setex(key, ttl, json.dumps(value, default=str))
                return True
            else:
                # In-memory cache
                self.in_memory_cache[key] = value
                self.cache_timestamps[key] = datetime.now() + timedelta(seconds=ttl)
                
                # Clean old entries periodically
                if len(self.in_memory_cache) > 1000:
                    await self._cleanup_expired()
                    
                return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False
    
    async def _cleanup_expired(self):
        """Clean expired entries from in-memory cache."""
        now = datetime.now()
        expired_keys = [
            key for key, timestamp in self.cache_timestamps.items()
            if timestamp < now
        ]
        for key in expired_keys:
            self.in_memory_cache.pop(key, None)
            self.cache_timestamps.pop(key, None)
    
    async def health_check(self) -> bool:
        """Check cache health."""
        if not self.is_initialized:
            return False
        
        try:
            if self.use_redis and self.redis_client:
                await self.redis_client.ping()
            return True
        except:
            return False
    
    async def close(self):
        """Close cache connections."""
        if self.redis_client:
            await self.redis_client.close()
        self.in_memory_cache.clear()
        self.cache_timestamps.clear()
        logger.info("Cache connections closed")