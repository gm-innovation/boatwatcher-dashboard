

# Correção definitiva de timestamps: dados consistentes + heurística no servidor

## Diagnóstico final (com dados reais)

A convenção UTC no banco é **necessária** porque existem 66 eventos manuais (tablet) que usam `new Date().toISOString()` = UTC real. Exemplo:

```text
Manual tablet: 14:31 UTC (created_at 14:31) → brt.ts → exibe 11:31 BRT ✓
```

O ControlID envia BRT rotulado como UTC. Para que ordene corretamente com os manuais, precisa de +3h:

```text
Facial correto: 15:48 BRT → +3h → 18:48 UTC (created_at 18:49) → brt.ts → exibe 15:48 BRT ✓
Facial errado:  15:48 BRT → sem +3h → 15:48 UTC (created_at 18:49) → brt.ts → exibe 12:48 BRT ✗
```

Hoje no banco há uma **mistura**:
- 3 eventos recentes: lag ~3h (raw BRT, sem +3h) — **incorretos**
- 3 eventos com lag ~100s (com +3h da migração anterior) — **corretos**
- ~15 eventos do bulk sync com timestamps mistos — **parcialmente corretos**

A entrada às "15:53" no dashboard é na verdade o evento `7b042d9e` com timestamp 18:53:46 UTC (original 15:53 BRT + 3h). As saídas recentes estão em 15:51 e 15:55 UTC (sem +3h). Como 18:53 > 15:55, o dashboard mostra a entrada como último evento → trabalhador "a bordo" errado.

## Plano de correção (3 partes)

### 1. Heurística +3h no servidor (edge function)

**Arquivo:** `supabase/functions/agent-sync/index.ts`

Reativar autocorreção BRT na função `validateTimestamp`. Se `created_at - timestamp` está entre 2h30 e 3h30 (~9000s a ~12600s), adicionar +3h ao timestamp:

```typescript
function validateTimestamp(ts: string): { valid: boolean; timestamp: string; reason?: string } {
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return { valid: false, timestamp: ts, reason: 'unparseable' };
  
  const now = Date.now();
  const diffMs = now - parsed.getTime();
  const diffSeconds = diffMs / 1000;
  
  // Reject future timestamps (> 5 min)
  if (diffMs < -5 * 60 * 1000) {
    return { valid: false, timestamp: ts, reason: `future timestamp` };
  }
  
  // BRT autocorrection: if lag is ~3h, the agent sent raw BRT
  if (diffSeconds > 9000 && diffSeconds < 12600) {
    const corrected = new Date(parsed.getTime() + 3 * 3600 * 1000);
    console.log(`[validateTimestamp] BRT autocorrect: ${ts} → ${corrected.toISOString()} (lag=${Math.round(diffSeconds)}s)`);
    return { valid: true, timestamp: corrected.toISOString() };
  }
  
  return { valid: true, timestamp: ts };
}
```

Se o agente JÁ aplicou +3h, o lag será ~100s → fora da faixa → sem dupla correção.

### 2. Remover +3h do agent.js

**Arquivo:** `electron/agent.js`

Reverter `normalizeTimestamp` para passar o timestamp do dispositivo sem somar nada. Isso evita dupla correção quando o desktop for atualizado e a heurística do servidor estiver ativa.

### 3. Corrigir dados inconsistentes no banco

SQL para normalizar os 3 eventos recentes (lag ~3h) que estão sem +3h:

```sql
UPDATE access_logs
SET timestamp = timestamp + interval '3 hours', updated_at = now()
WHERE id IN ('e53bba0b-f54d-4950-8aef-330b4cef6bb8', 
             'cb2698d3-4c71-494e-8840-ea08cf3464ff',
             'e9c3b24b-6836-4782-a33c-db91d9ee9a37');
```

E verificar os eventos do bulk sync (created_at ~15:55:23) para garantir consistência — reverter os que receberam +3h indevido de eventos históricos.

### Resultado esperado

- Novos eventos faciais: corrigidos automaticamente no servidor (+3h se necessário)
- Eventos manuais: passam direto (lag ~0s, fora da faixa)
- Dashboard: entrada 18:48 < saída 18:51 e 18:55 → trabalhador corretamente **fora**
- Display: brt.ts converte uniformemente → horários corretos para o usuário

### Arquivos modificados
- `supabase/functions/agent-sync/index.ts` — heurística BRT
- `electron/agent.js` — remover +3h do agente
- Dados via SQL direto (3 registros específicos + verificação do bulk sync)

