

# Fix: Correção BRT para Timestamps Numéricos do ControlID

## Problema Raiz

O payload do ControlID usa `"time": 1774531220` (Unix timestamp numérico). O relógio do dispositivo está em BRT, então esse valor representa **13:20:20 BRT**, mas o agent trata como 13:20:20 UTC (sem aplicar +3h). O evento é armazenado como `13:20:20+00` em vez de `16:20:20+00`.

**Consequência no dashboard:** A última saída é `16:13:19+00` (correta). A nova entrada é `13:20:20+00` (errada, 3h atrás). O dashboard vê `entrada < saída` e conclui que o trabalhador já saiu → mostra 0 a bordo.

**Confirmação:** O evento #25 está na nuvem com `timestamp: 2026-03-26 13:20:20+00` — exatamente 3h a menos que o esperado.

## Correção

### 1. `electron/agent.js` — `normalizeTimestamp()`

Aplicar a correção BRT (+3h) também para timestamps numéricos. O ControlID configura seu relógio em hora local (BRT) e gera Unix timestamps a partir desse relógio local, resultando em valores 3h atrasados em relação ao UTC real.

```javascript
function normalizeTimestamp(event) {
  const raw = event.timestamp || event.time || event.date || event.datetime;
  if (!raw) return null;
  const parsed = typeof raw === 'number' ? raw * 1000 : Date.parse(raw);
  if (isNaN(parsed)) return null;
  const d = new Date(parsed);
  // ControlID reports local time (BRT) in ALL formats — both string and numeric.
  // Numeric Unix timestamps from the device are computed from its local clock (BRT),
  // so they are 3h behind real UTC. Always apply +3h correction.
  if (typeof raw === 'number') {
    d.setHours(d.getHours() + 3);
  } else if (typeof raw === 'string' && !/[Zz+\-]\d{2}/.test(raw)) {
    d.setHours(d.getHours() + 3);
  }
  return d.toISOString();
}
```

### 2. Migração SQL — Corrigir evento #25 e similares

Corrigir os logs que foram armazenados com timestamps numéricos sem correção BRT. Estes têm `created_at` recente mas `timestamp` 3h atrasado:

```sql
UPDATE access_logs 
SET timestamp = timestamp + interval '3 hours'
WHERE timestamp < '2026-03-26 14:00:00+00'
  AND created_at > '2026-03-26 16:00:00+00';
```

### Arquivos alterados
- **`electron/agent.js`** — corrigir `normalizeTimestamp` para timestamps numéricos
- **Migração SQL** — corrigir logs existentes com offset errado

