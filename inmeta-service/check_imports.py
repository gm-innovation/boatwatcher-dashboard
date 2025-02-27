"""
Script para verificar as importações básicas
"""
import sys

def check_import(module_name):
    """Verifica se um módulo pode ser importado"""
    try:
        __import__(module_name)
        return True, "OK"
    except Exception as e:
        return False, str(e)

# Lista de módulos para verificar
modules = [
    "app.core.config",
    "app.core.mock_data",
    "app.models.inmeta",
    "app.services.inmeta",
    "app.api.routes.health",
    "app.api.routes.events",
    "app.main"
]

print("Verificando importações:")
for module in modules:
    success, message = check_import(module)
    if success:
        print(f"✅ {module}: OK")
    else:
        print(f"❌ {module}: {message}")

print("\nVerificação concluída!")
