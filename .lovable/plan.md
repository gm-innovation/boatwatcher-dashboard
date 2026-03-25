

## Remover Atividade Recente + Corrigir Atualização em Tempo Real

### Problema
1. O card "Atividade Recente" é redundante — a tabela de trabalhadores a bordo já mostra quem está presente
2. Eventos de saída do dispositivo não atualizam o dashboard porque o agente local pode não estar sincronizando em tempo real com a nuvem

### Alterações

#### 1. Remover RecentActivityFeed do Dashboard
**Arquivo:** `src/components/dashboard/Dashboard.tsx`
- Remover import e uso de `RecentActivityFeed`
- O layout volta ao padrão: tabela de trabalhadores (3/5) + lista de empresas (2/5) sem o card extra

#### 2. Aumentar frequência de refetch da query `workers-on-board`
**Arquivo:** `src/hooks/useSupabase.ts`
- Reduzir `refetchInterval` de 30s para 10s para capturar mudanças mais rapidamente
- Isso garante que mesmo sem realtime (Desktop offline), os dados atualizam em até 10s

#### 3. Garantir que o realtime invalida corretamente
**Arquivo:** `src/hooks/useRealtimeAccessLogs.ts`
- Já escuta INSERTs e invalida `workers-on-board` — está correto
- Quando um evento de saída chega à nuvem, a query é re-executada e o worker é removido da lista

### Nota sobre sincronização Desktop → Nuvem
O fluxo de sincronização (agente local → edge function `agent-sync/upload-logs` → tabela `access_logs`) já está implementado. Se o dispositivo de saída gerou um evento mas não apareceu, o problema é que o agente local não enviou o log para a nuvem ainda (ciclo de sync é 60s). Não há mudança de código necessária aqui — o polling de 10s na query cloud + realtime garantem que assim que o log chegar, o dashboard atualiza.

