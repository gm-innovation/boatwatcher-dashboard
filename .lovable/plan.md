

# Plano: Correção de Erros + Edge Function (Etapa 1 Mínima)

## Problema Atual
1. **Build quebrado**: `StatisticsCards.tsx` tem props `className` inválidas nas linhas 39, 47 e 55 — `StatCard` não aceita essa prop. Isso causa erro de HMR.
2. **Edge function `agent-sync` nunca foi criada** — tentativas anteriores falharam com erro interno.

## O que será feito (apenas 2 arquivos pequenos)

### 1. Corrigir `StatisticsCards.tsx`
Remover as 3 props `className` extras das chamadas de `StatCard`.

### 2. Criar `supabase/functions/agent-sync/index.ts` (versão mínima ~80 linhas)
Endpoint simples com 3 ações:
- `upload-logs` — recebe array de logs, insere em `access_logs`
- `download-workers` — retorna workers atualizados desde timestamp
- `status` — atualiza heartbeat do agente

Autenticação por token do agente (mesmo padrão do `agent-relay`).

Nenhuma alteração de migration (colunas `last_sync_at`, `pending_sync_count`, `sync_status` já existem).

