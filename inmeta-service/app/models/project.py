"""
Modelos de dados para projetos
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    """Modelo base para projetos"""
    name: str
    description: Optional[str] = None
    inmeta_id: Optional[str] = None
    location: Optional[str] = None
    client: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ProjectCreate(ProjectBase):
    """Modelo para criação de projetos"""
    pass


class ProjectUpdate(BaseModel):
    """Modelo para atualização de projetos"""
    name: Optional[str] = None
    description: Optional[str] = None
    inmeta_id: Optional[str] = None
    location: Optional[str] = None
    client: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        """Configuração do modelo"""
        extra = "ignore"


class Project(ProjectBase):
    """Modelo completo para projetos"""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        """Configuração do modelo"""
        orm_mode = True


class Event(BaseModel):
    """Modelo para eventos de acesso"""
    id: str
    project_id: Optional[str] = None
    device_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: str = Field(alias="tipo")
    event_date: datetime = Field(alias="data")
    person_name: Optional[str] = Field(default=None, alias="nomePessoa")
    person_role: Optional[str] = Field(default=None, alias="cargoPessoa")
    person_cpf: Optional[str] = Field(default=None, alias="cpfPessoa")
    person_type: Optional[str] = Field(default=None, alias="tipoPessoa")
    company: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None)
    observations: Optional[str] = Field(default=None, alias="observacoes")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        """Configuração do modelo"""
        orm_mode = True
        allow_population_by_field_name = True


class ProjectWithEvents(Project):
    """Modelo para projetos com eventos de acesso"""
    events: Optional[List[Event]] = Field(default_factory=list)
    events_count: int = 0
    last_event_date: Optional[datetime] = None
    events_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        """Configuração do modelo"""
        orm_mode = True


class ProjectList(BaseModel):
    """Modelo para lista de projetos"""
    projects: List[Project]
    total: int
    cached: bool = False


class ProjectDetail(BaseModel):
    """Modelo para detalhes de um projeto"""
    project: Project
    events_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    cached: bool = False


class ProjectEventsSummary(BaseModel):
    """Modelo para resumo de eventos de um projeto"""
    project_id: str
    project_name: str
    events_count: int
    last_event_date: Optional[datetime] = None
    summary: Dict[str, Any] = Field(default_factory=dict)
    period: Dict[str, str] = Field(default_factory=dict)
    cached: bool = False
