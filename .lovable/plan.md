

## Diagnóstico Verificado com Dados Reais

### Dados do Postgres (consultados agora)

Após 15:00 UTC de hoje, **ZERO eventos do leitor facial** chegaram ao Postgres. Apenas eventos manuais:
```text
15:38:06 Manual entry | 15:39:02 Manual exit | 15:59:35 Manual entry | 16:00:41 Manual exit
```

Status do agente (Edge Function logs): `captured=0 unsynced=0 uploaded=0`

### Estado ATUAL do código (no repositório vs no Desktop em execução)

| Arquivo | No repositório | No Desktop rodando |
|---|---|---|
| `electron/agent.js` | +3h restaurado ✅ | **SEM +3h** (build antigo) |
| `electron/main.js` | TZ=BRT ✅ | **Sem TZ** (build antigo) |
| `supabase/functions/agent-sync/index.ts` | Sem autocorreção | Sem autocorreção (deployed) |
| `src/hooks/useSupabase.ts` | Local-first ❌ | Local-first ❌ |
| `electron/sync.js` | maxCreatedAt ✅ mas sem encodeURI ❌ | **Sem ambos** (build antigo) |
| `electron/database.js` | startTimestamp = `00:00Z` ❌ | `00:00Z` ❌ |

---

## 4 Problemas Raiz Confirmados

### Problema 1: Web não mostra eventos faciais

**Causa**: O Desktop em execução (build antigo) NÃO tem o +3h. Envia `"08:38:00.000Z"` (BRT como UTC). A Edge Function (já deployed) NÃO corrige mais. Postgres armazena `08:38+00`. A web mostra `05:38` (aplica -3h do browser BRT). Parece "não aparecer" porque o horário está 3h errado e pode parecer do dia anterior.

**Mas pior**: o status mostra `captured=0 uploaded=0` — os eventos recentes do leitor podem não estar sendo uploadados de todo (possivelmente o sync cycle está travando no `downloadAccessLogs` que crasha com erro 22007 antes de chegar ao upload).

### Problema 2: Desktop mostra horário -3h

**Causa**: O Desktop usa `getWorkersOnBoard` do SQLite local (local-first). Os timestamps no SQLite são `08:38Z` (BRT como UTC). O Electron (sem TZ=BRT no build antigo) pode interpretar como UTC e mostrar `08:38` ou como BRT e mostrar `05:38` — ambos errados.

### Problema 3: Eventos manuais não aparecem no Desktop

**Causa**: O `downloadAccessLogs` crasha com erro Postgres `22007` porque o parâmetro `since` contém `+00:00` que vira espaço na URL. Nenhum log é baixado da nuvem → eventos manuais nunca chegam ao SQLite.

### Problema 4: Saída facial não cancela entrada manual (na web)

**Causa**: Se os eventos faciais não chegam ao Postgres (problema 1), a web só vê eventos manuais. Saída facial nunca existiu na nuvem → não cancela nada.

---

## Plano de Correção — 4 Arquivos

### 1. `src/hooks/useSupabase.ts` — Cloud-first no Desktop (CORREÇÃO PRINCIPAL)

**Esta é a mudança mais importante**. Quando online, o Desktop consulta a nuvem (mesma fonte que a web). Só usa SQLite quando offline.

Linhas 122-136: inverter a ordem:
```typescript
// Desktop with local server: cloud-first, local-fallback for offline
if (usesLocalServer()) {
  // Cloud has all events (manual + facial) with correct timestamps
  const cloudResult = await fetchWorkersOnBoardFromCloud(projectId, startTimestamp, dateFilter);
  if (cloudResult !== null) return cloudResult;
  
  // Offline fallback: use local SQLite data
  if (dateFilter === 'today') {
    const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
    if (localWorkersOnBoard !== null) {
      return localWorkersOnBoard;
    }
  }
  return [];
}
```

**Efeito**: Desktop e Web usam a mesma fonte de dados → mesmos horários, mesmos eventos, mesma lógica de pareamento entry/exit. Resolve problemas 2, 3 e 4 de uma vez (quando online).

### 2. `supabase/functions/agent-sync/index.ts` — Restaurar autocorreção BRT inteligente

O Desktop em execução NÃO tem o +3h (build antigo). Sem autocorreção na Edge Function, os timestamps ficam errados no Postgres. Precisamos de compatibilidade com ambos os builds.

Modificar `validateTimestamp` (linhas 14-27):
```typescript
function validateTimestamp(ts: string): { valid: boolean; timestamp: string; reason?: string } {
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return { valid: false, timestamp: ts, reason: 'unparseable timestamp' };
  const now = Date.now();
  const diffMs = parsed.getTime() - now;

  // Reject timestamps more than 5 minutes in the future
  if (diffMs > 5 * 60 * 1000) {
    return { valid: false, timestamp: ts, reason: `timestamp ${Math.round(diffMs / 60000)}min in the future` };
  }

  // Smart BRT correction: if timestamp is 160-200min behind now,
  // it's likely BRT sent as UTC by an old agent build → add 3h
  const lagMin = (now - parsed.getTime()) / 60000;
  if (lagMin >= 160 && lagMin <= 200) {
    const corrected = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
    return { valid: true, timestamp: corrected.toISOString() };
  }

  return { valid: true, timestamp: ts };
}
```

**Efeito**: Eventos do build antigo (sem +3h) são corrigidos automaticamente. Eventos do build novo (com +3h) passam direto (lag ~0-2min). Resolve problema 1.

### 3. `electron/sync.js` — Fix URL encoding

Linha 321: o parâmetro `since` com `+00:00` causa crash no Postgres.

```javascript
// ANTES:
const response = await this.callEdgeFunction(`agent-sync/download-access-logs?since=${since}`, 'GET');

// DEPOIS:
const response = await this.callEdgeFunction(`agent-sync/download-access-logs?since=${encodeURIComponent(since)}`, 'GET');
```

**Efeito**: Download de access_logs para de crashar → eventos manuais são baixados para o SQLite → fallback offline funciona corretamente.

### 4. `electron/database.js` — Corrigir filtro de data para offline

Linha 1111-1112: usa meia-noite UTC em vez de meia-noite BRT.

```javascript
// ANTES:
const now = new Date();
const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const startTimestamp = todayStr + 'T00:00:00.000Z';

// DEPOIS (meia-noite BRT = 03:00 UTC, consistente com a web):
const now = new Date();
const todayBRT = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
todayBRT.setUTCHours(3, 0, 0, 0);
const startTimestamp = todayBRT.toISOString();
```

**Efeito**: Quando offline, o filtro de "hoje" no SQLite é consistente com a web.

---

## Por que vai funcionar desta vez

As tentativas anteriores tentaram consertar o pipeline local (normalização, tabelas, paginação). Mas o problema fundamental é que o Desktop **insiste em usar dados locais incompletos e com timestamps errados**.

A correção principal (item 1) é **mover o Desktop para cloud-first**. Quando online, ele consulta o mesmo Postgres que a web. Resultado idêntico. A autocorreção (item 2) garante que eventos de QUALQUER versão do agente cheguem corretos ao Postgres.

Os itens 3 e 4 são correções para o modo offline — download de logs funcional + filtro de data correto.

### Arquivos que NÃO precisam de alteração
- `electron/agent.js` — já tem +3h restaurado ✅ (será aplicado no próximo rebuild)
- `electron/main.js` — já tem TZ=BRT ✅ (será aplicado no próximo rebuild)

