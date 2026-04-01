

## Diagnóstico completo: -3h no Desktop e eventos manuais ausentes

### Rastreamento do fluxo de timestamps (Problema -3h)

```text
FLUXO DO TIMESTAMP — do dispositivo ao dashboard:

1. Dispositivo ControlID → agent.js (normalizeTimestamp)
   Exemplo: "2025-04-01 10:30:00" (BRT, sem timezone)
   → Detecta sem timezone → adiciona +3h → "2025-04-01T13:30:00.000Z" (UTC) ✅

2. agent.js → database.js (insertAccessLog)
   timestamp = "2025-04-01T13:30:00.000Z" (com Z) ✅
   created_at = NÃO É PASSADO → usa DEFAULT datetime('now')
   datetime('now') = hora UTC da máquina (se em UTC) ou hora local (se em BRT)

3. database.js (getWorkersOnBoard) → entryTime
   entryTime = row.timestamp = "2025-04-01T13:30:00.000Z" (com Z)
   Linha 1177: tem 'Z' → NÃO adiciona sufixo → retorna como está ✅

4. WorkersOnBoardTable.tsx (linha 70)
   format(new Date("2025-04-01T13:30:00.000Z"), 'dd/MM HH:mm')
   → date-fns format usa timezone LOCAL do navegador
   → Se o Electron roda com timezone BRT: 10:30 ✅
   → Se o Electron roda com timezone UTC: 13:30 ❌ (+3h)
```

**CAUSA RAIZ do -3h**: O timestamp que chega ao dashboard está CORRETO em UTC. O problema é que `date-fns format()` converte para o timezone LOCAL do processo Electron. Se a máquina Windows está configurada em UTC (ou outro timezone), o horário exibido está errado.

**Prova**: Se fosse -3h, o evento das 10:30 BRT apareceria como 07:30 — mas o timestamp está em UTC correto (13:30Z), e se a máquina estiver em UTC, `format()` mostra 13:30 em vez de 10:30 BRT. Se o inverso, é o caso oposto.

**A VERDADEIRA correção**: Não depender do timezone do OS. Forçar exibição em BRT no `WorkersOnBoardTable` e no `getWorkersOnBoard`.

### Rastreamento do fluxo de eventos manuais

```text
FLUXO — Evento manual na Web → Desktop:

1. Operador registra entrada manual no Web
   → Insere em access_logs (Postgres):
     device_id = NULL
     device_name = "Manual - Bordo"
     worker_name = "João"
     project_id = (NÃO EXISTE no access_logs — não é coluna!)

2. Desktop sync: downloadAccessLogs()
   → Edge Function: download-access-logs
   → Busca manual_access_points do projeto → ["Bordo"] → manualNames = ["Manual - Bordo"]
   → Query: .or("device_id.in.(...),and(device_id.is.null,device_name.in.(Manual - Bordo))")
   → Encontra o log manual ✅

3. upsertAccessLogFromCloud(log)
   → log.device_id = null
   → log.worker_id pode ser UUID ou null
   → Se worker_id não null → verifica se existe localmente → se não, anula worker_id
   → INSERT com worker_name preservado ✅

4. getWorkersOnBoard()
   → deviceFilter (linha 1104):
     "AND (al.device_id IN (SELECT id FROM devices WHERE project_id = ?)
      OR (al.device_id IS NULL AND al.device_name LIKE 'Manual - %'))"
   → Logs manuais: device_id IS NULL ✅, device_name LIKE 'Manual - %' ✅
   → Filtro (linha 1116): (worker_id IS NOT NULL OR worker_name IS NOT NULL) ✅

5. Location lookup (linha 1162):
   → manualPoint = SELECT FROM manual_access_points WHERE name = 'Bordo'
   → ❌ TABELA NÃO EXISTE NO SQLITE!
   → Crash ou resultado vazio → locationLabel = 'Bordo' (fallback)
```

**Mas espera** — a query na linha 1163 vai FALHAR silenciosamente se a tabela não existe, ou pode causar um crash que mata toda a query.

Vou verificar: a tabela `manual_access_points` NÃO está no `CREATE TABLE IF NOT EXISTS` do `initDatabase()` e NÃO é sincronizada pelo `downloadUpdates()` em `sync.js`. **A query vai lançar um erro SQLite ("no such table: manual_access_points")** que abortará toda a chamada `getWorkersOnBoard`.

