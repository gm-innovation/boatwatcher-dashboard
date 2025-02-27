import json
from typing import Any, Optional, Dict, List
import redis.asyncio as redis
from app.core.config import settings
from app.core.logging import get_logger
from app.core.exceptions import CacheError

logger = get_logger(__name__)

class RedisCache:
    def __init__(self):
        self.enabled = settings.REDIS_ENABLED
        self.url = settings.REDIS_URL
        self.redis = None
        
        if self.enabled and self.url:
            try:
                self.redis = redis.from_url(self.url)
                logger.info("Redis cache initialized", {"url": self.url})
            except Exception as e:
                logger.error(f"Failed to initialize Redis: {str(e)}", {"url": self.url})
                
    async def get(self, key: str) -> Optional[Any]:
        """Busca valor do cache"""
        if not self.enabled or not self.redis:
            return None
            
        try:
            value = await self.redis.get(key)
            if value:
                result = json.loads(value)
                logger.debug(f"Cache hit for key: {key}")
                return result
            logger.debug(f"Cache miss for key: {key}")
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON in cache for key: {key}", {"error": str(e)})
        except redis.RedisError as e:
            logger.error(f"Redis error when getting key: {key}", {"error": str(e)})
        except Exception as e:
            logger.exception(f"Unexpected error in cache.get: {str(e)}")
            
        return None
        
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Salva valor no cache com TTL"""
        if not self.enabled or not self.redis:
            return False
            
        try:
            serialized = json.dumps(value, default=str)
            await self.redis.setex(key, ttl, serialized)
            logger.debug(f"Set cache for key: {key} with TTL: {ttl}s")
            return True
        except TypeError as e:
            logger.warning(f"Failed to serialize value for key: {key}", {"error": str(e)})
        except redis.RedisError as e:
            logger.error(f"Redis error when setting key: {key}", {"error": str(e)})
        except Exception as e:
            logger.exception(f"Unexpected error in cache.set: {str(e)}")
            
        return False
            
    async def delete(self, key: str) -> bool:
        """Remove valor do cache"""
        if not self.enabled or not self.redis:
            return False
            
        try:
            result = await self.redis.delete(key)
            success = result > 0
            if success:
                logger.debug(f"Deleted cache key: {key}")
            return success
        except redis.RedisError as e:
            logger.error(f"Redis error when deleting key: {key}", {"error": str(e)})
        except Exception as e:
            logger.exception(f"Unexpected error in cache.delete: {str(e)}")
            
        return False
        
    async def flush_all(self) -> bool:
        """Limpa todo o cache"""
        if not self.enabled or not self.redis:
            return False
            
        try:
            await self.redis.flushall()
            logger.info("Flushed all cache")
            return True
        except redis.RedisError as e:
            logger.error(f"Redis error when flushing cache", {"error": str(e)})
        except Exception as e:
            logger.exception(f"Unexpected error in cache.flush_all: {str(e)}")
            
        return False
        
    async def health_check(self) -> Dict[str, Any]:
        """Verifica a saúde do Redis"""
        health_data = {
            "status": "disabled" if not self.enabled else "unknown",
            "enabled": self.enabled,
            "url": self.url if self.enabled else None,
        }
        
        if not self.enabled or not self.redis:
            return health_data
            
        try:
            await self.redis.ping()
            health_data["status"] = "healthy"
            return health_data
        except redis.RedisError as e:
            logger.error(f"Redis health check failed", {"error": str(e)})
            health_data["status"] = "unhealthy"
            health_data["error"] = str(e)
            return health_data
        except Exception as e:
            logger.exception(f"Unexpected error in cache health check: {str(e)}")
            health_data["status"] = "error"
            health_data["error"] = str(e)
            return health_data
