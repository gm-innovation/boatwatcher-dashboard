from typing import Optional, Literal
import os
import logging
from pydantic import BaseModel, Field

class Settings(BaseModel):
    # API Config
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Inmeta Service"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # Environment
    ENVIRONMENT: Literal["development", "staging", "production"] = os.getenv("ENVIRONMENT", "development")
    
    # Server Config
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Logging
    LOG_LEVEL: int = Field(
        default_factory=lambda: getattr(logging, os.getenv("LOG_LEVEL", "INFO"))
    )
    
    # Inmeta API
    INMETA_API_URL: str = os.getenv("INMETA_API_URL", "https://api.homologacao.inmeta.com.br")
    INMETA_EMAIL: str = os.getenv("INMETA_EMAIL", "googlemarine@teste.com.br")
    INMETA_PASSWORD: str = os.getenv("INMETA_PASSWORD", "rXYAYKSUI8EExfM")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://your-supabase-url.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "your-supabase-key")
    
    # Modo de simulação
    USE_MOCK: bool = os.getenv("USE_MOCK", "true").lower() in ("true", "1", "t")
    
    # Redis (opcional)
    REDIS_ENABLED: bool = os.getenv("REDIS_ENABLED", "False").lower() in ("true", "1", "t")
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL")
    
    # Cache
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", "3600"))  # 1 hora em segundos
    
    # Request ID
    REQUEST_ID_HEADER: str = "X-Request-ID"
    
    class Config:
        case_sensitive = True

settings = Settings()
