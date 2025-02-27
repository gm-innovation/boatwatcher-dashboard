"""
Script para testar a estrutura de diretórios do projeto
"""
import os

def print_directory_structure(path, indent=0):
    """Imprime a estrutura de diretórios recursivamente"""
    print(' ' * indent + os.path.basename(path) + '/')
    
    try:
        items = os.listdir(path)
        for item in sorted(items):
            item_path = os.path.join(path, item)
            if os.path.isdir(item_path) and not item.startswith('__pycache__'):
                print_directory_structure(item_path, indent + 2)
            elif os.path.isfile(item_path) and not item.startswith('.'):
                print(' ' * (indent + 2) + item)
    except Exception as e:
        print(' ' * (indent + 2) + f"Error: {str(e)}")

# Diretório atual
current_dir = os.getcwd()
print(f"Estrutura do projeto em: {current_dir}\n")
print_directory_structure(current_dir)

# Verificar arquivos principais
required_files = [
    'app/main.py',
    'app/core/config.py',
    'app/api/routes/health.py',
    'app/models/inmeta.py',
    'app/services/inmeta.py',
    '.env',
    'run.py'
]

print("\nVerificando arquivos principais:")
for file_path in required_files:
    full_path = os.path.join(current_dir, file_path)
    if os.path.isfile(full_path):
        print(f"✅ {file_path} existe")
    else:
        print(f"❌ {file_path} não encontrado")
