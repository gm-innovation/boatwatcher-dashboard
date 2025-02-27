"""
Aplicação básica para testar a integração com o Inmeta
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("inmeta-basic")

# Configurações
INMETA_API_URL = os.getenv("INMETA_API_URL", "https://api.homologacao.inmeta.com.br")
INMETA_EMAIL = os.getenv("INMETA_EMAIL", "googlemarine@teste.com.br")
INMETA_PASSWORD = os.getenv("INMETA_PASSWORD", "rXYAYKSUI8EExfM")

# Modelos
class InmetaCredentials(BaseModel):
    email: str
    senha: str

class AccessEvent(BaseModel):
    id: str
    tipo: str
    data: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

# Aplicação
app = FastAPI(title="Inmeta Basic")

# Token global
token = None

@app.get("/")
async def root():
    return {"message": "Inmeta Basic API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/token")
async def get_token():
    """Obtém token de autenticação do Inmeta"""
    global token
    
    if token:
        return {"token": "***REDACTED***", "cached": True}
        
    credentials = InmetaCredentials(
        email=INMETA_EMAIL,
        senha=INMETA_PASSWORD
    )
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{INMETA_API_URL}/api/v1/token",
                json=credentials.dict(),
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                return {"error": f"Erro ao obter token: {response.text}"}
                
            token = response.json()['token']
            return {"token": "***REDACTED***", "cached": False}
    except Exception as e:
        logger.exception(f"Erro ao obter token: {str(e)}")
        return {"error": str(e)}

@app.get("/events")
async def get_events(days: int = 7):
    """Busca eventos de acesso do Inmeta"""
    global token
    
    # Obter token se não tiver
    if not token:
        token_result = await get_token()
        if "error" in token_result:
            return token_result
    
    # Definir datas
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    payload = {
        "dataInicio": start_date.strftime("%Y-%m-%d"),
        "dataFim": end_date.strftime("%Y-%m-%d")
    }
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{INMETA_API_URL}/api/v1/eventos-acesso",
                json=payload,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                # Se token expirou, tentar obter novo
                if response.status_code == 401:
                    token = None
                    return await get_events(days)
                    
                return {"error": f"Erro ao buscar eventos: {response.text}"}
                
            events_data = response.json()
            return {
                "count": len(events_data),
                "data": events_data[:10]  # Retornar apenas os 10 primeiros para não sobrecarregar
            }
    except Exception as e:
        logger.exception(f"Erro ao buscar eventos: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    logger.info("Starting Inmeta Basic API")
    uvicorn.run(
        "basic_app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
