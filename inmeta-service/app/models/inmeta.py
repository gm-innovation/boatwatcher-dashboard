"""
Modelos de dados para a API Inmeta
"""
from typing import Optional, List
from pydantic import BaseModel, Field

class TokenResponse(BaseModel):
    """Resposta da API de token"""
    token: str

class VinculoColaborador(BaseModel):
    """Vínculo do colaborador com uma empresa"""
    id: Optional[str] = None
    nome: Optional[str] = None

class Alvo(BaseModel):
    """Obra ou local onde ocorreu o evento"""
    id: Optional[str] = None
    nome: Optional[str] = None

class EventoAcesso(BaseModel):
    """Evento de acesso registrado no sistema"""
    tipo: str
    data: str
    alvo: Optional[Alvo] = None
    agente: str
    cpfPessoa: str
    tipoPessoa: str
    nomePessoa: str
    cargoPessoa: str
    observacoes: Optional[str] = None
    vinculoColaborador: Optional[VinculoColaborador] = None
