

# Exibir Telemetria dos Dispositivos na Web (via Nuvem)

## Problema
O card "Telemetria dos Dispositivos" no painel de Diagnóstico só aparece quando `isLocalRuntime` é verdadeiro (modo Desktop com servidor local). Quando acessado pela Web, o painel não consegue acessar `localhost:3001/api/sync/diagnostics` e portanto não exibe os dados de telemetria nem o payload do último evento.

## Solução
Fazer o servidor local **enviar** a telemetria dos dispositivos para a nuvem a cada ciclo de sincronização, e o painel Web **ler** esses dados da tabela `local_agents`.

## Plano (3 arquivos)

### 1. `electron/sync.js` — Upload de telemetria no ciclo de sync
No final do `triggerSync()`, coletar `agentController.getStatus().devices` e atualizar o campo `configuration` do `local_agents` na nuvem via `agent-sync/status`:
```javascript
// Após upload/download, enviar telemetria
const agentStatus = this.agentController?.getStatus?.();
if (agentStatus?.devices) {
  await this.callEdgeFunction('agent-sync/status', 'POST', {
    version: '1.3.1',
    deviceTelemetry: agentStatus.devices
  });
}
```

### 2. `supabase/functions/agent-sync/index.ts` — Rota `status` salvar telemetria
Na rota `status` (que já atualiza `last_seen_at`), gravar `deviceTelemetry` no campo `configuration` da tabela `local_agents`:
```typescript
// Na rota POST status:
const { version, deviceTelemetry } = await req.json();
await supabase.from('local_agents').update({
  last_seen_at: new Date().toISOString(),
  status: 'online',
  version,
  configuration: { ...(agent.configuration || {}), deviceTelemetry }
}).eq('id', agent.id);
```

### 3. `src/components/admin/DiagnosticsPanel.tsx` — Exibir telemetria na Web
- No modo Web (não-local), buscar `local_agents` com `configuration` via Supabase
- Se `configuration.deviceTelemetry` existir, renderizar o mesmo card de "Telemetria dos Dispositivos" que já existe para o modo local
- Remover a condição `isLocalRuntime &&` do card, tornando-o visível quando houver dados de qualquer fonte

### Arquivos alterados
- `electron/sync.js` — push de telemetria para a nuvem
- `supabase/functions/agent-sync/index.ts` — persistir telemetria no `local_agents.configuration`
- `src/components/admin/DiagnosticsPanel.tsx` — buscar e exibir telemetria da nuvem no modo Web