**CAUSA RAIZ dos eventos manuais não exibidos**: A tabela `manual_access_points` não existe no SQLite local. Quando `getWorkersOnBoard` tenta fazer `SELECT FROM manual_access_points`, o SQLite lança uma exceção, e o servidor Express retorna erro 500. O frontend recebe null/erro e não exibe nada.

### Plano de correção

**Arquivo: `electron/database.js`**

1. **Criar tabela `manual_access_points`** no `initDatabase()`:
```sql
CREATE TABLE IF NOT EXISTS manual_access_points (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  access_location TEXT DEFAULT 'bordo',
  direction_mode TEXT DEFAULT 'both',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  cloud_id TEXT
);
```

2. **Forçar timezone BRT na exibição do `entryTime`**: Em vez de depender do timezone do OS, converter explicitamente para BRT antes de retornar:
```javascript
// Converte UTC ISO string para BRT display string
function toDisplayBRT(isoString) {
  if (!isoString) return isoString;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  // BRT = UTC-3
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  return brt.toISOString(); // Retorna ISO em "hora BRT como se fosse UTC"
}
```
Na verdade, o melhor é retornar o timestamp com sufixo `-03:00` para que `date-fns` interprete corretamente:
```javascript
function utcToBRT(isoString) {
  if (!isoString) return isoString;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const brtMs = d.getTime() - 3 * 3600 * 1000;
  const brt = new Date(brtMs);
  const pad = (n) => String(n).padStart(2, '0');
  return `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth()+1)}-${pad(brt.getUTCDate())}T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`;
}
```
Aplicar na saída do `getWorkersOnBoard` para `entryTime` e `firstEntryTime`.

**Arquivo: `electron/sync.js`**

3. **Adicionar download de `manual_access_points`** no `downloadUpdates()`:
```javascript
// Manual Access Points
try {
  const res = await this.callEdgeFunction('agent-sync/download-manual-access-points', 'GET');
  if (res.manual_access_points) {
    for (const point of res.manual_access_points) {
      this.db.upsertManualAccessPointFromCloud?.(point);
    }
  }
} catch (e) {
  console.error('[sync] Download manual_access_points error:', e.message);
}
```

**Arquivo: `electron/database.js`**

4. **Adicionar `upsertManualAccessPointFromCloud`**:
```javascript
upsertManualAccessPointFromCloud(data) {
  if (!data.id) return;
  const existing = db.prepare('SELECT id FROM manual_access_points WHERE id = ?').get(data.id);
  if (existing) {
    db.prepare('UPDATE manual_access_points SET name=?, project_id=?, access_location=?, direction_mode=?, is_active=? WHERE id=?')
      .run(data.name, data.project_id, data.access_location || 'bordo', data.direction_mode || 'both', data.is_active ? 1 : 0, data.id);
  } else {
    db.prepare('INSERT INTO manual_access_points (id, name, project_id, access_location, direction_mode, is_active, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(data.id, data.name, data.project_id, data.access_location || 'bordo', data.direction_mode || 'both', data.is_active ? 1 : 0, data.created_at || new Date().toISOString());
  }
}
```

**Arquivo: `supabase/functions/agent-sync/index.ts`**

5. **Adicionar endpoint `download-manual-access-points`**:
```typescript
if (req.method === 'GET' && action === 'download-manual-access-points') {
  const { data, error } = await supabase
    .from('manual_access_points')
    .select('id, name, project_id, access_location, direction_mode, is_active, created_at')
    .eq('project_id', agent.project_id)
  if (error) throw error
  return new Response(JSON.stringify({ manual_access_points: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
```

### Resumo dos arquivos

| Arquivo | Ação |
|---|---|
| `electron/database.js` | Criar tabela `manual_access_points`; adicionar upsert; converter timestamps para BRT explícito na saída |
| `electron/sync.js` | Adicionar download de `manual_access_points` no ciclo de sync |
| `supabase/functions/agent-sync/index.ts` | Adicionar endpoint `download-manual-access-points` |

### Por que as correções anteriores não funcionaram

1. **-3h**: As correções anteriores focaram no `startTimestamp` (filtro) e na normalização de timestamps do SQLite sem timezone. Mas o timestamp do agente JÁ está correto em UTC com `Z`. O problema real é que `date-fns format()` usa o timezone do processo Electron/Node, e a máquina pode estar em UTC.

2. **Eventos manuais**: As correções anteriores adicionaram o filtro OR na Edge Function e no `getWorkersOnBoard`, mas **não criaram a tabela `manual_access_points` no SQLite** e **não adicionaram o sync dessa tabela**. A query na linha 1163 crasha com "no such table", abortando tudo.

