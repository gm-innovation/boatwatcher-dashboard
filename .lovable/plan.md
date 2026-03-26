

# Fix: Correção de Timestamps no Pipeline Completo

## Problema

O `normalizeTimestamp` no agent.js foi corrigido, mas o servidor local do usuário ainda não foi reiniciado com o novo código. Enquanto isso, novos eventos continuam chegando na nuvem com timestamps 3h atrasados. Exemplo: saída às 13:28 BRT chega como `13:28:35+00` em vez de `16:28:35+00`.

Além disso, a telemetria mostra que o dispositivo "Engenharia - Saída" já tem event ID 245, mas apenas ~267 eventos estão na nuvem — confirmando que eventos estão sendo capturados e sincronizados, mas com timestamps errados.

## Solução em 2 camadas

### 1. Edge Function `agent-sync` — Defesa server-side (linha 332-335)

Adicionar correção BRT na edge function `upload-logs` para que, mesmo que o agent envie timestamps sem correção, a nuvem aplique o offset. Detectar timestamps que parecem estar 3h atrasados comparando com `Date.now()`:

```typescript
// Na seção de sanitização de cada log (linha ~332)
// Se o timestamp não tem timezone info e está ~3h atrás do horário atual,
// aplicar correção BRT
function correctBrtTimestamp(ts: string): string {
  const parsed = new Date(ts);
  if (isNaN(parsed.getTime())) return ts;
  const now = Date.now();
  const diff = now - parsed.getTime();
  // Se timestamp está entre 2.5h e 3.5h atrás do now, provavelmente é BRT sem correção
  if (diff > 2.5 * 3600000 && diff < 3.5 * 3600000) {
    // Mas esse heurístico é frágil para logs históricos
    // Melhor: verificar se o timestamp NÃO tem timezone suffix
    parsed.setHours(parsed.getHours() + 3);
    return parsed.toISOString();
  }
  return ts;
}
```

**Abordagem mais segura:** Em vez de heurística temporal, verificar se o ISO string do timestamp termina com `+00:00` ou `Z` mas está consistentemente 3h atrás do `created_at` do insert. A melhor solução é simplesmente forçar a correção se o timestamp parece estar no passado em relação ao momento atual por ~3h.

**Decisão:** Aplicar a correção diretamente — como TODOS os dispositivos ControlID do sistema estão em BRT e o agent.js já faz a correção (quando atualizado), a edge function apenas serve como safety net. Vamos comparar cada timestamp com `Date.now()`: se a diferença estiver entre 2.5h-3.5h, adicionar 3h.

### 2. Migração SQL — Corrigir logs existentes com offset errado

Os logs recém-sincronizados (exit events do dispositivo Saída) ainda têm timestamps 3h atrás. Corrigir:

```sql
UPDATE access_logs
SET timestamp = timestamp + interval '3 hours'
WHERE timestamp < NOW() - interval '2 hours'
  AND created_at > NOW() - interval '2 hours';
```

Isso pega logs cujo `timestamp` é antigo mas `created_at` é recente — sinal claro de offset BRT não aplicado.

### Arquivos alterados
- **`supabase/functions/agent-sync/index.ts`** — safety net BRT na rota `upload-logs`
- **Migração SQL** — corrigir timestamps existentes com offset errado

