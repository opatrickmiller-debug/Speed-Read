"""
Redis Cache Utility Module

Provides async Redis caching for the food search system with:
- Connection pooling
- Automatic JSON serialization/deserialization
- TTL management
- Graceful fallback when Redis is unavailable

Cache Key Formats:
- Search results: food_search:{normalized_query}
- Food details: food:{source}:{id}

TTL Settings:
- Search results: 24 hours (86400 seconds)
- Food details: 7 days (604800 seconds)
"""

import json
import hashlib
import logging
import os
from typing import Any, Optional, Union
from datetime import timedelta

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

logger = logging.getLogger(__name__)


class CacheTTL:
    """Cache Time-To-Live constants in seconds"""
    SEARCH_RESULTS = 86400      # 24 hours
    FOOD_DETAILS = 604800       # 7 days
    USER_LOGGED_FOODS = 3600    # 1 hour
    POPULARITY_SCORES = 1800    # 30 minutes


class CacheKeys:
    """Cache key format helpers"""
    
    @staticmethod
    def search(normalized_query: str) -> str:
        """
        Generate cache key for search results.
        Uses MD5 hash for long queries to keep key length reasonable.
        
        Format: food_search:{query_or_hash}
        """
        if len(normalized_query) > 100:
            # Hash long queries
            query_hash = hashlib.md5(normalized_query.encode()).hexdigest()
            return f"food_search:{query_hash}"
        # Sanitize query for Redis key (replace spaces with underscores)
        safe_query = normalized_query.replace(" ", "_").replace(":", "_")
        return f"food_search:{safe_query}"
    
    @staticmethod
    def food_detail(source: str, food_id: str) -> str:
        """
        Generate cache key for individual food details.
        
        Format: food:{source}:{id}
        """
        return f"food:{source}:{food_id}"
    
    @staticmethod
    def user_logged_foods(user_id: str) -> str:
        """Cache key for user's previously logged food IDs"""
        return f"user_logged:{user_id}"
    
    @staticmethod
    def popularity_scores() -> str:
        """Cache key for global popularity scores"""
        return "popularity_scores"


