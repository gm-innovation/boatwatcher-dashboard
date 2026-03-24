

## Problema: Dispositivos sempre "offline" na Web/Desktop

### Causa raiz

O Local Server (via `AgentController` em `electron/agent.js`) faz polling dos dispositivos na rede local e atualiza o status para "online" **apenas no SQLite local**. O heartbeat enviado à nuvem (`electron/sync.js` → `agent-sync/status`) **não inclui informação de conectividade dos dispositivos**. Por isso, a coluna `devices.status` no banco cloud permanece "offline" para sempre.

A infraestrutura para resolver isso **já existe**:
- `agent-relay/heartbeat` aceita um array `devices` com `{ serial_number, online }` e atualiza `devices.status` na cloud
- `agent-sync/status` (o heartbeat usado pelo sync engine) **não** propaga device status

### Solução

Incluir o status de conectividade dos dispositivos no heartbeat que o `SyncEngine` já envia periodicamente (~60s).

### Alterações

**1. `electron/agent.js`** -- Rastrear conectividade por dispositivo

- Adicionar um `Map` interno `deviceConnectivity` que registra `{ online: boolean }` para cada device
- Em `pollDevice()`: marcar como `online` se a resposta HTTP foi bem-sucedida, `offline` se timeout/erro
- Expor método `getDeviceConnectivityReport()` que retorna array `[{ serial_number, online }]`

**2. `electron/sync.js`** -- Enviar device status no heartbeat

- Em `sendHeartbeat()`, obter `agentController.getDeviceConnectivityReport()` e incluir no payload:
```javascript
await this.callEdgeFunction('agent-sync/status', 'POST', {
  version: ...,
  sync_status: ...,
  pending_count: ...,
  devices: this.agentController?.getDeviceConnectivityReport?.() || [],
});
```

**3. `supabase/functions/agent-sync/index.ts`** -- Processar device status no endpoint `/status`

- Após atualizar `local_agents`, verificar se `body.devices` existe
- Para cada device, fazer `UPDATE devices SET status = 'online'/'offline', last_event_timestamp = now() WHERE controlid_serial_number = ? AND agent_id = ?`
- Reutilizar a mesma lógica já presente em `agent-relay/heartbeat`

### O que NAO muda
- `agent-relay/heartbeat` permanece como está (endpoint alternativo)
- Web app e Dashboard continuam lendo `devices.status` da cloud -- agora será atualizado corretamente
- Polling local do `AgentController` continua funcionando igual

