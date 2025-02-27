"""
Rotas para diagnóstico e informações do Supabase
"""
from typing import Dict, List, Any
from fastapi import APIRouter, Depends, HTTPException

from app.services.supabase import SupabaseService
from app.core.dependencies import get_supabase_service
from app.core.config import settings

router = APIRouter()


@router.get("/connection", response_model=Dict[str, Any])
async def check_supabase_connection(
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Verifica a conexão com o Supabase e retorna informações básicas
    """
    try:
        # Tenta acessar o Supabase diretamente
        connection_info = await supabase_service.check_connection()
        return {
            "success": True,
            "connection_info": connection_info,
            "url": settings.SUPABASE_URL,
            "use_mock": settings.USE_MOCK
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": settings.SUPABASE_URL,
            "use_mock": settings.USE_MOCK
        }


@router.get("/tables", response_model=Dict[str, Any])
async def list_supabase_tables(
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Lista as tabelas disponíveis no Supabase
    """
    try:
        tables = await supabase_service.list_tables()
        return {
            "success": True,
            "tables": tables
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/tables/{table_name}", response_model=Dict[str, Any])
async def get_table_structure(
    table_name: str,
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Obtém a estrutura de uma tabela específica
    """
    try:
        structure = await supabase_service.get_table_structure(table_name)
        return {
            "success": True,
            "table_name": table_name,
            "structure": structure
        }
    except Exception as e:
        return {
            "success": False,
            "table_name": table_name,
            "error": str(e)
        }
