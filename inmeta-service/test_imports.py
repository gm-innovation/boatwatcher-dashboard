"""
Script para testar importações e estrutura do projeto
"""
import sys
import os

print("Python version:", sys.version)
print("Current directory:", os.getcwd())
print("\nTesting imports...")

try:
    from app.core.config import settings
    print("✅ Imported settings:", settings)
except Exception as e:
    print("❌ Error importing settings:", str(e))

try:
    from app.models.inmeta import EventoAcesso
    print("✅ Imported EventoAcesso model")
except Exception as e:
    print("❌ Error importing EventoAcesso:", str(e))

try:
    from app.services.inmeta import InmetaService
    print("✅ Imported InmetaService")
except Exception as e:
    print("❌ Error importing InmetaService:", str(e))

try:
    from app.api.routes.health import router as health_router
    print("✅ Imported health router")
except Exception as e:
    print("❌ Error importing health router:", str(e))

try:
    from app.api.routes.events import router as events_router
    print("✅ Imported events router")
except Exception as e:
    print("❌ Error importing events router:", str(e))

try:
    from app.main import app
    print("✅ Imported FastAPI app")
except Exception as e:
    print("❌ Error importing FastAPI app:", str(e))

print("\nTest complete!")
