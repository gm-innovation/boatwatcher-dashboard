# Inmeta Service

Microserviço Python para integração com a API do Inmeta, oferecendo cache, processamento de dados e melhor performance.

## Tecnologias

- Python 3.11+
- FastAPI
- Redis (opcional)
- Pandas
- Docker
- Docker Compose
- Supabase

## Requisitos

- Python 3.11+
- Docker (opcional)
- Docker Compose (opcional)

## Instalação

### Desenvolvimento Local

1. Clone o repositório
2. Crie um ambiente virtual:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure as variáveis de ambiente (crie um arquivo `.env`)
5. Execute o servidor de desenvolvimento:
   ```bash
   uvicorn app.main:app --reload
   ```

### Docker

1. Clone o repositório
2. Configure as variáveis de ambiente (opcional)
3. Execute com Docker Compose:
   ```bash
   docker-compose up --build
   ```

## Configuração

As seguintes variáveis de ambiente são suportadas:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `8000` |
| `DEBUG` | Modo de depuração | `True` |
| `ENVIRONMENT` | Ambiente (development, staging, production) | `development` |
| `LOG_LEVEL` | Nível de log | `INFO` |
| `INMETA_API_URL` | URL da API Inmeta | `https://api.homologacao.inmeta.com.br` |
| `INMETA_EMAIL` | Email para autenticação na API Inmeta | - |
| `INMETA_PASSWORD` | Senha para autenticação na API Inmeta | - |
| `SUPABASE_URL` | URL do projeto Supabase | - |
| `SUPABASE_KEY` | Chave de API do Supabase | - |
| `USE_MOCK` | Usar dados simulados | `True` |
| `REDIS_ENABLED` | Habilitar Redis para cache | `False` |
| `REDIS_URL` | URL do Redis | - |
| `CACHE_TTL` | Tempo de vida do cache em segundos | `3600` |

## API Endpoints

### Verificação de Saúde

- `GET /api/v1/health` - Verifica o status do serviço

### Eventos de Acesso

- `GET /api/v1/events` - Lista eventos de acesso
- `POST /api/v1/events/search` - Busca eventos com filtros

### Projetos

- `GET /api/v1/projects` - Lista todos os projetos
- `GET /api/v1/projects/{project_id}` - Obtém detalhes de um projeto
- `POST /api/v1/projects` - Cria um novo projeto
- `PUT /api/v1/projects/{project_id}` - Atualiza um projeto existente
- `DELETE /api/v1/projects/{project_id}` - Remove um projeto
- `GET /api/v1/projects/{project_id}/events` - Obtém eventos de um projeto

### Diagnóstico do Supabase

- `GET /api/v1/supabase/connection` - Verifica a conexão com o Supabase
- `GET /api/v1/supabase/tables` - Lista as tabelas disponíveis no Supabase
- `GET /api/v1/supabase/tables/{table_name}` - Obtém a estrutura de uma tabela

## Modo de Simulação

O serviço suporta um modo de simulação (`USE_MOCK=True`) que não requer conexão real com as APIs externas. Isso é útil para desenvolvimento e testes.

## Estrutura do Projeto

```
inmeta-service/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── events.py
│   │   │   ├── health.py
│   │   │   ├── projects.py
│   │   │   └── supabase_info.py
│   │   └── models.py
│   ├── core/
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── exceptions.py
│   │   ├── logging.py
│   │   └── middleware.py
│   ├── models/
│   │   └── project.py
│   ├── services/
│   │   ├── inmeta.py
│   │   ├── supabase.py
│   │   └── mock_data.py
│   ├── utils/
│   └── main.py
├── tests/
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Testes

Execute os testes com:

```bash
pytest
```

Para executar com cobertura:

```bash
pytest --cov=app
```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
