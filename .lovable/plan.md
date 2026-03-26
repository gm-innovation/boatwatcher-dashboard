

# Diagnóstico Final — Por que a sincronização continua quebrada

## Evidências concretas do banco de dados

1. **`last_sync_at` = NULL** — O agente nunca executou `upload-logs`
2. **`version: 1.0.0`** — O heartbeat reporta versão hardcoded. A versão no `server/package.json` e `server/index.js` é `1.0.0` fixa, então não é possível saber se o código atualizado está realmente rodando
3. **`download-workers found=0`** — O checkpoint já passou do `updated_at` do worker Alexandre (2026-03-25 18:59), então ele nunca mais é baixado para o SQLite local
4. **Nenhum access_log novo desde 25/03** — A entrada que você fez hoje NÃO chegou à nuvem

## 3 Problemas que ainda existem no código

### Problema 1: `download-workers` não tem fallback (Edge Function)
O fix anterior deveria ter adicionado um fallback para re-baixar workers quando `found=0`, mas **o código atual não tem esse fallback**. O query continua usando `.gte('updated_at', since)` sem retry. Resultado: SQLite local fica sem workers → agente não resolve `user_id` → logs ficam incompletos.

### Problema 2: `uploadLogs()` envia o objeto completo do SQLite sem sanitizar
O `getUnsyncedLogs()` retorna `SELECT * FROM access_logs WHERE synced = 0`, que inclui campos como `synced`, `created_at`, e `id` (TEXT). A Edge Function `upload-logs` insere esses dados no Postgres que tem `id` como UUID e `access_status`/`direction` como ENUMs. Se qualquer campo extra causar erro, o insert falha silenciosamente (o `try/catch` no sync.js captura mas não expõe o erro com detalhes suficientes).

### Problema 3: Versão hardcoded impede diagnóstico
`server/index.js` linha 122 tem `version: '1.0.0'` hardcoded. O heartbeat usa `process.env.npm_package_version || '1.0.0'`. Impossível saber se a versão atualizada está rodando.

## Plano de Correção (3 arquivos)

### 1. Edge Function `agent-sync/index.ts` — Fallback no download-workers
Quando `found=0` e o `since` não é epoch, refazer a query SEM filtro de data para garantir que todos os workers ativos sejam baixados. Isso resolve o problema do SQLite vazio.

### 2. `electron/sync.js` — Sanitizar payload antes do upload
No método `uploadLogs()`, remover campos SQLite-internos (`synced`, `created_at`, `id`) antes de enviar. O `id` será gerado pelo Postgres. Garantir que `access_status` e `direction` tenham valores canônicos.

### 3. `server/index.js` + `server/package.json` — Versão dinâmica
Usar `require('./package.json').version` no health endpoint e bumpar a versão para `1.3.0` para poder confirmar que o código atualizado está rodando.

## Detalhe técnico

```text
FLUXO ATUAL (quebrado):
  Leitor ControlID → agent.js pollDevice() → insertAccessLog(synced=0)
  → uploadLogs() envia SELECT * (com campos extras)
  → Edge Function insert no Postgres → FALHA (campos incompatíveis)
  → Erro capturado silenciosamente → last_sync_at permanece NULL

FLUXO CORRIGIDO:
  Leitor → agent.js → insertAccessLog(synced=0)
  → uploadLogs() sanitiza (remove synced/created_at/id)
  → Edge Function insert → SUCESSO
  → markLogsSynced() → last_sync_at atualizado
```

### Arquivos alterados
- `supabase/functions/agent-sync/index.ts` — fallback download-workers
- `electron/sync.js` — sanitização do payload uploadLogs
- `server/index.js` — versão dinâmica
- `server/package.json` — bump versão para 1.3.0

