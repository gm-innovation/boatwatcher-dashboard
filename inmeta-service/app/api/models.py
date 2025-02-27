from pydantic import BaseModel
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
    cpf_pessoa: str
    tipo_pessoa: str
    nome_pessoa: str
    cargo_pessoa: str
    observacoes: str
    vinculo_colaborador: VinculoColaborador

class AccessEventRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    project_id: Optional[str] = None

class AccessEventResponse(BaseModel):
    events: List[AccessEvent]
    total: int
    cached: bool = False
