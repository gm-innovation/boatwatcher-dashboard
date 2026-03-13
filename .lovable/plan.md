

# Plano Unificado: Download de Trabalhadores + Status Padrão

## Mudança 1: Novo endpoint `/notifications/download-workers` na Edge Function `api`

Adicionar rota no `supabase/functions/api/index.ts` que permite ao agente baixar trabalhadores diretamente, sem depender de comandos no poll.

**Request:** `GET /notifications/download-workers?token=AGENT_TOKEN&since=ISO_DATE`

**Lógica:**
1. Validar `token` contra tabela `local_agents`, obter `project_id`
2. Buscar workers com `status = 'active'` e `allowed_project_ids @> [project_id]`
3. Filtrar por `updated_at >= since` (default: epoch)
4. Retornar `{ workers: [...], timestamp, count }`

Também enriquecer comandos `sync_users` no handler `/notifications/poll` existente: quando um comando `sync_users` for retornado, anexar a lista de workers ao payload.

## Mudança 2: Status padrão `active` no `NewWorkerDialog`

**Arquivo:** `src/components/workers/NewWorkerDialog.tsx` linha 99

Alterar `status: 'pending_review'` para `status: 'active'`.

O `WorkerManagement.tsx` já usa `'active'` como default (linha 73) -- sem alteração necessária. O fluxo público `UserRegistration.tsx` continua com `pending_review`.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/api/index.ts` | Nova rota `download-workers` + enriquecimento de `sync_users` no poll |
| `src/components/workers/NewWorkerDialog.tsx` | Linha 99: `'pending_review'` → `'active'` |

