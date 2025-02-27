"""
Rotas para gerenciamento de projetos
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse

from app.models.project import Project, ProjectCreate, ProjectUpdate, ProjectList, ProjectDetail
from app.services.supabase import SupabaseService
from app.core.dependencies import get_supabase_service

router = APIRouter()


@router.get("/", response_model=ProjectList)
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    status: Optional[str] = None,
    client: Optional[str] = None,
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Lista todos os projetos com paginação e filtros opcionais
    """
    try:
        result = await supabase_service.get_projects(
            skip=skip,
            limit=limit,
            search=search,
            status=status,
            client=client,
            force_refresh=force_refresh
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar projetos: {str(e)}")


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(
    project_id: str = Path(..., description="ID do projeto"),
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Obtém um projeto específico pelo ID
    """
    try:
        result = await supabase_service.get_project(
            project_id=project_id,
            force_refresh=force_refresh
        )
        if not result or not result.get("project"):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter projeto: {str(e)}")


@router.post("/", response_model=Project, status_code=201)
async def create_project(
    project: ProjectCreate,
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Cria um novo projeto
    """
    try:
        result = await supabase_service.create_project(project)
        if not result:
            raise HTTPException(status_code=400, detail="Erro ao criar projeto")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar projeto: {str(e)}")


@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: str = Path(..., description="ID do projeto"),
    project_update: ProjectUpdate = None,
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Atualiza um projeto existente
    """
    try:
        # Verifica se o projeto existe
        existing = await supabase_service.get_project(project_id=project_id)
        if not existing or not existing.get("project"):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        # Atualiza o projeto
        result = await supabase_service.update_project(project_id, project_update)
        if not result:
            raise HTTPException(status_code=400, detail="Erro ao atualizar projeto")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar projeto: {str(e)}")


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str = Path(..., description="ID do projeto"),
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Remove um projeto existente
    """
    try:
        # Verifica se o projeto existe
        existing = await supabase_service.get_project(project_id=project_id)
        if not existing or not existing.get("project"):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        # Remove o projeto
        success = await supabase_service.delete_project(project_id)
        if not success:
            raise HTTPException(status_code=400, detail="Erro ao remover projeto")
        return JSONResponse(status_code=204, content={})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover projeto: {str(e)}")


@router.get("/{project_id}/events", response_model=dict)
async def get_project_events(
    project_id: str = Path(..., description="ID do projeto"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
    supabase_service: SupabaseService = Depends(get_supabase_service)
):
    """
    Obtém os eventos de acesso associados a um projeto
    """
    try:
        # Verifica se o projeto existe
        existing = await supabase_service.get_project(project_id=project_id)
        if not existing or not existing.get("project"):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        
        # Obtém os eventos
        result = await supabase_service.get_project_events(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            force_refresh=force_refresh
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter eventos do projeto: {str(e)}")
