"""
Dependências para injeção no FastAPI
"""
from typing import Generator, Optional
import logging

from app.services.inmeta import InmetaService
from app.services.supabase import SupabaseService
from app.services.project_events import ProjectEventsService
from app.core.config import settings

logger = logging.getLogger(__name__)

# Serviços singleton
_inmeta_service: Optional[InmetaService] = None
_supabase_service: Optional[SupabaseService] = None
_project_events_service: Optional[ProjectEventsService] = None


def get_inmeta_service() -> InmetaService:
    """
    Retorna uma instância do serviço Inmeta
    """
    global _inmeta_service
    if _inmeta_service is None:
        logger.info("Inicializando InmetaService")
        _inmeta_service = InmetaService(
            api_url=settings.INMETA_API_URL,
            email=settings.INMETA_EMAIL,
            password=settings.INMETA_PASSWORD,
            use_mock=settings.USE_MOCK
        )
    return _inmeta_service


def get_supabase_service() -> SupabaseService:
    """
    Retorna uma instância do serviço Supabase
    """
    global _supabase_service
    if _supabase_service is None:
        logger.info("Inicializando SupabaseService")
        _supabase_service = SupabaseService(
            url=settings.SUPABASE_URL,
            key=settings.SUPABASE_KEY,
            use_mock=settings.USE_MOCK,
            cache_ttl=settings.CACHE_TTL
        )
    return _supabase_service


def get_project_events_service() -> ProjectEventsService:
    """
    Retorna uma instância do serviço de integração entre projetos e eventos
    """
    global _project_events_service
    if _project_events_service is None:
        logger.info("Inicializando ProjectEventsService")
        inmeta_service = get_inmeta_service()
        supabase_service = get_supabase_service()
        
        _project_events_service = ProjectEventsService(
            inmeta_service=inmeta_service,
            supabase_service=supabase_service,
            use_mock=settings.USE_MOCK
        )
    return _project_events_service
