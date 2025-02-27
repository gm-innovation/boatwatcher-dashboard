"""
Serviço para integração entre projetos e eventos
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

from app.services.inmeta import InmetaService
from app.services.supabase import SupabaseService
from app.models.project import Project, ProjectWithEvents
from app.core.config import settings

logger = logging.getLogger(__name__)

class ProjectEventsService:
    """
    Serviço para integração entre projetos e eventos
    """
    def __init__(
        self,
        inmeta_service: InmetaService,
        supabase_service: SupabaseService,
        use_mock: bool = None
    ):
        """Inicializa o serviço de integração"""
        self.inmeta_service = inmeta_service
        self.supabase_service = supabase_service
        self.use_mock = use_mock if use_mock is not None else settings.USE_MOCK
        self._cache: Dict[str, Any] = {}
    
    async def get_project_with_events(
        self,
        project_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        force_refresh: bool = False
    ) -> Optional[ProjectWithEvents]:
        """
        Obtém um projeto com seus eventos associados
        
        Args:
            project_id: ID do projeto
            start_date: Data inicial para filtrar eventos
            end_date: Data final para filtrar eventos
            force_refresh: Forçar atualização do cache
            
        Returns:
            Projeto com eventos ou None se não encontrado
        """
        # Verificar cache
        cache_key = f"project_events_{project_id}"
        if not force_refresh and cache_key in self._cache:
            logger.info(f"Usando cache para projeto com eventos {project_id}")
            return self._cache[cache_key]
        
        # Obter projeto
        project_result = await self.supabase_service.get_project(project_id, force_refresh)
        if not project_result or not project_result.get("project"):
            return None
        
        project = project_result["project"]
        
        # Definir período padrão se não fornecido
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Obter eventos
        if self.use_mock:
            from app.services.mock_data import generate_mock_events, get_mock_project_events_summary
            events_summary = get_mock_project_events_summary(project_id)
        else:
            # Buscar eventos do Inmeta
            events = await self.inmeta_service.get_access_events(
                start_date=start_date,
                end_date=end_date,
                project_id=project.inmeta_id if project.inmeta_id else None
            )
            
            # Processar eventos
            events_summary = self._process_events(events)
        
        # Criar objeto ProjectWithEvents
        project_with_events = ProjectWithEvents(
            **project.dict(),
            events_count=events_summary.get("total_events", 0),
            last_event_date=events_summary.get("last_event"),
            events_summary=events_summary
        )
        
        # Armazenar no cache
        self._cache[cache_key] = project_with_events
        
        return project_with_events
    
    async def get_projects_with_events(
        self,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[str] = None,
        client: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Obtém lista de projetos com resumo de eventos
        
        Args:
            skip: Número de registros para pular
            limit: Número máximo de registros
            search: Termo de busca
            status: Filtro por status
            client: Filtro por cliente
            force_refresh: Forçar atualização do cache
            
        Returns:
            Dicionário com lista de projetos e metadados
        """
        # Verificar cache
        cache_key = f"projects_events_list_{skip}_{limit}_{search}_{status}_{client}"
        if not force_refresh and cache_key in self._cache:
            logger.info(f"Usando cache para lista de projetos com eventos")
            return self._cache[cache_key]
        
        # Obter projetos
        projects_result = await self.supabase_service.get_projects(
            skip=skip,
            limit=limit,
            search=search,
            status=status,
            client=client,
            force_refresh=force_refresh
        )
        
        projects = projects_result.get("projects", [])
        total = projects_result.get("total", 0)
        
        # Adicionar resumo de eventos para cada projeto
        projects_with_events = []
        for project in projects:
            if self.use_mock:
                from app.services.mock_data import get_mock_project_events_summary
                events_summary = get_mock_project_events_summary(project.id)
                
                project_with_events = ProjectWithEvents(
                    **project.dict(),
                    events_count=events_summary.get("total_events", 0),
                    last_event_date=events_summary.get("last_event"),
                    events_summary=events_summary
                )
            else:
                # Em produção, podemos fazer uma consulta otimizada para obter apenas os metadados
                # dos eventos, sem buscar todos os eventos para cada projeto
                project_with_events = await self.get_project_with_events(
                    project_id=project.id,
                    force_refresh=force_refresh
                )
            
            if project_with_events:
                projects_with_events.append(project_with_events)
        
        result = {
            "projects": projects_with_events,
            "total": total,
            "cached": False
        }
        
        # Armazenar no cache
        self._cache[cache_key] = result
        
        return result
    
    def _process_events(self, events: List[Any]) -> Dict[str, Any]:
        """
        Processa eventos para gerar resumo
        
        Args:
            events: Lista de eventos
            
        Returns:
            Resumo dos eventos
        """
        if not events:
            return {
                "total_events": 0,
                "event_types": {},
                "locations": {},
                "timeline": []
            }
        
        # Total de eventos
        total_events = len(events)
        
        # Contagem por tipo de evento
        event_types = {}
        for event in events:
            event_type = event.tipo
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        # Contagem por localização
        locations = {}
        for event in events:
            location = event.alvo
            locations[location] = locations.get(location, 0) + 1
        
        # Timeline simplificada (eventos por dia)
        timeline = {}
        for event in events:
            day = event.data.strftime("%Y-%m-%d")
            if day not in timeline:
                timeline[day] = {"date": day, "count": 0, "types": {}}
            
            timeline[day]["count"] += 1
            
            event_type = event.tipo
            if event_type not in timeline[day]["types"]:
                timeline[day]["types"][event_type] = 0
            timeline[day]["types"][event_type] += 1
        
        # Converte timeline para lista e ordena por data
        timeline_list = list(timeline.values())
        timeline_list.sort(key=lambda x: x["date"])
        
        # Último evento
        last_event = events[0].data if events else None
        
        return {
            "total_events": total_events,
            "event_types": event_types,
            "locations": locations,
            "timeline": timeline_list,
            "last_event": last_event
        }
