

# Plano Revisado: Implementação Incremental do Agente Offline

## Problema
O plano anterior tentava criar 4 arquivos grandes simultaneamente (Python agent ~600 linhas, edge function, UI complexa, migration), causando erros internos repetidos. Precisa ser dividido em etapas menores.

## Estado Atual
- `public/controlid_agent.py` **não existe** (nunca foi criado com sucesso)
- `supabase/functions/agent-sync/` **vazio** (nunca foi criado)
- `AgentManagement.tsx` existe com script Python inline básico (482 linhas)
- `useLocalAgents.ts` existe sem campos de sync
- Migration dos campos de sync pode ou não ter sido aplicada

## Plano em 4 Etapas Separadas

### Etapa 1 — Migration + Edge Function
- Adicionar colunas `last_sync_at`, `pending_sync_count`, `sync_status` na tabela `local_agents` (se ainda não existirem)
- Criar `supabase/functions/agent-sync/index.ts` — versão enxuta com 3 endpoints: `upload-logs`, `download-workers`, `status`

### Etapa 2 — Script Python (arquivo separado)
- Criar `public/controlid_agent.py` com estrutura modular:
  - SQLite local (workers, access_logs, sync_queue)
  - ControlID API client (login, status, sync_users)
  - Sync engine (upload logs, download workers)
  - Main loop com heartbeat

### Etapa 3 — Atualizar UI do AgentManagement
- Adicionar indicadores de sync status, last_sync_at, pending_sync_count nos cards dos agentes
- Botão de download do script Python
- Template de config.json

### Etapa 4 — Instruções de instalação
- Adicionar aba com instruções Linux (systemd) e Windows (NSSM)

Cada etapa será implementada como uma mensagem separada, evitando sobrecarga.

## Próxima Ação
Implementar apenas a **Etapa 1** (migration + edge function) nesta rodada.

