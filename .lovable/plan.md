

# Fix: Dashboard Mostra 0 Trabalhadores — UUID Mismatch

## Problema Real

O trabalhador "Alexandre Silva" **existe** na nuvem com `id = 46dc598a...`, mas os `access_logs` foram enviados com `worker_id = 5a96074e...` (UUID gerado pelo banco local SQLite). São UUIDs diferentes para a mesma pessoa.

A query `useWorkersOnBoard` (linha 147-150) faz `workers.id IN ('5a96074e...')` — que não encontra nada porque o ID real na nuvem é `46dc598a...`.

## Correção em duas frentes

### 1. `src/hooks/useSupabase.ts` — Usar dados desnormalizados do `access_logs`

O `access_logs` já contém `worker_name` e `device_name`. Em vez de depender do JOIN obrigatório com `workers` (que falha por UUID mismatch), usar esses campos diretamente e fazer um enriquecimento opcional:

- Construir o resultado a partir do Map `workersOnBoard` (que já tem `worker_name`, `device_name`, `entry_time`)
- Tentar enriquecer com dados do `workers` via JOIN, mas **não descartar** trabalhadores que não foram encontrados
- Para workers não encontrados no JOIN, usar `worker_name` do log e "N/A" para role/company

### 2. `supabase/functions/agent-sync/index.ts` — Resolver worker_id local para cloud UUID

No momento do upload, tentar resolver o `worker_id` local para o UUID correto na nuvem usando o campo `worker_name` ou `worker_document` como chave de busca. Se encontrar correspondência, substituir o UUID local pelo da nuvem. Isso corrige o problema na fonte.

### Arquivos alterados
- **`src/hooks/useSupabase.ts`** — `useWorkersOnBoard`: resultado baseado em `access_logs` com enriquecimento opcional do `workers`
- **`supabase/functions/agent-sync/index.ts`** — resolver worker_id para UUID cloud antes do insert

