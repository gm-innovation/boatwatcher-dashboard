"""
Script para testar a conexão com o Supabase
"""
import asyncio
import os
import sys
import json
import traceback
from pathlib import Path

# Adicionar o diretório raiz ao path para importar os módulos da aplicação
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

from app.services.supabase import SupabaseService
from app.core.config import settings
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_supabase")

async def test_connection():
    """Testa a conexão com o Supabase"""
    logger.info("Iniciando teste de conexão com o Supabase")
    logger.info(f"URL: {settings.SUPABASE_URL}")
    logger.info(f"Modo de simulação: {settings.USE_MOCK}")
    
    # Criar serviço Supabase
    try:
        supabase = SupabaseService(
            url=settings.SUPABASE_URL,
            key=settings.SUPABASE_KEY,
            use_mock=settings.USE_MOCK
        )
        
        # Testar conexão
        connection_info = await supabase.check_connection()
        logger.info(f"Resultado da conexão: {json.dumps(connection_info, indent=2, default=str)}")
        
        # Listar tabelas
        if connection_info.get("status") == "connected" or settings.USE_MOCK:
            tables = await supabase.list_tables()
            logger.info(f"Tabelas encontradas: {len(tables)}")
            
            for table in tables:
                logger.info(f"Tabela: {table}")
        
        return True
    except Exception as e:
        logger.error(f"Erro ao testar conexão com o Supabase: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Executar teste de conexão
    result = asyncio.run(test_connection())
    
    if result:
        logger.info("Teste de conexão com o Supabase concluído com sucesso")
        sys.exit(0)
    else:
        logger.error("Teste de conexão com o Supabase falhou")
        sys.exit(1)
