"""
Script para verificar a estrutura do projeto e as importações
"""
import os
import sys
import importlib.util

def check_module(module_path):
    """Verifica se um módulo pode ser importado"""
    try:
        spec = importlib.util.spec_from_file_location("module", module_path)
        if spec is None:
            return False, "Spec is None"
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return True, "OK"
    except Exception as e:
        return False, str(e)

# Diretório base
base_dir = os.path.dirname(os.path.abspath(__file__))
print(f"Diretório base: {base_dir}")

# Verificar estrutura de diretórios
app_dir = os.path.join(base_dir, "app")
if os.path.exists(app_dir) and os.path.isdir(app_dir):
    print("✅ Diretório app existe")
else:
    print("❌ Diretório app não existe")

# Verificar módulos principais
modules_to_check = [
    ("app/core/config.py", "Configuração"),
    ("app/core/mock_data.py", "Dados simulados"),
    ("app/models/inmeta.py", "Modelos de dados"),
    ("app/services/inmeta.py", "Serviço Inmeta"),
    ("app/api/routes/health.py", "Rotas de health check"),
    ("app/api/routes/events.py", "Rotas de eventos"),
    ("app/main.py", "Aplicação principal")
]

print("\nVerificando módulos principais:")
for module_path, description in modules_to_check:
    full_path = os.path.join(base_dir, module_path)
    if os.path.exists(full_path):
        success, message = check_module(full_path)
        if success:
            print(f"✅ {description} ({module_path}): OK")
        else:
            print(f"⚠️ {description} ({module_path}): Erro ao importar - {message}")
    else:
        print(f"❌ {description} ({module_path}): Arquivo não encontrado")

# Verificar importações críticas
print("\nVerificando importações críticas:")
try:
    from app.core.config import settings
    print(f"✅ settings importado: {settings.PROJECT_NAME}")
except Exception as e:
    print(f"❌ Erro ao importar settings: {str(e)}")

try:
    from app.core.mock_data import gerar_eventos_acesso
    eventos = gerar_eventos_acesso(1)
    print(f"✅ gerar_eventos_acesso importado e funcionando")
except Exception as e:
    print(f"❌ Erro ao importar gerar_eventos_acesso: {str(e)}")

try:
    from app.models.inmeta import EventoAcesso
    print(f"✅ EventoAcesso importado")
except Exception as e:
    print(f"❌ Erro ao importar EventoAcesso: {str(e)}")

try:
    from app.main import app
    print(f"✅ FastAPI app importado")
except Exception as e:
    print(f"❌ Erro ao importar FastAPI app: {str(e)}")

print("\nVerificação concluída!")
