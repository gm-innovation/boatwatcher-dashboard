

## Correção Definitiva: Timestamps 3h Atrasados — Investigação Completa

### Dados no banco confirmam o problema

```text
timestamp:  2026-04-08 08:17:41+00   ← deveria ser 11:17:41+00 (UTC real)
created_at: 2026-04-08 11:19:22+00   ← correto (gerado pelo Postgres)
Diferença:  exatamente ~3h
```

O evento aconteceu às **08:17 BRT** (horário local). O sistema armazenou como `08:17 UTC` (sem o offset). Quando o frontend converte UTC→BRT para exibição, subtrai 3h → mostra **05:17**.

### Todos os caminhos de ingestão afetados

Existem **3 caminhos** por onde timestamps entram no banco. **Dois deles** ainda estão com o bug:

| Caminho | Arquivo | Status |
|---------|---------|--------|
| 1. Polling local (agente) | `electron/agent.js` → `normalizeTimestamp()` | **Corrigido** ✓ |
| 2. Edge Function `api` (notificações DAO) | `supabase/functions/api/index.ts` → `parseEventTime()` | **BUG** — linha 46: `new Date(timestamp).toISOString()` sem +3h |
| 3. Edge Function `controlid-webhook` | `supabase/functions/controlid-webhook/index.ts` → linhas 95 e 156 | **BUG** — `new Date(event.time * 1000).toISOString()` sem +3h |

O caminho **2** (`api/index.ts`) é o principal — é por ele que os dados estão entrando agora, tanto via web quanto via desktop (quando o agente sincroniza via cloud). O caminho **3** (webhook) é menos usado mas tem o mesmo bug.

### Plano de correção

#### 1. Corrigir `supabase/functions/api/index.ts` — `parseEventTime()`

```typescript
function parseEventTime(rawTime?: string | number) {
  if (rawTime === undefined || rawTime === null || rawTime === '') {
    return new Date().toISOString()
  }

  const numericTime = Number(rawTime)
  if (!Number.isNaN(numericTime)) {
    const timestamp = numericTime < 9999999999 ? numericTime * 1000 : numericTime
    // ControlID firmware generates epoch from BRT wall clock.
    // Add 3h (10_800_000ms) to convert to true UTC.
    return new Date(timestamp + 3 * 3600 * 1000).toISOString()
  }

  // String with timezone — parse directly
  const parsed = new Date(rawTime)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  // String without timezone — check and add BRT offset
  const rawStr = String(rawTime)
  const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(rawStr.trim())
  if (!hasTimezone) {
    return new Date(parsed.getTime() + 3 * 3600 * 1000).toISOString()
  }

  return parsed.toISOString()
}
```

#### 2. Corrigir `supabase/functions/controlid-webhook/index.ts` — linhas 95 e 156

Alterar ambas as linhas de:
```typescript
timestamp: new Date(event.time ? event.time * 1000 : Date.now()).toISOString()
```
Para:
```typescript
timestamp: new Date(event.time ? event.time * 1000 + 3 * 3600 * 1000 : Date.now()).toISOString()
```

#### 3. Migração SQL — corrigir dados históricos recentes

Os logs dos últimos dias têm timestamps 3h atrasados. Corrigir retroativamente usando a diferença com `created_at`:

```sql
UPDATE access_logs
SET timestamp = timestamp + interval '3 hours'
WHERE created_at > now() - interval '30 days'
  AND EXTRACT(EPOCH FROM (created_at - timestamp)) BETWEEN 10500 AND 11100;
```

Critério: logs onde a diferença `created_at - timestamp` está entre 2h55min e 3h05min (margem de segurança para não alterar logs manuais que são criados com `new Date().toISOString()` e têm diferença ~0).

Além disso, os logs antigos com device clock errado (timestamps de 2024-10-04) — são 5573 registros. Esses não podem ser corrigidos com +3h pois o relógio do dispositivo estava completamente errado (550 dias atrás). Recomendo não alterá-los.

#### 4. Re-deploy das Edge Functions

Ambas as functions (`api` e `controlid-webhook`) precisam ser re-deployed para que a correção entre em vigor imediatamente na web.

### Impacto
- **Web**: corrigido imediatamente após deploy das edge functions + migração
- **Desktop**: corrigido imediatamente para dados vindos do cloud; agente local já está corrigido mas precisa de nova release para o `.exe`
- **Dados históricos recentes**: corrigidos pela migração
- **Dados com clock errado do dispositivo (2024-10-xx)**: mantidos como estão

### Arquivos alterados
1. `supabase/functions/api/index.ts` — `parseEventTime()` com +3h
2. `supabase/functions/controlid-webhook/index.ts` — 2 linhas com +3h
3. Migração SQL — UPDATE nos dados existentes

