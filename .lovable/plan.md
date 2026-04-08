

## Dispositivo Manual: Exibir todos os trabalhadores + status de bloqueio

### Problema atual
1. O hook `useOfflineAccessControl` filtra `.eq('status', 'active')` — trabalhadores bloqueados/pendentes nunca são carregados
2. O terminal não filtra por empresas vinculadas ao projeto do cliente
3. Quando um trabalhador bloqueado é identificado, o sistema permite registrar entrada/saída normalmente (deveria bloquear)
4. O motivo do bloqueio (`rejection_reason`) não é carregado nem exibido

### Correções

#### 1. Hook `useOfflineAccessControl.ts` — carregar todos os trabalhadores do projeto

- Remover o filtro `.eq('status', 'active')` para incluir bloqueados e pendentes
- Adicionar o campo `rejection_reason` ao select
- Adicionar `rejection_reason` à interface `CachedWorker`
- Quando `useOfflineAccessControl` recebe um `projectId` (novo parâmetro opcional), filtrar trabalhadores cujo `allowed_project_ids` contenha esse projeto, em vez de filtrar por `company_id`

#### 2. Página `AccessControl.tsx` — passar projectId do terminal

- Passar `terminal.project_id` para `useOfflineAccessControl` como filtro de projeto
- Na lógica de `handleConfirm`: se o trabalhador tem status `blocked` ou `pending_review`, registrar como `access_status: 'denied'` e **não permitir** entrada/saída — exibir apenas o card com status
- Esconder os botões de Entrada/Saída quando o trabalhador não está autorizado (status !== 'active')

#### 3. `WorkerCard.tsx` — exibir motivo do bloqueio

- Quando `borderStatus === 'blocked'` e `worker.rejection_reason` existir, exibir o motivo abaixo do badge de status
- Texto em vermelho claro, formato: "Motivo: {rejection_reason}"

#### 4. Filtro por projeto no hook (client-side)

Como o Supabase não suporta facilmente `.contains('allowed_project_ids', [projectId])` via RLS para o admin, faremos o filtro client-side:
- Carregar todos os trabalhadores (sem filtro de status)
- Filtrar no JS: `worker.allowed_project_ids?.includes(projectId)`
- Isso garante que apenas trabalhadores de empresas vinculadas ao projeto apareçam

### Arquivos alterados
1. `src/hooks/useOfflineAccessControl.ts` — remover filtro de status, adicionar `rejection_reason`, filtro por projectId
2. `src/pages/AccessControl.tsx` — passar projectId, bloquear confirmação para não-ativos
3. `src/components/access-control/WorkerCard.tsx` — exibir motivo do bloqueio

