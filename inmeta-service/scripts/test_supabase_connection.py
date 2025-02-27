"""
Script para testar a conexão com o Supabase
"""
import asyncio
import os
import sys
import json
from pathlib import Path

# Adicionar o diretório raiz ao path para importar os módulos da aplicação
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

from app.services.supabase import SupabaseService
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("test_supabase")

async def test_connection():
    """Testa a conexão com o Supabase"""
    logger.info("Iniciando teste de conexão com o Supabase")
    logger.info(f"URL: {settings.SUPABASE_URL}")
    logger.info(f"Modo de simulação: {settings.USE_MOCK}")
    
    # Criar serviço Supabase
    supabase = SupabaseService(
        url=settings.SUPABASE_URL,
        key=settings.SUPABASE_KEY,
        use_mock=settings.USE_MOCK
    )
    
    try:
        # Testar conexão
        connection_info = await supabase.check_connection()
        logger.info(f"Resultado da conexão: {json.dumps(connection_info, indent=2, default=str)}")
        
        # Listar tabelas
        if connection_info.get("status") == "connected" or settings.USE_MOCK:
            tables = await supabase.list_tables()
            logger.info(f"Tabelas encontradas: {json.dumps(tables, indent=2, default=str)}")
            
            # Verificar estrutura de tabelas
            for table in tables:
                table_name = table.get("name")
                logger.info(f"Obtendo estrutura da tabela {table_name}")
                structure = await supabase.get_table_structure(table_name)
                logger.info(f"Estrutura da tabela {table_name}: {json.dumps(structure, indent=2, default=str)}")
        
        return True
    except Exception as e:
        logger.error(f"Erro ao testar conexão com o Supabase: {str(e)}")
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
