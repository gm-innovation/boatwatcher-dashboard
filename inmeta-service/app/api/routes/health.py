from typing import Dict, Any
import platform
import time
import httpx
from fastapi import APIRouter, Depends, status, Response

from app.core.config import settings
from app.services.cache import RedisCache
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["health"])

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Verifica a saúde do serviço e suas dependências
    """
    start_time = time.time()
    
    # Inicializar resultado
    result = {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "timestamp": time.time(),
        "uptime": 0,  # Será calculado no final
        "system": {
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "dependencies": {
            "inmeta_api": {
                "status": "unknown",
                "url": settings.INMETA_API_URL
            },
            "redis": {
                "status": "disabled" if not settings.REDIS_ENABLED else "unknown",
                "enabled": settings.REDIS_ENABLED
            }
        }
    }
    
    # Verificar Redis se habilitado
    if settings.REDIS_ENABLED:
        try:
            cache = RedisCache()
            redis_health = await cache.health_check()
            result["dependencies"]["redis"] = redis_health
        except Exception as e:
            logger.error(f"Error checking Redis health: {str(e)}")
            result["dependencies"]["redis"]["status"] = "error"
            result["dependencies"]["redis"]["error"] = str(e)
    
    # Verificar API do Inmeta
    try:
        async with httpx.AsyncClient(verify=False, timeout=5.0) as client:
            response = await client.get(f"{settings.INMETA_API_URL}/api/v1/health")
            if response.status_code == 200:
                result["dependencies"]["inmeta_api"]["status"] = "healthy"
            else:
                result["dependencies"]["inmeta_api"]["status"] = "unhealthy"
                result["dependencies"]["inmeta_api"]["status_code"] = response.status_code
    except Exception as e:
        logger.error(f"Error checking Inmeta API health: {str(e)}")
        result["dependencies"]["inmeta_api"]["status"] = "error"
        result["dependencies"]["inmeta_api"]["error"] = str(e)
    
    # Verificar status geral
    if any(dep["status"] not in ["healthy", "disabled"] for dep in result["dependencies"].values()):
        result["status"] = "degraded"
    
    # Calcular tempo de resposta
    result["response_time"] = time.time() - start_time
    
    return result
