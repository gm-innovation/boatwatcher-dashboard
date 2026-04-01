

## Diagnóstico: Por que o evento facial não aparece na Web

### Dados reais no banco (hoje)

```text
Timestamp       | created_at    | Tipo          | Direção
11:23:20        | 11:23:20      | Manual ENTRY  | entry
11:24:53        | 11:25:54      | Facial ENTRY  | entry    ← dispositivo reportou 11:24:53
11:25:16        | 11:25:17      | Manual EXIT   | exit
```

### Causa raiz

O código atual (linha 261-264) verifica se existe uma saída com `timestamp` posterior a cada entrada. Para a entrada facial com `timestamp: 11:24:53`, a saída manual com `timestamp: 11:25:16` é posterior — então o código cancela a entrada facial.

**Mas na realidade**: a entrada facial foi registrada na nuvem (`created_at: 11:25:54`) DEPOIS da saída manual (`created_at: 11:25:17`). O `timestamp` do dispositivo ControlID reflete o relógio do hardware, que pode estar atrasado em relação ao momento real do sync.

O algoritmo atual é fundamentalmente errado: ele trata entradas e saídas como pares independentes. Uma única saída cancela TODAS as entradas anteriores. O correto é determinar o **estado final** do trabalhador processando todos os eventos em ordem cronológica.

### Correção proposta

**Arquivo: `src/hooks/useSupabase.ts`** — função `fetchWorkersOnBoardFromCloud`

Substituir a lógica atual de matching entry/exit (linhas 180-276) por:

1. Buscar TODOS os logs (entry + exit) do dia em uma única query, ordenados por `created_at ASC`
2. Para cada trabalhador, processar eventos em ordem e rastrear o estado final (on/off board)
3. Se o último evento for entry → trabalhador está a bordo

```typescript
// Buscar TODOS os eventos do dia (entries + exits), ordenados por created_at
const { data: allLogs, error: logsError } = await supabase
  .from('access_logs')
  .select('worker_id, worker_name, device_name, device_id, timestamp, direction, created_at')
  .eq('access_status', 'granted')
  .gte('timestamp', startTimestamp)
  .lte('timestamp', maxTimestamp)
  .order('created_at', { ascending: true });

// Filtrar por dispositivos do projeto + pontos manuais
const relevantLogs = (allLogs || []).filter(log => 
  (log.device_id && deviceIds.includes(log.device_id)) ||
  (!log.device_id && manualDeviceNames.includes(log.device_name))
);

// Processar estado final de cada trabalhador
const workerState = new Map<string, any>();
for (const log of relevantLogs) {
  const key = log.worker_name || log.worker_id || '';
  if (!key) continue;
  
  if (log.direction === 'entry') {
    workerState.set(key, {
      worker_id: log.worker_id,
      worker_name: log.worker_name,
      device_name: log.device_name,
      device_id: log.device_id,
      entry_time: log.timestamp,
      isOnBoard: true,
    });
  } else if (log.direction === 'exit') {
    const existing = workerState.get(key);
    if (existing) existing.isOnBoard = false;
  }
}

// Filtrar apenas quem está a bordo
const workersOnBoard = new Map<string, any>();
for (const [key, state] of workerState) {
  if (state.isOnBoard) {
    workersOnBoard.set(key, state);
  }
}
```

Esta abordagem:
- Usa `created_at` para ordenação (reflete a ordem real de chegada dos eventos)
- Resolve o estado final do trabalhador processando todos os eventos em sequência
- Elimina o bug onde uma saída anterior ao sync cancela uma entrada posterior

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/hooks/useSupabase.ts` | Reescrever lógica entry/exit para usar estado final por `created_at` |

