"""
Teste simples para verificar a importação do módulo mock_data
"""
try:
    from app.core.mock_data import gerar_eventos_acesso, TOKEN_MOCK
    print("✅ Importação bem-sucedida!")
    
    # Testar geração de eventos
    eventos = gerar_eventos_acesso(2)
    print(f"✅ Gerados {len(eventos)} eventos")
    print(f"Exemplo de evento: {eventos[0]}")
    
    # Testar token
    print(f"✅ TOKEN_MOCK: {TOKEN_MOCK[:20]}...")
    
except Exception as e:
    print(f"❌ Erro na importação: {str(e)}")
