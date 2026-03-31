

## Corrigir horário da empresa e UTC no Desktop

### Resumo do problema

1. **Horário da empresa**: deve mostrar o primeiro acesso do dia de qualquer trabalhador vinculado, mas hoje mostra o `min()` dos horários de entrada atuais dos trabalhadores (que podem ser re-entradas). Se um trabalhador entrou às 06:00, saiu e re-entrou às 09:00, o worker mostra 09:00 (correto), mas a empresa deveria mostrar 06:00 e está mostrando 09:00.

2. **UTC no Desktop**: linha 1154 do `electron/database.js` anexa `-03:00` a timestamps sem marcador, causando atraso de 3h. Deve ser `Z`.

3. **Desktop SQL**: a query atual usa `ROW_NUMBER() ORDER BY ASC` com `rn = 1`, retornando apenas a **primeira** entrada. Se o trabalhador saiu e re-entrou, a primeira entrada tem saída correspondente e o trabalhador não aparece. Precisa retornar a **última entrada sem saída** como `entryTime` do worker, e separadamente a **primeira entrada do dia** como `firstEntryTime` para o cálculo da empresa.

### Alterações

**1. `src/hooks/useSupabase.ts`**

Na função `fetchWorkersOnBoardFromCloud`, após construir o `workersOnBoard` map (linha 275):
- Criar `firstEntryMap` com a primeira entrada do dia de cada worker (entryLogs já está ascending):
```typescript
const firstEntryMap = new Map<string, string>();
for (const entry of entryLogs || []) {
  const key = entry.worker_name || entry.worker_id || '';
  if (key && !firstEntryMap.has(key)) {
    firstEntryMap.set(key, entry.timestamp);
  }
}
```
- No return (linha 311), adicionar campo `firstEntryTime`:
```typescript
entryTime: onBoard.entry_time,
firstEntryTime: firstEntryMap.get(key) || onBoard.entry_time,
```

Na função `useCompaniesOnBoard` (linha 354-382):
- Usar `worker.firstEntryTime` em vez de `worker.entryTime` para calcular o horário da empresa:
```typescript
const workerFirstEntry = worker.firstEntryTime || worker.entryTime;
// usar workerFirstEntry na comparação de min
```

**2. `electron/database.js`**

- **UTC fix** (linha 1154): trocar `'-03:00'` por `'Z'`

- **SQL**: mudar a query para retornar tanto a última entrada sem saída (para o worker) quanto a primeira entrada do dia (para a empresa). Adicionar uma segunda CTE ou subquery para buscar `MIN(timestamp)` como `first_entry_time` por worker, e incluir no resultado. No mapeamento (linha 1176), retornar ambos:
```javascript
entryTime,           // última entrada sem saída
firstEntryTime: ..., // MIN do dia
```

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/hooks/useSupabase.ts` | Adicionar `firstEntryMap` + usar no `useCompaniesOnBoard` |
| `electron/database.js` | Fix UTC (`Z`), SQL retornar first + last entry |

