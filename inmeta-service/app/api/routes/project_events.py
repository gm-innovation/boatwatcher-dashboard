"""
Rotas para integração entre projetos e eventos
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from datetime import datetime, timedelta

from app.services.project_events import ProjectEventsService
from app.models.project import ProjectWithEvents
from app.core.dependencies import get_project_events_service

router = APIRouter()


@router.get("/{project_id}/events-summary", response_model=Dict[str, Any])
async def get_project_events_summary(
    project_id: str = Path(..., description="ID do projeto"),
    start_date: Optional[str] = Query(None, description="Data inicial (formato ISO)"),
    end_date: Optional[str] = Query(None, description="Data final (formato ISO)"),
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    project_events_service: ProjectEventsService = Depends(get_project_events_service)
):
    """
    Obtém um resumo dos eventos associados a um projeto
    """
    try:
        # Converter datas se fornecidas
        start_date_obj = None
        end_date_obj = None
        
        if start_date:
            start_date_obj = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        else:
            # Padrão: últimos 30 dias
            start_date_obj = datetime.now() - timedelta(days=30)
            
        if end_date:
            end_date_obj = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        else:
            # Padrão: data atual
            end_date_obj = datetime.now()
        
        # Obter projeto com eventos
        project_with_events = await project_events_service.get_project_with_events(
            project_id=project_id,
            start_date=start_date_obj,
            end_date=end_date_obj,
            force_refresh=force_refresh
        )
        
        if not project_with_events:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        return {
            "project_id": project_id,
            "project_name": project_with_events.name,
            "events_count": project_with_events.events_count,
            "last_event_date": project_with_events.last_event_date,
            "summary": project_with_events.events_summary,
            "period": {
                "start_date": start_date_obj.isoformat(),
                "end_date": end_date_obj.isoformat()
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato de data inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter resumo de eventos: {str(e)}")


@router.get("/with-events", response_model=Dict[str, Any])
async def list_projects_with_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    status: Optional[str] = None,
    client: Optional[str] = None,
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    project_events_service: ProjectEventsService = Depends(get_project_events_service)
):
    """
    Lista todos os projetos com resumo de eventos
    """
    try:
        result = await project_events_service.get_projects_with_events(
            skip=skip,
            limit=limit,
            search=search,
            status=status,
            client=client,
            force_refresh=force_refresh
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar projetos com eventos: {str(e)}")


@router.get("/{project_id}/with-events", response_model=ProjectWithEvents)
async def get_project_with_events(
    project_id: str = Path(..., description="ID do projeto"),
    start_date: Optional[str] = Query(None, description="Data inicial (formato ISO)"),
    end_date: Optional[str] = Query(None, description="Data final (formato ISO)"),
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    project_events_service: ProjectEventsService = Depends(get_project_events_service)
):
    """
    Obtém um projeto específico com seus eventos associados
    """
    try:
        # Converter datas se fornecidas
        start_date_obj = None
        end_date_obj = None
        
        if start_date:
            start_date_obj = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        
        if end_date:
            end_date_obj = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        
        # Obter projeto com eventos
        project_with_events = await project_events_service.get_project_with_events(
            project_id=project_id,
            start_date=start_date_obj,
            end_date=end_date_obj,
            force_refresh=force_refresh
        )
        
        if not project_with_events:
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        return project_with_events
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Formato de data inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter projeto com eventos: {str(e)}")
