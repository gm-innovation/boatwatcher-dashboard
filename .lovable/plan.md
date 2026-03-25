

## Resolver Dashboard Vazio — Dados em Tempo Real para Web e Desktop

### Problemas identificados

1. **Logs existentes não têm `device_id`** — os 5 access_logs na nuvem têm `device_id: NULL`, então não podem ser associados a nenhum projeto
2. **A query cloud não filtra por projeto** — `useWorkersOnBoard` busca TODOS os access_logs sem filtrar pelo projeto selecionado (deveria filtrar via `device_id` → `devices.project_id`)
3. **Sem dados de hoje** — último log é de 13/mar, dashboard filtra por hoje
4. **Desktop e Web precisam ver os mesmos dados** — o Desktop já tem fallback para nuvem, mas a query cloud precisa funcionar corretamente

### Plano de correção

#### 1. Corrigir query `useWorkersOnBoard` para filtrar por projeto
**Arquivo:** `src/hooks/useSupabase.ts`

Antes de buscar `access_logs`, buscar os `device_ids` vinculados ao projeto e filtrar os logs por esses devices. Isso garante que Web e Desktop (modo fallback) vejam apenas eventos do projeto selecionado.

```typescript
// Buscar devices do projeto
const { data: devices } = await supabase
  .from('devices')
  .select('id')
  .eq('project_id', projectId);

const deviceIds = (devices || []).map(d => d.id);
if (deviceIds.length === 0) return [];

// Filtrar entry logs por devices do projeto
const { data: entryLogs } = await supabase
  .from('access_logs')
  .select('worker_id, worker_name, device_name, timestamp')
  .eq('direction', 'entry')
  .eq('access_status', 'granted')
  .in('device_id', deviceIds)
  .gte('timestamp', ...)
```

#### 2. Adicionar `RecentActivityFeed` ao Dashboard
**Arquivo:** `src/components/dashboard/Dashboard.tsx`

O componente `RecentActivityFeed` já existe mas não é exibido no dashboard. Adicioná-lo para mostrar atividade recente em tempo real.

#### 3. Inserir dados de teste para validação
Inserir access_logs com timestamps de hoje, vinculados aos devices e workers existentes:
- Device: `81f1c377...` (Engenharia - Entrada) / `b9e59f45...` (Engenharia - Saída)
- Worker: `46dc598a...` (Alexandre Silva)
- Project: `8685513e...` (Skandi Botafogo)

#### 4. Garantir paridade Desktop ↔ Web
O `useDataProvider.ts` já implementa `executeWithDesktopFallback` — quando o servidor local está disponível, usa SQLite; quando não, usa Supabase cloud. A correção na query cloud (passo 1) beneficia ambas as plataformas automaticamente. O `useRealtimeAccessLogs` já escuta INSERTs na tabela `access_logs` para atualização em tempo real na Web, e o Desktop usa polling de 5s via `RecentActivityFeed`.

### Arquivos a alterar
- `src/hooks/useSupabase.ts` — filtrar access_logs por device_id do projeto
- `src/components/dashboard/Dashboard.tsx` — adicionar RecentActivityFeed
- **Migração SQL** — inserir dados de teste

