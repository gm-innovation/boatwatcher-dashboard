import httpx
import pandas as pd
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.api.models import AccessEvent, InmetaCredentials

class InmetaService:
    def __init__(self, api_url: str = None, email: str = None, password: str = None, use_mock: bool = None):
        self.base_url = api_url or settings.INMETA_API_URL
        self.credentials = InmetaCredentials(
            email=email or settings.INMETA_EMAIL,
            senha=password or settings.INMETA_PASSWORD
        )
        self.use_mock = use_mock if use_mock is not None else settings.USE_MOCK
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
