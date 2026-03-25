

## Enrollment automático: Worker → Projetos Permitidos → Dispositivos

### Modelo de dados clarificado

```text
Cliente (Company) ──owns──▶ Project ──has──▶ Devices
                                ▲
Empresa terceirizada (Company) ──has──▶ Workers ──allowed_project_ids──┘
Cliente (Company) ──has──▶ Workers (tripulação) ──allowed_project_ids──┘
```

- **Cliente**: empresa dona do projeto (`projects.client_id = company.id`)
- **Empresas**: terceirizadas que prestam serviço ao cliente. Workers pertencem a elas via `workers.company_id`
- **Tripulação**: workers do próprio cliente, também via `workers.company_id`
- **Vínculo worker↔projeto**: `workers.allowed_project_ids[]` — independente de ser terceirizada ou tripulação

### Cadeia de resolução de dispositivos

```
Worker.allowed_project_ids → Projects → Devices (com agent_id)
```

Não depende de `devices_enrolled` (que fica sempre vazio). O campo `allowed_project_ids` já é preenchido no formulário.

### Alterações

**1. Edge Function `worker-enrollment/index.ts` — Resolver dispositivos via `allowed_project_ids`**

Quando `deviceIds` não é fornecido ou está vazio:
- Buscar `worker.allowed_project_ids`
- Buscar todos os dispositivos onde `project_id` está em `allowed_project_ids` E que tenham `agent_id` não-nulo
- Usar esses dispositivos para enfileirar comandos
- Atualizar `workers.devices_enrolled` com os IDs dos dispositivos após enfileirar
- Se `deviceIds` for fornecido, manter comportamento atual (retrocompatibilidade)

**2. `WorkerManagement.tsx` — Disparar enrollment no create e update**

- **Ao editar**: após salvar, chamar `worker-enrollment` com apenas `workerId` (sem `deviceIds` — a função resolve via `allowed_project_ids`)
- **Ao criar**: após salvar + upload de foto, mesma lógica
- Remover a verificação `if (enrolledDevices.length > 0)` — agora sempre tenta
- Se retornar `commandIds`, abrir tracking dialog; se 0 dispositivos, toast normal

**3. `DeviceManagement.tsx` — Bulk enrollment ao vincular dispositivo a projeto**

- Após criar/editar dispositivo com `project_id`: buscar todos os workers cujo `allowed_project_ids` contém esse projeto
- Chamar `worker-enrollment` para cada worker (ou criar endpoint bulk na edge function)
- Garante que ao configurar dispositivos, todos os workers existentes sejam sincronizados

### Fluxo do usuário

1. Admin cria projeto com `client_id = Empresa X`
2. Admin cadastra workers (da empresa X ou terceirizadas), marcando o projeto em "Projetos Permitidos"
3. Admin adiciona dispositivo ao projeto → sistema enfileira enrollment de todos os workers que têm aquele projeto em `allowed_project_ids`
4. Admin cria/edita trabalhador com projetos permitidos → enrollment automático nos dispositivos desses projetos

### Arquivos alterados
- `supabase/functions/worker-enrollment/index.ts` — resolução via `allowed_project_ids`
- `src/components/workers/WorkerManagement.tsx` — enrollment automático no create/update
- `src/components/devices/DeviceManagement.tsx` — bulk enrollment ao criar dispositivo

