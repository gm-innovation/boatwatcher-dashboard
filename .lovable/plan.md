


## ✅ Implementado: Enrollment ControlID via Agent Commands

### Problema resolvido
A Edge Function `worker-enrollment` tentava fazer HTTP direto para IPs locais (ex: `192.168.0.129`) dos leitores ControlID. Isso nunca funciona pela web porque a nuvem não alcança a rede local.

### Solução implementada
Enrollment cloud agora usa sistema de **fila de comandos** via tabela `agent_commands`:

```text
WEB → worker-enrollment EF → INSERT agent_commands (pending)
                                        ↓
Local Server (poll) → GET download-commands → executa no dispositivo → POST upload-command-result
```

### Arquivos alterados
1. **`supabase/functions/worker-enrollment/index.ts`** — Removida lógica HTTP direta; agora insere comandos na fila
2. **`supabase/functions/agent-sync/index.ts`** — Adicionados endpoints `download-commands` e `upload-command-result`
3. **`electron/sync.js`** — Adicionado `downloadAndExecuteCommands()` ao ciclo de sync
4. **`src/hooks/useControlID.ts`** — Toast diferenciado para comandos enfileirados vs execução direta

## ✅ Implementado: Sync de Status de Dispositivos (Online/Offline)

### Problema resolvido
O Local Server detectava dispositivos online via polling local, mas nunca reportava esse status para a nuvem. Por isso, dispositivos apareciam sempre "offline" na Web/Desktop.

### Solução implementada
O heartbeat periódico (~60s) do `SyncEngine` agora inclui o status de conectividade de cada dispositivo.

```text
AgentController (polling local) → deviceConnectivity Map
                                        ↓
SyncEngine.sendHeartbeat() → agent-sync/status (com array devices)
                                        ↓
Edge Function → UPDATE devices SET status WHERE serial_number + agent_id
```

### Arquivos alterados
1. **`electron/agent.js`** — Adicionado `deviceConnectivity` Map e método `getDeviceConnectivityReport()`
2. **`electron/sync.js`** — Heartbeat agora inclui `devices` no payload
3. **`supabase/functions/agent-sync/index.ts`** — Endpoint `/status` agora processa array `devices` e atualiza `devices.status` na cloud
