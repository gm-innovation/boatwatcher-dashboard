

## Por que os acessos manuais nao aparecem no dashboard

### Causa raiz

O dashboard filtra os logs de acesso por `device_id` vinculado ao projeto:

```text
access_logs  →  .in('device_id', deviceIds)  →  deviceIds vem de devices.project_id
```

O modulo de acesso manual insere logs **sem `device_id`** (apenas `device_name: "Manual - Terminal"`), entao a query do dashboard nunca encontra esses registros.

### Solucao

Duas alteracoes:

**1. `src/pages/AccessControl.tsx`** — Incluir `device_id` no log inserido, usando um ID convencional derivado do terminal. Como `manual_access_points` nao e a tabela `devices`, sera necessario tambem incluir o `project_id` do terminal para permitir filtragem alternativa.

Na verdade, a melhor abordagem e ajustar a query do dashboard para tambem considerar logs sem `device_id` mas com `device_name` que comeca com "Manual".

**2. `src/hooks/useSupabase.ts`** (funcao `fetchWorkersOnBoardFromCloud`) — Alem da query por `device_id`, fazer uma segunda query para logs manuais do mesmo projeto:

- Buscar `manual_access_points` com `project_id` igual ao projeto selecionado
- Construir os nomes de dispositivo (`Manual - {nome}`)
- Fazer uma query adicional em `access_logs` filtrando por `device_name` IN esses nomes (quando `device_id` e null)
- Mesclar os resultados com os logs dos dispositivos fisicos

### Detalhes tecnicos

Em `fetchWorkersOnBoardFromCloud`:

```typescript
// Apos a query de devices, buscar terminais manuais do projeto
const { data: manualPoints } = await supabase
  .from('manual_access_points')
  .select('name, project_id')
  .eq('project_id', projectId);

const manualDeviceNames = (manualPoints || []).map(p => `Manual - ${p.name}`);

// Query adicional para logs manuais (device_id IS NULL, device_name em manualDeviceNames)
if (manualDeviceNames.length > 0) {
  const { data: manualEntries } = await supabase
    .from('access_logs')
    .select('worker_id, worker_name, device_name, device_id, timestamp')
    .eq('direction', 'entry')
    .eq('access_status', 'granted')
    .is('device_id', null)
    .in('device_name', manualDeviceNames)
    .gte('timestamp', startTimestamp)
    .lte('timestamp', maxTimestamp);

  // Idem para exits manuais
  const { data: manualExits } = await supabase
    .from('access_logs')
    .select('worker_id, worker_name, timestamp')
    .eq('direction', 'exit')
    .is('device_id', null)
    .in('device_name', manualDeviceNames)
    .gte('timestamp', startTimestamp)
    .lte('timestamp', maxTimestamp);

  // Mesclar com entryLogs e exitLogs existentes
}
```

Os logs manuais terao `location` = "Manual" no dashboard para diferenciar visualmente.

### Arquivos afetados

| Arquivo | Acao |
|---|---|
| `src/hooks/useSupabase.ts` | Adicionar query para logs manuais na funcao `fetchWorkersOnBoardFromCloud` |

