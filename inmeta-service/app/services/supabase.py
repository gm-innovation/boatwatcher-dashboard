"""
Serviço para integração com o Supabase
"""
import os
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

import httpx
from supabase import create_client, Client

from app.core.config import settings
from app.models.project import Project, ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)

class SupabaseService:
    """
    Serviço para integração com o Supabase
    """
    def __init__(self, url: str = None, key: str = None, use_mock: bool = None, cache_ttl: int = None):
        """Inicializa o serviço Supabase"""
        self.supabase_url = url or settings.SUPABASE_URL
        self.supabase_key = key or settings.SUPABASE_KEY
        self.use_mock = use_mock if use_mock is not None else settings.USE_MOCK
        self.cache_ttl = cache_ttl or settings.CACHE_TTL
        self._client: Optional[Client] = None
        self._cache: Dict[str, Any] = {}
        self.was_cached = False

    @property
    def client(self) -> Client:
        """Retorna o cliente Supabase, criando-o se necessário"""
        if self._client is None:
            self._client = create_client(self.supabase_url, self.supabase_key)
        return self._client

    async def get_projects(self) -> List[Project]:
        """
        Busca todos os projetos no Supabase
        
        Returns:
            List[Project]: Lista de projetos
        """
        self.was_cached = False
        
        # Verificar se devemos usar dados simulados
        if self.use_mock:
            from app.core.mock_data import gerar_projetos
            logger.info("Usando dados simulados para projetos")
            return gerar_projetos()
        
        # Verificar cache
        cache_key = "projects"
        if cache_key in self._cache:
            logger.info("Usando cache para projetos")
            self.was_cached = True
            return self._cache[cache_key]
        
        try:
            # Buscar projetos no Supabase
            response = self.client.table("projects").select("*").execute()
            
            if response.data:
                # Converter para objetos Project
                projects = [Project(**item) for item in response.data]
                
                # Armazenar no cache
                self._cache[cache_key] = projects
                
                return projects
            
            return []
        
        except Exception as e:
            logger.error(f"Erro ao buscar projetos no Supabase: {str(e)}")
            raise

    async def get_project(self, project_id: str) -> Optional[Project]:
        """
        Busca um projeto específico no Supabase
        
        Args:
            project_id (str): ID do projeto
            
        Returns:
            Optional[Project]: Projeto encontrado ou None
        """
        self.was_cached = False
        
        # Verificar se devemos usar dados simulados
        if self.use_mock:
            from app.core.mock_data import gerar_projetos
            logger.info(f"Usando dados simulados para projeto {project_id}")
            projects = gerar_projetos()
            for project in projects:
                if project.id == project_id:
                    return project
            return None
        
        # Verificar cache
        cache_key = f"project_{project_id}"
        if cache_key in self._cache:
            logger.info(f"Usando cache para projeto {project_id}")
            self.was_cached = True
            return self._cache[cache_key]
        
        try:
            # Buscar projeto no Supabase
            response = self.client.table("projects").select("*").eq("id", project_id).execute()
            
            if response.data and len(response.data) > 0:
                # Converter para objeto Project
                project = Project(**response.data[0])
                
                # Armazenar no cache
                self._cache[cache_key] = project
                
                return project
            
            return None
        
        except Exception as e:
            logger.error(f"Erro ao buscar projeto {project_id} no Supabase: {str(e)}")
            raise

    async def create_project(self, project: ProjectCreate) -> Project:
        """
        Cria um novo projeto no Supabase
        
        Args:
            project (ProjectCreate): Dados do projeto a ser criado
            
        Returns:
            Project: Projeto criado
        """
        if self.use_mock:
            logger.info("Usando dados simulados para criar projeto")
            # Simular criação de projeto
            from app.core.mock_data import gerar_projeto_id
            new_project = Project(
                id=gerar_projeto_id(),
                name=project.name,
                description=project.description,
                inmeta_id=project.inmeta_id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                **project.dict(exclude={"name", "description", "inmeta_id"})
            )
            return new_project
        
        try:
            # Criar projeto no Supabase
            data = project.dict()
            response = self.client.table("projects").insert(data).execute()
            
            if response.data and len(response.data) > 0:
                # Limpar cache
                self._clear_projects_cache()
                
                # Retornar projeto criado
                return Project(**response.data[0])
            
            raise Exception("Erro ao criar projeto no Supabase")
        
        except Exception as e:
            logger.error(f"Erro ao criar projeto no Supabase: {str(e)}")
            raise

    async def update_project(self, project_id: str, project: ProjectUpdate) -> Project:
        """
        Atualiza um projeto no Supabase
        
        Args:
            project_id (str): ID do projeto a ser atualizado
            project (ProjectUpdate): Dados do projeto a serem atualizados
            
        Returns:
            Project: Projeto atualizado
        """
        if self.use_mock:
            logger.info(f"Usando dados simulados para atualizar projeto {project_id}")
            # Simular atualização de projeto
            existing = await self.get_project(project_id)
            if not existing:
                raise Exception(f"Projeto {project_id} não encontrado")
            
            # Atualizar campos
            updated_data = {**existing.dict(), **project.dict(exclude_unset=True)}
            updated_data["updated_at"] = datetime.now()
            
            return Project(**updated_data)
        
        try:
            # Atualizar projeto no Supabase
            data = project.dict(exclude_unset=True)
            data["updated_at"] = datetime.now()
            
            response = self.client.table("projects").update(data).eq("id", project_id).execute()
            
            if response.data and len(response.data) > 0:
                # Limpar cache
                self._clear_project_cache(project_id)
                
                # Retornar projeto atualizado
                return Project(**response.data[0])
            
            raise Exception(f"Projeto {project_id} não encontrado")
        
        except Exception as e:
            logger.error(f"Erro ao atualizar projeto {project_id} no Supabase: {str(e)}")
            raise

    async def delete_project(self, project_id: str) -> bool:
        """
        Remove um projeto do Supabase
        
        Args:
            project_id (str): ID do projeto a ser removido
            
        Returns:
            bool: True se o projeto foi removido, False caso contrário
        """
        if self.use_mock:
            logger.info(f"Usando dados simulados para remover projeto {project_id}")
            # Simular remoção de projeto
            return True
        
        try:
            # Remover projeto do Supabase
            response = self.client.table("projects").delete().eq("id", project_id).execute()
            
            # Limpar cache
            self._clear_project_cache(project_id)
            
            return len(response.data) > 0
        
        except Exception as e:
            logger.error(f"Erro ao remover projeto {project_id} do Supabase: {str(e)}")
            raise

    def _clear_projects_cache(self):
        """Limpa o cache de projetos"""
        if "projects" in self._cache:
            del self._cache["projects"]

    def _clear_project_cache(self, project_id: str):
        """Limpa o cache de um projeto específico"""
        cache_key = f"project_{project_id}"
        if cache_key in self._cache:
            del self._cache[cache_key]

        # Também limpar cache de todos os projetos
        self._clear_projects_cache()

    async def check_connection(self) -> Dict[str, Any]:
        """
        Verifica a conexão com o Supabase
        
        Returns:
            Dict[str, Any]: Informações sobre a conexão
        """
        if self.use_mock:
            logger.info("Usando dados simulados para verificar conexão")
            return {
                "status": "mock_mode",
                "message": "Executando em modo de simulação. Sem conexão real com o Supabase."
            }
        
        try:
            # Tenta fazer uma consulta simples para verificar a conexão
            response = await self.client.rpc("get_service_status").execute()
            
            return {
                "status": "connected",
                "message": "Conexão com o Supabase estabelecida com sucesso",
                "data": response.data if hasattr(response, "data") else None
            }
        except Exception as e:
            # Tenta uma abordagem alternativa se a função RPC não existir
            try:
                # Tenta listar as tabelas
                response = await self.list_tables()
                return {
                    "status": "connected",
                    "message": "Conexão com o Supabase estabelecida com sucesso",
                    "tables_count": len(response)
                }
            except Exception as inner_e:
                logger.error(f"Erro ao verificar conexão com o Supabase: {str(inner_e)}")
                return {
                    "status": "error",
                    "message": f"Erro ao conectar com o Supabase: {str(e)}",
                    "details": str(inner_e)
                }

    async def list_tables(self) -> List[Dict[str, Any]]:
        """
        Lista as tabelas disponíveis no Supabase
        
        Returns:
            List[Dict[str, Any]]: Lista de tabelas
        """
        if self.use_mock:
            logger.info("Usando dados simulados para listar tabelas")
            return [
                {"name": "projects", "schema": "public", "estimated_row_count": 5},
                {"name": "events", "schema": "public", "estimated_row_count": 120},
                {"name": "users", "schema": "auth", "estimated_row_count": 10}
            ]
        
        try:
            # Consulta para listar as tabelas
            query = """
            SELECT 
                tablename as name,
                schemaname as schema,
                pg_total_relation_size(schemaname || '.' || tablename) as size_bytes,
                pg_stat_get_live_tuples(schemaname || '.' || tablename::regclass) as estimated_row_count
            FROM 
                pg_tables
            WHERE 
                schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY 
                schemaname, tablename;
            """
            
            response = await self.client.rpc("execute_sql", {"query": query}).execute()
            
            if hasattr(response, "data") and response.data:
                return response.data
            
            # Abordagem alternativa se a função RPC não existir
            # Tentar obter pelo menos as tabelas públicas
            tables = []
            schemas = ["public", "auth", "storage"]
            
            for schema in schemas:
                try:
                    # Tentar acessar uma tabela conhecida em cada schema
                    if schema == "public":
                        response = await self.client.table("projects").select("count(*)", count="exact").limit(1).execute()
                        tables.append({
                            "name": "projects",
                            "schema": schema,
                            "estimated_row_count": response.count if hasattr(response, "count") else 0
                        })
                except:
                    # Ignorar erros, apenas continuar tentando
                    pass
            
            return tables
            
        except Exception as e:
            logger.error(f"Erro ao listar tabelas do Supabase: {str(e)}")
            raise

    async def get_table_structure(self, table_name: str) -> Dict[str, Any]:
        """
        Obtém a estrutura de uma tabela específica
        
        Args:
            table_name (str): Nome da tabela
            
        Returns:
            Dict[str, Any]: Estrutura da tabela
        """
        if self.use_mock:
            logger.info(f"Usando dados simulados para estrutura da tabela {table_name}")
            
            if table_name == "projects":
                return {
                    "columns": [
                        {"name": "id", "type": "uuid", "is_nullable": False, "is_primary": True},
                        {"name": "name", "type": "text", "is_nullable": False},
                        {"name": "description", "type": "text", "is_nullable": True},
                        {"name": "inmeta_id", "type": "text", "is_nullable": True},
                        {"name": "location", "type": "text", "is_nullable": True},
                        {"name": "client", "type": "text", "is_nullable": True},
                        {"name": "status", "type": "text", "is_nullable": True},
                        {"name": "start_date", "type": "timestamp with time zone", "is_nullable": True},
                        {"name": "end_date", "type": "timestamp with time zone", "is_nullable": True},
                        {"name": "metadata", "type": "jsonb", "is_nullable": True},
                        {"name": "created_at", "type": "timestamp with time zone", "is_nullable": False},
                        {"name": "updated_at", "type": "timestamp with time zone", "is_nullable": False}
                    ],
                    "indexes": [
                        {"name": "projects_pkey", "columns": ["id"]},
                        {"name": "projects_inmeta_id_idx", "columns": ["inmeta_id"]}
                    ],
                    "sample_data": [
                        {
                            "id": "1",
                            "name": "Marina Itajaí",
                            "description": "Projeto de monitoramento da Marina Itajaí",
                            "inmeta_id": "marina-itajai-001"
                        }
                    ]
                }
            elif table_name == "events":
                return {
                    "columns": [
                        {"name": "id", "type": "uuid", "is_nullable": False, "is_primary": True},
                        {"name": "project_id", "type": "uuid", "is_nullable": False},
                        {"name": "timestamp", "type": "timestamp with time zone", "is_nullable": False},
                        {"name": "event_type", "type": "text", "is_nullable": False},
                        {"name": "location", "type": "text", "is_nullable": True},
                        {"name": "person_id", "type": "text", "is_nullable": True},
                        {"name": "details", "type": "jsonb", "is_nullable": True},
                        {"name": "created_at", "type": "timestamp with time zone", "is_nullable": False}
                    ],
                    "indexes": [
                        {"name": "events_pkey", "columns": ["id"]},
                        {"name": "events_project_id_idx", "columns": ["project_id"]},
                        {"name": "events_timestamp_idx", "columns": ["timestamp"]}
                    ],
                    "sample_data": []
                }
            else:
                return {
                    "error": f"Tabela {table_name} não encontrada nos dados simulados"
                }
        
        try:
            # Consulta para obter a estrutura da tabela
            columns_query = f"""
            SELECT 
                column_name as name,
                data_type as type,
                is_nullable = 'YES' as is_nullable,
                column_default as default_value,
                ordinal_position as position
            FROM 
                information_schema.columns
            WHERE 
                table_name = '{table_name}'
                AND table_schema = 'public'
            ORDER BY 
                ordinal_position;
            """
            
            # Consulta para obter as chaves primárias
            pk_query = f"""
            SELECT
                a.attname as column_name
            FROM
                pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE
                i.indrelid = '{table_name}'::regclass
                AND i.indisprimary;
            """
            
            # Consulta para obter os índices
            indexes_query = f"""
            SELECT
                i.relname as name,
                array_agg(a.attname) as columns
            FROM
                pg_class t,
                pg_class i,
                pg_index ix,
                pg_attribute a
            WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = '{table_name}'
            GROUP BY
                i.relname
            ORDER BY
                i.relname;
            """
            
            # Executar consultas
            columns_response = await self.client.rpc("execute_sql", {"query": columns_query}).execute()
            pk_response = await self.client.rpc("execute_sql", {"query": pk_query}).execute()
            indexes_response = await self.client.rpc("execute_sql", {"query": indexes_query}).execute()
            
            # Processar resultados
            columns = columns_response.data if hasattr(columns_response, "data") else []
            pk_columns = [row["column_name"] for row in pk_response.data] if hasattr(pk_response, "data") else []
            indexes = indexes_response.data if hasattr(indexes_response, "data") else []
            
            # Marcar colunas primárias
            for column in columns:
                column["is_primary"] = column["name"] in pk_columns
            
            # Obter amostra de dados
            sample_data_response = await self.client.table(table_name).select("*").limit(1).execute()
            sample_data = sample_data_response.data if hasattr(sample_data_response, "data") else []
            
            return {
                "columns": columns,
                "indexes": indexes,
                "sample_data": sample_data
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estrutura da tabela {table_name}: {str(e)}")
            
            # Tentar uma abordagem mais simples se a função RPC não estiver disponível
            try:
                # Apenas obter uma amostra de dados para inferir a estrutura
                sample_response = await self.client.table(table_name).select("*").limit(1).execute()
                
                if hasattr(sample_response, "data") and sample_response.data:
                    sample = sample_response.data[0]
                    columns = [{"name": key, "type": "unknown", "sample_value": value} for key, value in sample.items()]
                    
                    return {
                        "note": "Estrutura inferida a partir de dados de amostra (método limitado)",
                        "columns": columns,
                        "sample_data": [sample]
                    }
                else:
                    return {
                        "note": "Tabela existe, mas não foi possível obter estrutura detalhada ou dados de amostra",
                        "columns": []
                    }
            except Exception as inner_e:
                logger.error(f"Erro na abordagem alternativa para estrutura da tabela {table_name}: {str(inner_e)}")
                raise Exception(f"Não foi possível obter a estrutura da tabela {table_name}: {str(e)}")
