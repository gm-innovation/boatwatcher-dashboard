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

## ✅ Implementado: Sync de Status de Dispositivos (Online/Offline) — v2

### Problema resolvido (v2)
Mesmo após a v1, dispositivos continuavam offline porque:
1. `AgentController.start()` não era chamado automaticamente no boot do Local Server
2. `getDeviceConnectivityReport()` retornava array vazio (dispositivos não carregados em memória)
3. Status não era persistido no SQLite local (Desktop via modo local sempre lia "offline")
4. Edge function não normalizava seriais e não retornava métricas de update

### Correções aplicadas
1. **`server/index.js`** — `agentController.start()` chamado automaticamente no boot
2. **`electron/agent.js`** — `persistDeviceStatus()` grava online/offline no SQLite a cada ciclo de polling
3. **`electron/sync.js`** — Heartbeat resiliente: força `reloadDevices()` se report vazio, normaliza seriais, loga `devices_sent`
4. **`supabase/functions/agent-sync/index.ts`** — Normaliza serial com `trim()`, atualiza `updated_at` (não `last_event_timestamp`), retorna `devices_received`/`devices_updated`, loga warnings
