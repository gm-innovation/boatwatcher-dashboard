

# Fix: Upload de Logs Falhando por Foreign Key + Polling Funcionando

## Situação Atual (v1.3.6)

**Polling corrigido com sucesso**: `{"access_logs":[]}` — a API ControlID responde corretamente. Os lastEventId (20 e 241) mostram que os 258 eventos históricos foram capturados.

**Upload bloqueado**: 100 logs presos na fila local. Erro:
```
access_logs_worker_id_fkey: insert or update on table "access_logs" 
violates foreign key constraint
```

**Causa raiz**: A tabela `access_logs` na nuvem tem `worker_id UUID REFERENCES public.workers(id)`. Os eventos capturados do hardware têm `worker_id` de trabalhadores que não existem na tabela `workers` da nuvem (são códigos inteiros do ControlID mapeados para UUIDs locais, ou UUIDs de trabalhadores que ainda não foram sincronizados).

## Plano de Correção

### 1. Migração: Remover FK constraint de `access_logs.worker_id`

A tabela `access_logs` já armazena dados desnormalizados (`worker_name`, `worker_document`, `device_name`), então a FK é desnecessária e prejudicial. A constraint `access_logs_device_id_fkey` também deve ser removida pela mesma razão.

```sql
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_worker_id_fkey;
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_device_id_fkey;
```

### 2. Edge Function `agent-sync/upload-logs` — Fallback para worker_id inválido

Adicionar validação: se `worker_id` não existe na tabela `workers`, setar como `null` antes do insert. Isso garante resiliência mesmo se a FK for re-adicionada no futuro.

### 3. Atualizar memória de arquitetura

Atualizar o contexto para registrar que `access_logs` não usa FK para permitir logs de trabalhadores não cadastrados.

### Arquivos alterados
- **Migração SQL** — remover FK constraints de `access_logs`
- **`supabase/functions/agent-sync/index.ts`** — validar worker_id antes do insert
- **`server/package.json`** — bump para 1.3.7 (não obrigatório, pois a correção é server-side)

