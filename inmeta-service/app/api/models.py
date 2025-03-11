from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class InmetaCredentials(BaseModel):
    email: str
    senha: str

class VinculoColaborador(BaseModel):
    empresa: str

class AccessEvent(BaseModel):
    tipo: str
    data: datetime
    alvo: str
    agente: str
    cpf_pessoa: str = Field(alias="cpfPessoa")
    tipo_pessoa: str = Field(alias="tipoPessoa")
    nome_pessoa: str = Field(alias="nomePessoa")
    cargo_pessoa: str = Field(alias="cargoPessoa")
    observacoes: str
    vinculo_colaborador: VinculoColaborador = Field(alias="vinculoColaborador")

    class Config:
        allow_population_by_field_name = True

class AccessEventRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    project_id: Optional[str] = None

class AccessEventResponse(BaseModel):
    events: List[AccessEvent]
    total: int
    cached: bool = False
