"""
Testes para o módulo de dados simulados
"""
import pytest
from app.core.mock_data import gerar_eventos_acesso, gerar_token_mock, TOKEN_MOCK

def test_token_mock():
    """Testa se o token simulado está definido"""
    assert TOKEN_MOCK is not None
    assert isinstance(TOKEN_MOCK, str)
    assert len(TOKEN_MOCK) > 0

def test_gerar_token_mock():
    """Testa a geração de token simulado"""
    token = gerar_token_mock()
    assert isinstance(token, str)
    assert len(token) > 0

def test_gerar_eventos_acesso():
    """Testa a geração de eventos de acesso simulados"""
    # Teste com quantidade padrão
    eventos = gerar_eventos_acesso()
    assert isinstance(eventos, list)
    assert len(eventos) == 10  # quantidade padrão
    
    # Teste com quantidade personalizada
    quantidade = 5
    eventos = gerar_eventos_acesso(quantidade)
    assert len(eventos) == quantidade
    
    # Verificar estrutura dos eventos
    for evento in eventos:
        assert "tipo" in evento
        assert "data" in evento
        assert "alvo" in evento
        assert "agente" in evento
        assert "cpfPessoa" in evento
        assert "tipoPessoa" in evento
        assert "nomePessoa" in evento
        assert "cargoPessoa" in evento
        
        # Verificar alvo
        assert "id" in evento["alvo"]
        assert "nome" in evento["alvo"]
