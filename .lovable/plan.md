

## Implementação: Enrollment ControlID via Agent Commands

### Problema
A Edge Function `worker-enrollment` tenta fazer HTTP direto para IPs locais (ex: `192.168.0.129`) dos leitores ControlID. Isso nunca funciona pela web porque a nuvem não alcança a rede local.

### Solução
Transformar o enrollment cloud em um sistema de **fila de comandos**: a Edge Function insere comandos na tabela `agent_commands`, o Local Server (que está na mesma rede) os busca e executa.

```text
WEB → worker-enrollment EF → INSERT agent_commands (pending)
                                        ↓
Local Server (poll) → GET download-commands → executa no dispositivo → POST upload-command-result
```

### Alterações

**1. Edge Function `worker-enrollment/index.ts`** (reescrever)
- Remover toda lógica de HTTP direto aos dispositivos
- Para cada device, buscar o `agent_id` associado
- Inserir registro em `agent_commands` com:
  - `command`: `'enroll_worker'` ou `'remove_worker'`
  - `payload`: `{ worker_id, worker_code, worker_name, document_number, photo_url, device_ip }`
  - `status`: `'pending'`
- Retornar `{ success: true, queued: true, commandIds: [...] }`

**2. Edge Function `agent-sync/index.ts`** (adicionar 2 endpoints)
- `GET /download-commands`: retorna comandos pendentes filtrados por `agent_id` do token autenticado
- `POST /upload-command-result`: recebe `{ command_id, status, result, error_message }` e atualiza `agent_commands`; se enrollment bem-sucedido, atualiza `workers.devices_enrolled`

**3. `electron/sync.js`** (adicionar ao ciclo de sync)
- No `downloadUpdates()`, após baixar workers, chamar `downloadAndExecuteCommands()`
- Novo método `downloadAndExecuteCommands()`:
  - GET `agent-sync/download-commands`
  - Para cada comando `enroll_worker`: buscar worker e device locais, chamar `enrollUserOnDevice()` (já existe em `server/lib/controlid.js`)
  - Para cada comando `remove_worker`: chamar `removeUserFromDevice()`
  - POST resultado via `agent-sync/upload-command-result`

**4. `src/hooks/useControlID.ts`** (useWorkerEnrollment)
- No path cloud: após invocar `worker-enrollment`, mostrar toast "Comando enfileirado, aguardando execução pelo agente local"
- Manter path desktop (local) inalterado

**5. `src/components/workers/WorkerManagement.tsx`** (feedback visual)
- Ajustar toast/mensagem de sucesso para distinguir entre execução direta (desktop) e enfileirado (web)

### Tabela `agent_commands` (já existe)
Campos existentes cobrem tudo: `agent_id`, `device_id`, `command`, `payload`, `status`, `result`, `error_message`, `executed_at`.

### RLS `agent_commands`
Já permite INSERT/SELECT/UPDATE/DELETE para admins autenticados. A Edge Function usa `SERVICE_ROLE_KEY`, então sem problemas.

### O que NÃO muda
- Path Desktop/Local Server direto (via `POST /api/workers/:id/enrollment`) continua funcionando
- `server/lib/controlid.js` inalterado
- Auto-enroll de fotos durante sync (`autoEnrollWorkerPhoto`) inalterado

