

# Correção dos Relatórios Vazios + Robustez da Identificação

## Causa Raiz Identificada

A migração `20260326153724` removeu as foreign keys entre `access_logs` e `workers`/`devices`:
```sql
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_worker_id_fkey;
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_device_id_fkey;
```

Porém, a query em `fetchAccessLogs` (useDataProvider.ts) ainda tenta fazer join via FK:
```
.select('*, worker:workers(...), device:devices(...)')
```

PostgREST retorna **400**: *"Could not find a relationship between 'access_logs' and 'workers'"*

Todos os relatórios usam `useAccessLogs` -> `fetchAccessLogs` -> **todas as abas recebem array vazio**.

## Plano de Correção

### Passo 1: Corrigir `fetchAccessLogs` em `src/hooks/useDataProvider.ts`

Remover os joins FK e fazer `select('*')` apenas. Os dados denormalizados (`worker_name`, `worker_document`, `device_name`) já existem diretamente na tabela `access_logs`, então nenhuma informação é perdida.

```typescript
// ANTES (quebrado):
.select('*, worker:workers(id, name, document_number, company_id), device:devices(id, name, project_id)')

// DEPOIS (funcional):
.select('*')
```

### Passo 2: Melhorar matching híbrido no `WorkerTimeReport`

O componente já busca workers separadamente e faz matching por ID e nome. Vou reforçar a lógica:

- Chave primária de agrupamento: `worker_id` quando presente, fallback para `worker_name`
- Matching com tabela workers: por `id`, depois por `name`, depois por `document_number`
- Deduplicação: se mesmo trabalhador aparecer por ID e por nome, unificar

### Passo 3: Aplicar matching híbrido nos outros relatórios

- `PresenceReport`: usa `worker_id` como chave, adicionar fallback por `worker_name`
- `CompanyReport`: usa `worker_id`, adicionar fallback
- `OvernightControl`: usa `worker_id`, adicionar fallback
- `ReportsList`: já exibe dados brutos, sem necessidade de matching

### Arquivos alterados
- `src/hooks/useDataProvider.ts` — remover joins FK de `fetchAccessLogs`
- `src/components/reports/WorkerTimeReport.tsx` — reforçar matching híbrido
- `src/components/reports/PresenceReport.tsx` — adicionar fallback por nome
- `src/components/reports/CompanyReport.tsx` — adicionar fallback por nome
- `src/components/reports/OvernightControl.tsx` — adicionar fallback por nome

