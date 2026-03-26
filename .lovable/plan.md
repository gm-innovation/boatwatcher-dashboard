

# Alternar Entrada/Saída — Nunca Eventos Consecutivos do Mesmo Tipo

## Problema
Atualmente o `rawLogs` exibe todos os eventos brutos em sequência, permitindo entradas consecutivas ou saídas consecutivas. A regra de negócio exige alternância estrita: entrada → saída → entrada → saída.

## Solução

### `src/components/reports/WorkerTimeReport.tsx`

Adicionar uma função `normalizeAlternatingLogs` que filtra os logs ordenados por timestamp para garantir alternância:

1. Percorrer logs ordenados cronologicamente
2. Manter estado do último tipo aceito (`entry` ou `exit`)
3. Só incluir o log se for diferente do último tipo aceito
4. Primeiro log válido deve ser `entry`; após `entry`, só aceitar `exit`; após `exit`, só aceitar `entry`

Aplicar esta função em **dois pontos**:
- No `rawLogs` salvo em cada `WorkerTimeRow` (afeta a expansão com períodos diurno/noturno)
- Nos arrays `entries`/`exits` usados para calcular `firstEntry`, `lastExit`, `totalMinutes` e `isOnBoard`

```typescript
function normalizeAlternatingLogs(sorted: Array<{ direction: string; [k: string]: any }>) {
  const result = [];
  let expectEntry = true;
  for (const log of sorted) {
    if (expectEntry && log.direction === 'entry') {
      result.push(log);
      expectEntry = false;
    } else if (!expectEntry && log.direction === 'exit') {
      result.push(log);
      expectEntry = true;
    }
    // skip consecutive same-direction logs
  }
  return result;
}
```

Usar os logs normalizados para:
- `firstEntry` = primeiro log (sempre entry)
- `lastExit` = último log se for exit
- `isOnBoard` = último log é entry (sem exit correspondente)
- `totalMinutes` = soma dos pares entry→exit
- `rawLogs` passado à expansão = apenas os alternados

### Arquivo alterado
- `src/components/reports/WorkerTimeReport.tsx`

