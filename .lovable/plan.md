
# Investigação Profunda — Causas Raiz do Erro de Sincronização

## Diagnóstico Confirmado por Evidências

### Evidência 1: Os logs do Edge Function mostram que o servidor local NUNCA chamou `upload-logs`
A análise de analytics mostra apenas chamadas a `download-commands` (a cada 5s) e `status` (heartbeat a cada 60s). **Nenhuma chamada a `upload-logs`, `download-workers`, `download-devices`, `download-access-logs` foi registrada.** Isso significa que `triggerSync()` nunca executa — apenas o heartbeat e o command-poll rodam.

### Evidência 2: `last_sync_at` do agente continua NULL
O agente `0afe0864` está online (last_seen_at atualizado), mas `last_sync_at = NULL` confirma que nenhum upload de logs foi realizado.

### Evidência 3: Os dados no cloud são de teste manual
Os 8 access_logs existentes no cloud têm timestamps inconsistentes (criados em 2026-03-25 19:59 com timestamps de 17:59/18:59/19:14), e 5 deles não têm `device_id` — são inserções manuais, não vindas do agente.

---

## 3 Causas-Raiz Identificadas

### Causa 1 (CRÍTICA): O agente usa endpoint errado para capturar eventos
O `electron/agent.js` usa `GET /api/access/last` que retorna **apenas o último evento**. O agente Python (`controlid_agent.py`) usa `POST /access_logs.fcgi` com paginação `since_id`, que é o endpoint correto.

**Consequência:** Se nenhum evento novo ocorre entre polls de 5s, o mesmo evento é retornado → deduplicação o descarta. Se múltiplos eventos ocorrem entre polls, todos exceto o último são perdidos.

**Correção:** Trocar para `POST /access_logs.fcgi` com tracking de `last_event_id` por dispositivo, igual ao agente Python.

### Causa 2 (CRÍTICA): O sync engine só executa `triggerSync()` quando há dados pendentes locais
Em `checkAndSync()` (linha 210):
```
if (pendingWorkers.length > 0 || pendingLogs.length > 0 || ... || wasOffline || neverSynced) {
    await this.triggerSync();
}
```
Após o primeiro sync bem-sucedido (que seta `last_sync`), se não há logs locais pendentes (porque o agente não captura nada — vide Causa 1), `triggerSync()` nunca mais roda. Os downloads de workers, devices, companies etc. simplesmente param.

**Correção:** Forçar `triggerSync()` a cada ciclo de 60s, independente de dados pendentes.

### Causa 3 (MODERADA): A lógica web "Workers on Board" tem dados corretos mas possível inconsistência visual
A query cloud no `useSupabase.ts` está correta — os 3 logs de teste deveriam mostrar Alexandre como "a bordo" (última entrada 19:14 sem saída posterior). O screenshot mostra "A Bordo: 0" no card mas Alexandre na tabela, sugerindo um problema de cache/timing entre o StatisticsCards e o WorkersOnBoardTable.

**Investigação adicional:** Isso pode ser um render stale do React Query — a refetchInterval de 10s pode estar com cache. Não é o problema principal.

---

## Plano de Correção

### Etapa 1 — Corrigir captura de eventos no agente (`electron/agent.js`)
Trocar `GET /api/access/last` para `POST /access_logs.fcgi` com:
- Tracking de `last_event_id` por dispositivo (persistido no SQLite via `sync_meta`)
- Processamento de múltiplos eventos por poll
- Mantendo toda a normalização existente (direction, status, timestamp)

### Etapa 2 — Forçar sync periódico (`electron/sync.js`)
Alterar `checkAndSync()` para sempre chamar `triggerSync()` quando online, removendo a condição de "só sincronizar com dados pendentes". O sync já é idempotente (checkpoints impedem re-download).

### Etapa 3 — Garantir consistência do dashboard web (`src/hooks/useSupabase.ts`)
Ajustar query para usar `companies(name)` com join explícito e verificar que `workersOnBoard` e `companiesOnBoard` são derivados da mesma fonte de dados no mesmo render cycle.

### Arquivos a alterar
- `electron/agent.js` — trocar endpoint de polling para `access_logs.fcgi`
- `electron/sync.js` — remover condição em `checkAndSync()`, sempre sincronizar
- `src/hooks/useSupabase.ts` — review menor de consistência
