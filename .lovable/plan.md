

## Problema

Os relatórios usam `fetchAccessLogs` (em `src/hooks/useDataProvider.ts`, linha 382-394) que filtra eventos por `device_id IN (deviceIds do projeto)`. Eventos manuais têm `device_id = null` e usam `device_name = "Manual - NomeTerminal"` — são completamente excluídos da query.

O dashboard (`fetchWorkersOnBoardFromCloud` em `useSupabase.ts`) já resolve isso consultando `manual_access_points` e filtrando por `device_name`. Os relatórios não fazem isso.

## Correção — 1 arquivo

### `src/hooks/useDataProvider.ts` — Incluir logs manuais na query de relatórios

Modificar `fetchAccessLogs` (linhas 382-394) para, quando há `projectId`:

1. Buscar os `manual_access_points` do projeto (mesma lógica do dashboard)
2. Construir os nomes de dispositivo manual (`"Manual - {name}"`)
3. Fazer duas queries em paralelo:
   - Logs com `device_id IN deviceIds` (eventos do hardware)
   - Logs com `device_id IS NULL` e `device_name IN manualDeviceNames` (eventos manuais)
4. Combinar e ordenar por timestamp

```typescript
if (filters?.projectId) {
  // Hardware devices
  const { data: devices } = await supabase
    .from('devices').select('id').eq('project_id', filters.projectId);
  const deviceIds = (devices || []).map(d => d.id);

  // Manual access points
  const { data: manualPoints } = await supabase
    .from('manual_access_points').select('name').eq('project_id', filters.projectId);
  const manualNames = (manualPoints || []).map(p => `Manual - ${p.name}`);

  if (deviceIds.length === 0 && manualNames.length === 0) return [];

  // Fetch both in parallel
  const [deviceLogs, manualLogs] = await Promise.all([
    deviceIds.length > 0
      ? baseQuery.in('device_id', deviceIds)
      : Promise.resolve({ data: [], error: null }),
    manualNames.length > 0
      ? baseQuery2.is('device_id', null).in('device_name', manualNames)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Merge and sort
  return [...(deviceLogs.data || []), ...(manualLogs.data || [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, filters?.limit || 100);
}
```

### Efeito

Todas as 5 abas de relatório (Trabalhadores, Empresas, Todos Trabalhadores, Visão Geral, Controle de Pernoite) passam a incluir eventos manuais automaticamente, sem alterar nenhum componente de relatório — a correção é na camada de dados compartilhada.

