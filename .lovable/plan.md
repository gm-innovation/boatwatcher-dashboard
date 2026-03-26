

# Telemetria por Dispositivo + Último Evento

## Mudanças

### 1. `electron/agent.js` — Telemetria por dispositivo

No `pollDevices()`, gravar em cada device:
- `_lastError` / `_lastPollAt` / `_status`
- `_lastEventPayload` — o último `rawEvent` recebido (para debug)

No `processEvent()`, salvar `device._lastEventPayload = rawEvent` antes de processar.

Expandir `getStatus()` para incluir array `devices`:
```javascript
devices: this.devices.map(d => ({
  name: d.name,
  ip: d.controlid_ip_address,
  serial: d.controlid_serial_number,
  status: d._lastError ? 'error' : 'ok',
  lastError: d._lastError || null,
  lastPollAt: d._lastPollAt || null,
  lastEventId: this.getLastEventId(d),
  lastEventPayload: d._lastEventPayload || null,
}))
```

### 2. `server/routes/sync.js` — Fix token + devices no diagnóstico

- Corrigir `has_access_token`: `req.syncEngine.accessToken` → `req.syncEngine.agentToken`
- O `agentStatus` já incluirá `devices` automaticamente do `getStatus()` expandido

### Arquivos alterados
- `electron/agent.js`
- `server/routes/sync.js`

