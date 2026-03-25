

## ✅ Enrollment automático: Worker → Projetos Permitidos → Dispositivos (Implementado)

### Cadeia de resolução
```
Worker.allowed_project_ids → Projects → Devices (com agent_id) → agent_commands
```

### Alterações realizadas

1. **Edge Function `worker-enrollment/index.ts`** — Quando `deviceIds` não é fornecido, resolve automaticamente via `allowed_project_ids` → `devices.project_id` → dispositivos com `agent_id`. Atualiza `devices_enrolled` após enfileirar.

2. **`WorkerManagement.tsx`** — Dispara enrollment automático em create E update, sem depender de `devices_enrolled`. Abre tracking dialog com commandIds retornados.

3. **`DeviceManagement.tsx`** — Ao criar dispositivo com projeto + agente, faz bulk enrollment de todos os workers ativos que têm aquele projeto em `allowed_project_ids`.
