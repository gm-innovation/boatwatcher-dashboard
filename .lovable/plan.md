

## Diagnóstico e Correções

### Resultado da Investigação

Verifiquei diretamente pelo navegador do sandbox:
- As 4 queries de `access_logs` estão retornando status 200 com dados corretos
- Eventos do leitor facial ESTÃO sendo retornados (13 entradas de dispositivo encontradas)
- O último estado é: entrada por dispositivo às 20:56:38 → saída manual às 20:56:47 (9 segundos depois)
- Dashboard corretamente mostra 0 trabalhadores a bordo
- Nenhum erro no console

**Causa provável**: o intervalo entre entrada (facial) e saída (manual) é muito curto (< 10s). O polling da web (10s) não captura essa janela. O desktop mostra porque usa SQLite local com resposta imediata.

### Correções Propostas

**1. `startTimestamp` com timezone fixo (BRT)**

O `startTimestamp` atual depende do timezone do navegador. No sandbox (PDT/UTC-7), calcula meia-noite como 07:00 UTC. No navegador do usuário (BRT/UTC-3), calcula 03:00 UTC. Isso pode causar inconsistências.

Corrigir para usar sempre meia-noite BRT (UTC-3):
```typescript
// Trocar:
const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
// Por:
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
todayUTC.setUTCHours(3, 0, 0, 0); // meia-noite BRT = 03:00 UTC
const startTimestamp = todayUTC.toISOString();
```

**2. Reduzir polling para 5s**

Trocar `refetchInterval: 10000` por `refetchInterval: 5000` para capturar janelas curtas de on-board.

**3. Verificar UTC no Desktop (`electron/database.js`)**

Confirmar que a alteração de `-03:00` para `Z` foi aplicada corretamente na função `getWorkersOnBoard`.

**4. Verificar `firstEntryTime` para empresas**

Confirmar que `useCompaniesOnBoard` usa `worker.firstEntryTime` (primeiro acesso do dia) em vez de `worker.entryTime` (sessão atual).

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/hooks/useSupabase.ts` | Fixar timezone BRT no startTimestamp + reduzir polling |
| `electron/database.js` | Confirmar UTC fix aplicado |

