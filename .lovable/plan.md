

# Fix: Timezone UTC-3 em Todo o Sistema

## Diagnóstico

Os timestamps do ControlID são hora local (BRT) sem fuso. O agent converte via `new Date(parsed).toISOString()` que, no Node.js, trata strings sem timezone como **UTC**. Resultado: `13:11 BRT` é armazenado como `13:11:00+00` (UTC) em vez de `16:11:00+00`. No browser, `format(new Date("13:11+00"), 'HH:mm')` subtrai 3h → mostra `10:11`. Erro duplo.

## Correções

### 1. Agent — `electron/agent.js` → `normalizeTimestamp()`

Forçar offset BRT (-03:00) nos timestamps do ControlID antes da conversão ISO:

```javascript
function normalizeTimestamp(event) {
  const raw = event.timestamp || event.time || event.date || event.datetime;
  if (!raw) return null;
  const parsed = typeof raw === 'number' ? raw * 1000 : Date.parse(raw);
  if (isNaN(parsed)) return null;
  // ControlID reports local time (BRT) — if no timezone in raw string, 
  // the Date was parsed as UTC incorrectly. Re-interpret as BRT (UTC-3).
  const d = new Date(parsed);
  if (typeof raw === 'string' && !/[Zz+\-]\d{2}/.test(raw)) {
    // Raw had no timezone → was local BRT, shift +3h to get real UTC
    d.setHours(d.getHours() + 3);
  }
  return d.toISOString();
}
```

Isso garante que novos eventos sejam armazenados com UTC correto.

### 2. Migração SQL — Corrigir timestamps existentes

Criar migration para ajustar os 259 logs existentes que foram salvos com offset errado (BRT tratado como UTC):

```sql
UPDATE access_logs
SET timestamp = timestamp + interval '3 hours'
WHERE timestamp < '2026-03-27T00:00:00Z';
```

### 3. Dashboard — Filtro de data UTC-aware

Já está correto: `localMidnight.toISOString()` calcula meia-noite local e converte para UTC. Após a migração, os timestamps estarão corretos e o `format(new Date(entryTime), 'HH:mm')` no browser exibirá a hora BRT corretamente (o browser do usuário está em BRT).

### Arquivos alterados
- **`electron/agent.js`** — `normalizeTimestamp`: detectar timestamps sem fuso e aplicar offset BRT
- **Migração SQL** — corrigir timestamps históricos com +3h
- **Nenhuma mudança no frontend** — após a correção dos dados, `format()` do date-fns já exibe na timezone local do browser