class RedisCache:
    """
    Async Redis cache client with automatic JSON serialization.
    
    Features:
    - Connection pooling for performance
    - Graceful degradation when Redis unavailable
    - Automatic JSON encoding/decoding
    - TTL management
    """
    
    def __init__(self):
        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._enabled = True
        self._connected = False
    
    async def connect(self) -> bool:
        """
        Initialize Redis connection pool.
        
        Returns True if connection successful, False otherwise.
        """
        if self._connected:
            return True
        
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        
        try:
            self._pool = ConnectionPool.from_url(
                redis_url,
                max_connections=20,
                decode_responses=True,
                socket_timeout=5.0,
                socket_connect_timeout=5.0
            )
            self._client = redis.Redis(connection_pool=self._pool)
            
            # Test connection
            await self._client.ping()
            self._connected = True
            logger.info(f"Redis connected: {redis_url}")
            return True
            
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            self._enabled = False
            self._connected = False
            return False
    
    async def disconnect(self):
        """Close Redis connection pool"""
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()
        self._connected = False
        logger.info("Redis disconnected")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache with automatic JSON deserialization.
        
        Returns None if key doesn't exist or on error.
        """
        if not self._enabled or not self._client:
            return None
        
        try:
            value = await self._client.get(key)
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError:
            # Return raw value if not JSON
            return value
        except Exception as e:
            logger.warning(f"Cache get error for {key}: {e}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: int = CacheTTL.SEARCH_RESULTS
    ) -> bool:
        """
        Set value in cache with automatic JSON serialization.
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds (default: 24 hours)
        
        Returns True if successful, False otherwise.
        """
        if not self._enabled or not self._client:
            return False
        
        try:
            json_value = json.dumps(value, default=str)
            await self._client.setex(key, ttl, json_value)
            return True
        except Exception as e:
            logger.warning(f"Cache set error for {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if not self._enabled or not self._client:
            return False
        
        try:
            await self._client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        Args:
            pattern: Redis key pattern (e.g., "food_search:*")
        
        Returns number of keys deleted.
        """
        if not self._enabled or not self._client:
            return 0
        
        try:
            keys = []
            async for key in self._client.scan_iter(match=pattern, count=100):
                keys.append(key)
            
            if keys:
                return await self._client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self._enabled or not self._client:
            return False
        
        try:
            return await self._client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Cache exists error for {key}: {e}")
            return False
    
    async def get_ttl(self, key: str) -> int:
        """Get remaining TTL for a key in seconds. Returns -1 if no TTL, -2 if key doesn't exist."""
        if not self._enabled or not self._client:
            return -2
        
        try:
            return await self._client.ttl(key)
        except Exception as e:
            logger.warning(f"Cache TTL error for {key}: {e}")
            return -2
    
    # ========================
    # High-level cache methods
    # ========================
    
    async def get_search_results(self, normalized_query: str) -> Optional[list]:
        """Get cached search results for a query"""
        key = CacheKeys.search(normalized_query)
        return await self.get(key)
    
    async def set_search_results(self, normalized_query: str, results: list) -> bool:
        """Cache search results for a query (24 hour TTL)"""
        key = CacheKeys.search(normalized_query)
        return await self.set(key, results, CacheTTL.SEARCH_RESULTS)
    
    async def get_food_detail(self, source: str, food_id: str) -> Optional[dict]:
        """Get cached food details"""
        key = CacheKeys.food_detail(source, food_id)
        return await self.get(key)
    
    async def set_food_detail(self, source: str, food_id: str, food_data: dict) -> bool:
        """Cache food details (7 day TTL)"""
        key = CacheKeys.food_detail(source, food_id)
        return await self.set(key, food_data, CacheTTL.FOOD_DETAILS)
    
    async def get_user_logged_foods(self, user_id: str) -> Optional[list]:
        """Get cached list of food IDs user has logged"""
        key = CacheKeys.user_logged_foods(user_id)
        return await self.get(key)
    
    async def set_user_logged_foods(self, user_id: str, food_ids: list) -> bool:
        """Cache user's logged food IDs (1 hour TTL)"""
        key = CacheKeys.user_logged_foods(user_id)
        return await self.set(key, food_ids, CacheTTL.USER_LOGGED_FOODS)
    
    async def invalidate_user_logged_foods(self, user_id: str) -> bool:
        """Invalidate user's logged foods cache when they log new food"""
        key = CacheKeys.user_logged_foods(user_id)
        return await self.delete(key)
    
    async def get_popularity_scores(self) -> Optional[dict]:
        """Get cached popularity scores"""
        key = CacheKeys.popularity_scores()
        return await self.get(key)
    
    async def set_popularity_scores(self, scores: dict) -> bool:
        """Cache popularity scores (30 minute TTL)"""
        key = CacheKeys.popularity_scores()
        return await self.set(key, scores, CacheTTL.POPULARITY_SCORES)
    
    # ========================
    # Cache stats
    # ========================
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        if not self._enabled or not self._client:
            return {"enabled": False, "connected": False}
        
        try:
            info = await self._client.info("stats")
            memory = await self._client.info("memory")
            
            return {
                "enabled": self._enabled,
                "connected": self._connected,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "memory_used": memory.get("used_memory_human", "N/A"),
                "total_keys": await self._client.dbsize()
            }
        except Exception as e:
            logger.warning(f"Cache stats error: {e}")
            return {"enabled": self._enabled, "connected": self._connected, "error": str(e)}


# Singleton instance
cache = RedisCache()


async def init_cache():
    """Initialize cache connection on app startup"""
    return await cache.connect()


async def close_cache():
    """Close cache connection on app shutdown"""
    await cache.disconnect()
