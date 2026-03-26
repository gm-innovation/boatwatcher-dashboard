

# Diagnóstico: Correção BRT ainda não aplicada pelo agent local

## Problema Confirmado

O registro mais recente no banco:
- **Entry**: `timestamp: 2026-03-26 13:53:54+00`, `created_at: 2026-03-26 16:54:11+00`
- Diferença: exatamente **3 horas** → o agent.js local NÃO aplicou a correção BRT (servidor não foi reiniciado)

A edge function `validateTimestamp` foi alterada para NÃO corrigir timestamps (apenas rejeitar futuros). Resultado: timestamps chegam 3h atrasados novamente.

O dashboard vê: última saída em `16:37 UTC` > última entrada em `13:53 UTC` → conclui que o trabalhador já saiu → mostra 0.

## Solução: Reintroduzir correção BRT na edge function com janela segura

A correção anterior falhou porque usava janela ampla (2.5h-3.5h) que capturou logs já corrigidos. Agora usaremos uma janela **estreita e segura**:

### 1. `supabase/functions/agent-sync/index.ts` — `validateTimestamp()`

Modificar para detectar e corrigir timestamps que estão **precisamente ~3h atrás** do horário do servidor (janela de 2h50m a 3h10m). Isso é seguro porque:
- Logs corretamente convertidos chegam com diferença de segundos (< 2 min)
- Logs BRT sem correção chegam com diferença de ~3h exatos
- A janela de 20 min é estreita o suficiente para não capturar outros cenários

```typescript
function validateTimestamp(ts: string): { valid: boolean; timestamp: string; reason?: string } {
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return { valid: false, timestamp: ts, reason: 'unparseable' };
  const now = Date.now();
  const diffMs = parsed.getTime() - now;
  
  // Reject future timestamps (> 5 min ahead)
  if (diffMs > 5 * 60 * 1000) {
    return { valid: false, timestamp: ts, reason: `${Math.round(diffMs/60000)}min in future` };
  }
  
  // Detect BRT offset: timestamp is 2h50m–3h10m behind server time
  const lagMs = now - parsed.getTime();
  if (lagMs > 170 * 60000 && lagMs < 190 * 60000) {
    const corrected = new Date(parsed.getTime() + 3 * 3600000);
    console.log(`[validateTimestamp] BRT correction applied: ${ts} → ${corrected.toISOString()}`);
    return { valid: true, timestamp: corrected.toISOString() };
  }
  
  return { valid: true, timestamp: ts };
}
```

### 2. Migração SQL — Corrigir o último registro

```sql
UPDATE access_logs 
SET timestamp = timestamp + interval '3 hours'
WHERE created_at > '2026-03-26 16:50:00+00'
  AND timestamp < '2026-03-26 14:00:00+00'
  AND direction = 'entry';
```

### Arquivos alterados
- **`supabase/functions/agent-sync/index.ts`** — correção BRT com janela segura de 20 min
- **Migração SQL** — corrigir entrada mais recente

