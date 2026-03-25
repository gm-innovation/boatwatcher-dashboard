

## ✅ Enrollment automático: Worker → Projetos Permitidos → Dispositivos (Implementado)

### Cadeia de resolução
```
Worker.allowed_project_ids → Projects → Devices (com agent_id) → agent_commands
```

### Alterações realizadas

1. **Edge Function `worker-enrollment/index.ts`** — Quando `deviceIds` não é fornecido, resolve automaticamente via `allowed_project_ids` → `devices.project_id` → dispositivos com `agent_id`. Atualiza `devices_enrolled` após enfileirar.

2. **`WorkerManagement.tsx`** — Dispara enrollment automático em create E update, sem depender de `devices_enrolled`. Abre tracking dialog com commandIds retornados.

3. **`DeviceManagement.tsx`** — Ao criar dispositivo com projeto + agente, faz bulk enrollment de todos os workers ativos que têm aquele projeto em `allowed_project_ids`.

## ✅ Otimização de performance do agente e enrollment em massa (Implementado)

### Problema
Comandos de enrollment ficavam `pending` por muitos minutos porque o processamento dependia do ciclo de sync completo (60s) e condições de pendências locais.

### Soluções implementadas

1. **Loop dedicado de comandos a cada 5s** (`electron/sync.js`)
   - Polling independente do ciclo de sync de 60s
   - Lock de reentrada (`_isProcessingCommands`) para evitar execução concorrente
   - Comando sai de `pending` em <5s

2. **Execução paralela por dispositivo** (`electron/sync.js`)
   - Comandos agrupados por `device_id`
   - Serial dentro de cada dispositivo (preserva ordem)
   - Paralelo entre dispositivos (um leitor lento não bloqueia os demais)
   - Cache de foto por worker para evitar downloads repetidos

3. **Claim de comandos** (`agent-sync/index.ts`)
   - `download-commands` marca lote como `in_progress` antes de retornar
   - Previne processamento duplicado por múltiplas instâncias
   - Retorna métricas (`claimedCount`, `remainingPending`)

4. **Bulk enrollment** (`worker-enrollment/index.ts`)
   - Aceita `workerIds: string[]` para processar múltiplos workers em uma chamada
   - Resolve dispositivos uma vez, gera signed URLs em paralelo
   - Batch insert de todos os comandos
   - `DeviceManagement.tsx` usa uma única chamada em vez de loop

5. **Índice de banco** — `idx_agent_commands_agent_status_created` para consultas rápidas de fila
