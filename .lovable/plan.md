

## Diagnóstico Definitivo

### Por que o dashboard mostra 0

A investigação nos logs de analytics revelou a causa raiz:

**TODAS as chamadas `POST /upload-logs` estão retornando 401 (Unauthorized).**

```
POST | 401 | upload-logs  (20+ vezes consecutivas, sem nenhum 200)
```

Isso significa que:
1. O hardware ControlID registrou a entrada do Alexandre corretamente (11:41)
2. O agente local capturou o evento e armazenou no SQLite
3. O sync engine tentou enviar para a nuvem mas recebeu 401
4. O evento NUNCA chegou ao banco de dados na nuvem
5. O dashboard consulta a nuvem → 0 trabalhadores

### Evidência no banco

```sql
-- Último log na nuvem:
max(created_at) = 2026-04-06 20:28:44
-- Logs de hoje: ZERO
-- Total: 923 (nenhum novo desde ontem)
```

### Por que o 401?

O analytics mostra um padrão estranho: `POST /status` (heartbeat) retorna 200, mas `POST /upload-logs` retorna 401, mesmo usando o mesmo token e a mesma função `callEdgeFunction`.

Hipótese mais provável: após as últimas alterações no `agent-sync`, a edge function foi redesplantada. Pode haver um problema de cold-start, timeout ou uma segunda instância do sync engine rodando com token inválido/vazio. Os `shutdown` frequentes nos logs da função também indicam instabilidade.

O token no banco (`84ed5d35...`) existe e é válido. A busca `SELECT ... WHERE token = ?` deveria funcionar.

## Plano de Correção

### 1. Adicionar logging de diagnóstico na edge function

No handler de `upload-logs`, antes da validação de token, logar o token recebido (primeiros 8 chars) para confirmar se o valor está chegando corretamente:

```typescript
console.log(`[agent-sync] Token received: ${token?.slice(0,8)}... action=${action}`)
```

### 2. Adicionar fallback robusto no sync engine

Em `electron/sync.js`, na função `uploadLogs()`, quando receber 401:
- Logar o token sendo usado (primeiros 8 chars)
- Tentar recarregar o token do `sync_meta`
- Se ainda falhar, tentar um re-bootstrap automático

### 3. Redesplantar a edge function

Forçar um novo deploy do `agent-sync` para garantir que a versão atual está ativa.

### 4. Adicionar retry com re-auth no upload de logs

No `uploadLogs()`, ao receber 401, antes de desistir:
- Verificar se `process.env.AGENT_TOKEN` difere de `this.db.getSyncMeta('agent_token')`
- Se diferir, sincronizar os dois valores
- Re-tentar o upload uma vez

### 5. Garantir que `reverse_sync_paused` seja desativado após resync bem-sucedido

O flag `reverse_sync_paused` é setado para `true` durante o `fullDeviceResync` mas NUNCA é setado de volta para `false`. Corrigir no final do resync.

### Arquivos

- `supabase/functions/agent-sync/index.ts` — logging de diagnóstico
- `electron/sync.js` — retry com re-auth + unpause reverse_sync
- Redeploy da edge function

### Resultado esperado

1. O upload de logs para de retornar 401
2. Os eventos capturados (incluindo Alexandre 11:41) chegam à nuvem
3. O dashboard passa a mostrar os trabalhadores corretamente

