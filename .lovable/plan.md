## Correções Aplicadas — Timestamps e Sync

### Alteração 1: `electron/agent.js` — Restaurada conversão BRT→UTC
- `normalizeTimestamp` agora adiciona +3h para timestamps sem timezone (ControlID envia BRT)
- SQLite armazena UTC correto (ex: 08:07 BRT → 11:07Z)

### Alteração 2: `electron/main.js` — Forçar timezone BRT
- `process.env.TZ = 'America/Sao_Paulo'` garante que `format()` use BRT no Electron

### Alteração 3: `supabase/functions/agent-sync/index.ts` — Removida autocorreção BRT
- O bloco que detectava lag 170-190min e adicionava +3h foi removido
- Previne dupla conversão (agente +3h + edge function +3h = +6h)

### Alteração 4: `electron/sync.js` — Paginação incremental
- Checkpoint usa `maxCreatedAt` do batch ao invés de `now()`
- Permite baixar todos os registros em datasets > 500 registros
- Eventos manuais da nuvem serão baixados progressivamente
