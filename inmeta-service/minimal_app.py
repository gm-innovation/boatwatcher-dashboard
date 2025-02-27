"""
Aplicação mínima para testar a integração com o Inmeta
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import httpx
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import json

# Importar dados de simulação
from app.core.mock_data import gerar_eventos_acesso, TOKEN_MOCK

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("inmeta-minimal")

# Modelos de dados
class TokenResponse(BaseModel):
    token: str

class VinculoColaborador(BaseModel):
    id: Optional[str] = None
    nome: Optional[str] = None

class Alvo(BaseModel):
    id: Optional[str] = None
    nome: Optional[str] = None

class EventoAcesso(BaseModel):
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
    
# Configurações da API
INMETA_API_URL = os.getenv("INMETA_API_URL", "http://api.inmeta.com.br/api")
INMETA_EMAIL = os.getenv("INMETA_EMAIL", "")
INMETA_PASSWORD = os.getenv("INMETA_PASSWORD", "")
USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"

# Cache simples para o token
token_cache = {
    "token": None,
    "expires_at": None
}

# Inicializar FastAPI
app = FastAPI(
    title="Minimal Inmeta API",
    description="API mínima para testar a integração com o Inmeta",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Adicionar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Função para obter token
async def get_token() -> str:
    """Obtém um token de autenticação do Inmeta"""
    global token_cache
    
    # Se estamos no modo de simulação, retornar token simulado
    if USE_MOCK:
        logger.info("Usando token simulado")
        return TOKEN_MOCK
    
    # Verificar se já temos um token válido em cache
    now = datetime.now()
    if token_cache["token"] and token_cache["expires_at"] and token_cache["expires_at"] > now:
        logger.info("Usando token em cache")
        return token_cache["token"]
    
    # Se não temos um token válido, obter um novo
    logger.info("Obtendo novo token")
    
    if not INMETA_EMAIL or not INMETA_PASSWORD:
        raise HTTPException(status_code=500, detail="Credenciais de API não configuradas")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{INMETA_API_URL}/v1/token",
                json={
                    "email": INMETA_EMAIL,
                    "senha": INMETA_PASSWORD
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Erro ao obter token: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Falha na autenticação com Inmeta")
            
            data = response.json()
            token = data.get("token")
            
            # Atualizar cache - assumindo que o token expira em 24 horas
            token_cache["token"] = token
            token_cache["expires_at"] = now + timedelta(hours=23)  # 1 hora antes de expirar
            
            return token
    except Exception as e:
        logger.exception("Erro ao obter token")
        raise HTTPException(status_code=500, detail=f"Erro ao obter token: {str(e)}")

# Endpoints
@app.get("/")
async def root():
    """Endpoint raiz"""
    logger.info("Acessando endpoint raiz")
    return {"message": "Minimal Inmeta API", "mock_mode": USE_MOCK}

@app.get("/health")
async def health():
    """Endpoint de health check"""
    logger.info("Verificando health check")
    return {
        "status": "healthy",
        "mock_mode": USE_MOCK,
        "api_url": INMETA_API_URL,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/token", response_model=TokenResponse)
async def token():
    """Obtém um token de autenticação"""
    logger.info("Obtendo token")
    token = await get_token()
    return {"token": token}

@app.get("/eventos-acesso", response_model=List[EventoAcesso])
async def get_eventos_acesso(
    dataInicial: str,
    dataFinal: str,
    quantidade: Optional[int] = Query(10, description="Quantidade de eventos a serem gerados (apenas para modo de simulação)"),
    authorization: Optional[str] = Header(None)
):
    """Obtém eventos de acesso do Inmeta"""
    logger.info(f"Obtendo eventos de acesso: dataInicial={dataInicial}, dataFinal={dataFinal}")
    
    # Se estamos no modo de simulação, retornar dados simulados
    if USE_MOCK:
        logger.info(f"Usando dados simulados para eventos de acesso (quantidade={quantidade})")
        return gerar_eventos_acesso(quantidade)
    
    # Obter token se não fornecido no header
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        token = await get_token()
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{INMETA_API_URL}/v1/eventos-acesso",
                params={
                    "dataInicial": dataInicial,
                    "dataFinal": dataFinal
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "modulo": "CONTROLE_ACESSO"
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Erro ao obter eventos de acesso: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Falha ao obter eventos de acesso do Inmeta")
            
            return response.json()
    except Exception as e:
        logger.exception("Erro ao obter eventos de acesso")
        raise HTTPException(status_code=500, detail=f"Erro ao obter eventos de acesso: {str(e)}")

@app.get("/modo-simulacao")
async def modo_simulacao(ativar: Optional[bool] = Query(None)):
    """Verifica ou altera o modo de simulação"""
    global USE_MOCK
    
    if ativar is not None:
        USE_MOCK = ativar
        logger.info(f"Modo de simulação {'ativado' if USE_MOCK else 'desativado'}")
    
    return {"mock_mode": USE_MOCK}

# Executar diretamente com uvicorn
if __name__ == "__main__":
    logger.info(f"Starting Minimal Inmeta API on port 9000 (Mock Mode: {USE_MOCK})")
    uvicorn.run(app, host="0.0.0.0", port=9000)
