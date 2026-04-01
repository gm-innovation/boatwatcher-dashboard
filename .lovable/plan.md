

## Correções: UTC no Desktop e Logs Manuais ausentes

### Problema 1: UTC -3h no Desktop

**Linha 1096 de `electron/database.js`:**
```javascript
const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const startTimestamp = localMidnight.toISOString();
```
Usa timezone local do servidor (que no Brasil é UTC-3), gerando `startTimestamp` errado. O SQLite armazena timestamps em UTC, mas o filtro calcula meia-noite BRT como hora local → `toISOString()` converte para UTC, resultando em 03:00 UTC. **Porém**, se o servidor local roda em UTC (que é o caso de muitos servidores Windows sem configuração), gera 00:00 UTC em vez de 03:00 UTC — filtrando 3 horas a mais.

**Correção:** Usar a mesma lógica BRT fixa que a Web:
```javascript
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
todayUTC.setUTCHours(3, 0, 0, 0); // meia-noite BRT = 03:00 UTC
const startTimestamp = todayUTC.toISOString();
```

### Problema 2: Desktop usa lógica entry/exit antiga

A query SQLite (linhas 1112-1148) ainda usa a lógica de `NOT EXISTS (exit com timestamp > entry)` — a mesma que foi corrigida na Web. Precisa ser reescrita para usar a abordagem de **estado final** (processar todos os eventos em ordem cronológica).

**Correção:** Reescrever a query para buscar TODOS os logs (entry + exit) ordenados por `created_at ASC`, e processar o estado final em JavaScript (igual à Web).

### Problema 3: Logs manuais não são baixados para o Desktop

**Linha 1118-1121 de `agent-sync/index.ts`:**
```typescript
if (deviceFilter.length === 0) {
  return new Response(JSON.stringify({ access_logs: [], timestamp: ... }))
}
```
E linha 1126: `.in('device_id', deviceFilter)` — filtra APENAS por `device_id` físico. Logs manuais (`device_id = null`) nunca são incluídos.

**Correção:** Buscar `manual_access_points` do projeto e incluí-los na query com `.or()`:
```typescript
// Buscar pontos manuais do projeto
const { data: manualPoints } = await supabase
  .from('manual_access_points')
  .select('name')
  .eq('project_id', agent.project_id)
const manualNames = (manualPoints || []).map(p => `Manual - ${p.name}`)

// Não retornar vazio se existem pontos manuais
if (deviceFilter.length === 0 && manualNames.length === 0) {
  return empty response
}

// Query com OR: device_id IN (...) OR (device_id IS NULL AND device_name IN (...))
```

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `electron/database.js` | Fixar `startTimestamp` para BRT (03:00 UTC) + reescrever lógica entry/exit para estado final |
| `supabase/functions/agent-sync/index.ts` | Incluir logs manuais no `download-access-logs` |

