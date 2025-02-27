"""
Versão simplificada da aplicação Inmeta Service
Esta versão contém todas as funcionalidades essenciais em um único arquivo
para facilitar o desenvolvimento e teste.
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Configurações
class Settings:
    # API Config
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Inmeta Service"
    DEBUG: bool = True
    
    # Server Config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Inmeta API
    INMETA_API_URL: str = os.getenv("INMETA_API_URL", "https://api.homologacao.inmeta.com.br")
    INMETA_EMAIL: str = os.getenv("INMETA_EMAIL", "googlemarine@teste.com.br")
    INMETA_PASSWORD: str = os.getenv("INMETA_PASSWORD", "rXYAYKSUI8EExfM")
    
    # Request ID
    REQUEST_ID_HEADER: str = "X-Request-ID"

settings = Settings()

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("inmeta-service")

# Modelos de dados
class InmetaCredentials(BaseModel):
    email: str
    senha: str

class AccessEvent(BaseModel):
    id: str
    tipo: str
    data: datetime
    embarcacao: Optional[Dict[str, Any]] = None
    marina: Optional[Dict[str, Any]] = None
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

# Serviço Inmeta
class InmetaService:
    def __init__(self):
        self.base_url = settings.INMETA_API_URL
        self.credentials = InmetaCredentials(
            email=settings.INMETA_EMAIL,
            senha=settings.INMETA_PASSWORD
        )
        self._token = None
        
    async def get_token(self) -> str:
        """Obtém token de autenticação do Inmeta"""
        # Se já temos um token em memória, retorna ele
        if self._token:
            return self._token
            
        # Se não tem no cache, buscar da API
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/token",
                json=self.credentials.dict(),
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Erro ao obter token: {response.text}")
                
            token = response.json()['token']
            self._token = token
            
            return token
            
    async def get_access_events(
        self,
        start_date: datetime,
        end_date: datetime,
        project_id: Optional[str] = None
    ) -> List[AccessEvent]:
        """
        Busca eventos de acesso do Inmeta com processamento pandas
        """
        # Se não está em cache, buscar da API
        token = await self.get_token()
        
        payload = {
            "dataInicio": start_date.strftime("%Y-%m-%d"),
            "dataFim": end_date.strftime("%Y-%m-%d")
        }
        
        if project_id:
            payload["projectId"] = project_id
            
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/eventos-acesso",
                json=payload,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Erro ao buscar eventos: {response.text}")
                
            events_data = response.json()
            
            # Processar com pandas
            df = pd.DataFrame(events_data)
            if not df.empty:
                # Converter datas
                df['data'] = pd.to_datetime(df['data'])
                
                # Filtrar tipos relevantes
                df = df[df['tipo'].isin(['ENTRADA', 'ENTRADA_COM_PENDENCIAS'])]
                
                # Ordenar por data
                df = df.sort_values('data')
                
                # Converter de volta para dicionário
                events = df.to_dict('records')
                
                # Converter para modelo Pydantic
                processed_events = [AccessEvent(**event) for event in events]
                
                return processed_events
                
            return []

# Middleware para logging de requisições
class RequestLoggingMiddleware:
    async def __call__(self, request: Request, call_next):
        # Gerar ID único para a requisição
        request_id = request.headers.get(settings.REQUEST_ID_HEADER, str(uuid.uuid4()))
        
        # Registrar início da requisição
        start_time = time.time()
        logger.info(
            f"Request started: {request.method} {request.url.path}"
        )
        
        # Processar a requisição
        try:
            response = await call_next(request)
            
            # Registrar fim da requisição
            process_time = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code} - {process_time:.4f}s"
            )
            
            # Adicionar request_id ao cabeçalho da resposta
            response.headers[settings.REQUEST_ID_HEADER] = request_id
            
            return response
            
        except Exception as e:
            # Registrar exceção
            process_time = time.time() - start_time
            logger.exception(
                f"Request failed: {request.method} {request.url.path} - {str(e)} - {process_time:.4f}s"
            )
            
            # Retornar resposta de erro
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal Server Error"}
            )

# Inicializar aplicação
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API para integração com o Inmeta",
    version="0.1.0",
)

# Adicionar middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Adicionar middleware de logging
app.middleware("http")(RequestLoggingMiddleware())

# Inicializar serviço Inmeta
inmeta_service = InmetaService()

# Rotas
@app.get("/")
async def root():
    return {"message": "Inmeta Service API"}

@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    """
    Verifica a saúde do serviço e suas dependências
    """
    start_time = time.time()
    
    # Inicializar resultado
    result = {
        "status": "healthy",
        "version": "0.1.0",
        "timestamp": time.time(),
        "dependencies": {
            "inmeta_api": {
                "status": "unknown",
                "url": settings.INMETA_API_URL
            }
        }
    }
    
    # Verificar API do Inmeta
    try:
        async with httpx.AsyncClient(verify=False, timeout=5.0) as client:
            response = await client.get(f"{settings.INMETA_API_URL}/api/v1/health")
            if response.status_code == 200:
                result["dependencies"]["inmeta_api"]["status"] = "healthy"
            else:
                result["dependencies"]["inmeta_api"]["status"] = "unhealthy"
                result["dependencies"]["inmeta_api"]["status_code"] = response.status_code
    except Exception as e:
        logger.error(f"Error checking Inmeta API health: {str(e)}")
        result["dependencies"]["inmeta_api"]["status"] = "error"
        result["dependencies"]["inmeta_api"]["error"] = str(e)
    
    # Verificar status geral
    if any(dep["status"] not in ["healthy", "disabled"] for dep in result["dependencies"].values()):
        result["status"] = "degraded"
    
    # Calcular tempo de resposta
    result["response_time"] = time.time() - start_time
    
    return result

@app.get(f"{settings.API_V1_STR}/events/access")
async def get_access_events(
    start_date: str,
    end_date: str,
    project_id: Optional[str] = None
):
    """
    Busca eventos de acesso do Inmeta
    """
    try:
        # Converter datas
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        # Buscar eventos
        events = await inmeta_service.get_access_events(start, end, project_id)
        
        return {
            "count": len(events),
            "data": events
        }
    except Exception as e:
        logger.exception(f"Error getting access events: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting access events: {str(e)}"
        )

# Executar aplicação
if __name__ == "__main__":
    logger.info(f"Starting {settings.PROJECT_NAME}")
    uvicorn.run(
        "app_v2:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
