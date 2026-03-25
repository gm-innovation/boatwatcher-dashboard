

## Sincronização bidirecional completa de trabalhadores

### Problema

A sincronização entre web e desktop está incompleta em ambas as direções:

**Cloud → Desktop:** O método `upsertWorkerFromCloud` no UPDATE ignora: `code`, `job_function_id`, `birth_date`, `gender`, `blood_type`, `observations`, `devices_enrolled`.

**Desktop → Cloud:** O endpoint `upload-workers` na Edge Function só envia/recebe campos básicos (`name`, `role`, `company_id`, `status`), ignorando `code`, `photo_url`, `document_number`, `job_function_id`, etc.

**Query de download:** A Edge Function `download-workers` não seleciona `devices_enrolled`, `job_function_id`, `birth_date`, `gender`, `blood_type`, `observations`.

### Correções

#### 1. Edge Function `agent-sync/index.ts` — download-workers (linha 554)

Adicionar campos faltantes ao SELECT:
```
devices_enrolled, job_function_id, birth_date, gender, blood_type, observations
```

#### 2. Edge Function `agent-sync/index.ts` — upload-workers (linhas 652-659)

Incluir todos os campos no update e insert de workers vindos do desktop:
- `code`, `document_number`, `photo_url`, `job_function_id`, `birth_date`, `gender`, `blood_type`, `observations`, `devices_enrolled`

#### 3. `electron/database.js` — `upsertWorkerFromCloud` (linhas 1318-1350)

**UPDATE:** Adicionar `code`, `job_function_id`, `birth_date`, `gender`, `blood_type`, `observations`, `devices_enrolled` ao SET.

**INSERT:** Adicionar `job_function_id`, `birth_date`, `gender`, `blood_type`, `observations`, `devices_enrolled`.

#### 4. `electron/database.js` — `getUnsyncedWorkers` (linhas 1246-1257)

Garantir que o payload enviado inclui todos os campos necessários (já faz `SELECT *`, então basta confirmar que `normalizeWorkerRow` preserva tudo).

### Arquivos afetados

- `supabase/functions/agent-sync/index.ts`
- `electron/database.js`

### Sem alterações de banco

As colunas já existem tanto no SQLite local quanto no Postgres na nuvem.

