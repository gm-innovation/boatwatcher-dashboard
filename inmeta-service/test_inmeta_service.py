"""
Testes para o serviço Inmeta
"""
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta

from app.services.inmeta import InmetaService
from app.core.mock_data import gerar_eventos_acesso, gerar_token_mock

@pytest.fixture
def mock_httpx_client():
    """Fixture para criar um cliente httpx mockado"""
    with patch("httpx.AsyncClient") as mock_client:
        client_instance = AsyncMock()
        mock_client.return_value.__aenter__.return_value = client_instance
        yield client_instance

@pytest.fixture
def inmeta_service():
    """Fixture para criar uma instância do serviço Inmeta"""
    return InmetaService()

@pytest.mark.asyncio
async def test_authenticate(mock_httpx_client, inmeta_service):
    """Testa a autenticação no serviço Inmeta"""
    # Configurar o mock para retornar um token
    mock_token = gerar_token_mock()
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"token": mock_token}
    mock_httpx_client.post.return_value = mock_response
    
    # Chamar o método de autenticação
    token = await inmeta_service.authenticate()
    
    # Verificar se o token foi retornado corretamente
    assert token == mock_token
    assert inmeta_service.token == mock_token
    
    # Verificar se o método post foi chamado com os parâmetros corretos
    mock_httpx_client.post.assert_called_once()
    args, kwargs = mock_httpx_client.post.call_args
    assert "auth" in args[0]
    assert "email" in kwargs["json"]
    assert "password" in kwargs["json"]

@pytest.mark.asyncio
async def test_get_access_events(mock_httpx_client, inmeta_service):
    """Testa a obtenção de eventos de acesso"""
    # Configurar o mock para retornar eventos
    mock_events = gerar_eventos_acesso(5)
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"eventos": mock_events}
    mock_httpx_client.get.return_value = mock_response
    
    # Configurar o token do serviço
    inmeta_service.token = gerar_token_mock()
    
    # Definir datas para o teste
    start_date = datetime.now() - timedelta(days=7)
    end_date = datetime.now()
    
    # Chamar o método de obtenção de eventos
    events = await inmeta_service.get_access_events(
        start_date=start_date,
        end_date=end_date,
        project_id="123"
    )
    
    # Verificar se os eventos foram retornados corretamente
    assert events == mock_events
    
    # Verificar se o método get foi chamado com os parâmetros corretos
    mock_httpx_client.get.assert_called_once()
    args, kwargs = mock_httpx_client.get.call_args
    assert "eventos" in args[0]
    assert "Authorization" in kwargs["headers"]
    assert kwargs["headers"]["Authorization"] == f"Bearer {inmeta_service.token}"
    assert "dataInicio" in kwargs["params"]
    assert "dataFim" in kwargs["params"]
    assert "projetoId" in kwargs["params"]
    assert kwargs["params"]["projetoId"] == "123"

@pytest.mark.asyncio
async def test_get_access_events_with_cache(inmeta_service):
    """Testa o cache de eventos de acesso"""
    # Configurar o serviço para usar cache
    inmeta_service.use_cache = True
    
    # Definir datas para o teste
    start_date = datetime.now() - timedelta(days=7)
    end_date = datetime.now()
    project_id = "123"
    
    # Criar eventos mockados para o cache
    mock_events = gerar_eventos_acesso(5)
    
    # Adicionar eventos ao cache
    cache_key = inmeta_service._get_cache_key(start_date, end_date, project_id)
    inmeta_service._cache[cache_key] = mock_events
    
    # Chamar o método de obtenção de eventos
    events = await inmeta_service.get_access_events(
        start_date=start_date,
        end_date=end_date,
        project_id=project_id
    )
    
    # Verificar se os eventos foram retornados do cache
    assert events == mock_events
    assert inmeta_service.was_cached is True
