"""
Módulo para dados de simulação para testes da API Inmeta
"""
import random
import datetime
from typing import List, Dict, Any

# Dados de simulação para eventos de acesso
TIPOS_EVENTO = ["ENTRADA", "SAIDA", "ACESSO_NEGADO", "ACESSO_MANUAL"]
AGENTES = ["CATRACA_FISICA", "CATRACA_VIRTUAL", "PORTAO_AUTOMATICO", "CONTROLE_MANUAL"]
TIPOS_PESSOA = ["COLABORADOR", "VISITANTE", "TERCEIRO", "ADMINISTRADOR"]
CARGOS = ["ENGENHEIRO", "TECNICO", "GERENTE", "ANALISTA", "AUXILIAR", "COORDENADOR", "DIRETOR"]
NOMES = [
    "João Silva", "Maria Oliveira", "José Santos", "Ana Souza", "Pedro Costa", 
    "Carla Pereira", "Paulo Rodrigues", "Fernanda Lima", "Ricardo Almeida", "Juliana Ferreira"
]
OBRAS = ["Obra A", "Obra B", "Obra C", "Obra D", "Obra E"]
EMPRESAS = ["Empresa X", "Empresa Y", "Empresa Z", "Empresa W", "Empresa K"]

def gerar_cpf() -> str:
    """Gera um CPF aleatório no formato XXX.XXX.XXX-XX"""
    numeros = [random.randint(0, 9) for _ in range(9)]
    
    # Cálculo do primeiro dígito verificador
    soma = sum((i + 1) * numeros[i] for i in range(9))
    d1 = soma % 11
    if d1 == 10:
        d1 = 0
    
    # Cálculo do segundo dígito verificador
    numeros.append(d1)
    soma = sum(i * numeros[i] for i in range(10))
    d2 = soma % 11
    if d2 == 10:
        d2 = 0
    
    numeros.append(d2)
    
    # Formatação do CPF
    return f"{numeros[0]}{numeros[1]}{numeros[2]}.{numeros[3]}{numeros[4]}{numeros[5]}.{numeros[6]}{numeros[7]}{numeros[8]}-{numeros[9]}{numeros[10]}"

def gerar_evento_acesso() -> Dict[str, Any]:
    """Gera um evento de acesso aleatório"""
    now = datetime.datetime.now()
    data = now - datetime.timedelta(days=random.randint(0, 30), hours=random.randint(0, 23), minutes=random.randint(0, 59))
    
    tipo = random.choice(TIPOS_EVENTO)
    nome = random.choice(NOMES)
    cargo = random.choice(CARGOS)
    tipo_pessoa = random.choice(TIPOS_PESSOA)
    
    return {
        "tipo": tipo,
        "data": data.isoformat(),
        "alvo": {
            "id": str(random.randint(1000, 9999)),
            "nome": random.choice(OBRAS)
        },
        "agente": random.choice(AGENTES),
        "cpfPessoa": gerar_cpf(),
        "tipoPessoa": tipo_pessoa,
        "nomePessoa": nome,
        "cargoPessoa": cargo,
        "observacoes": f"Evento de {tipo.lower()} registrado automaticamente" if random.random() > 0.5 else None,
        "vinculoColaborador": {
            "id": str(random.randint(1000, 9999)),
            "nome": random.choice(EMPRESAS)
        } if tipo_pessoa == "COLABORADOR" else None
    }

def gerar_eventos_acesso(quantidade: int = 10) -> List[Dict[str, Any]]:
    """Gera uma lista de eventos de acesso aleatórios"""
    return [gerar_evento_acesso() for _ in range(quantidade)]

def gerar_token_mock() -> str:
    """Gera um token de acesso simulado"""
    caracteres = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choice(caracteres) for _ in range(64))

# Token simulado fixo para testes
TOKEN_MOCK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlVzdcOhcmlvIGRlIFRlc3RlIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
