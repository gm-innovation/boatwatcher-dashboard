

## Revisão da Integração Desktop ↔ Nuvem ↔ Servidor Local

### Problemas Identificados

**1. Desktop não puxa projetos (0 projetos)**
- O `download-projects` na Edge Function (linha 611-618) baixa TODOS os projetos sem filtro por `agent.project_id` — mas o agente do bootstrap só tem UM `project_id`.
- No Desktop, o `ProjectContext` (linha 97-103) filtra por `companyAccess.company_id`, mas o `client_id` dos projetos baixados pode não corresponder ao ID local das companies (mismatch UUID local vs cloud).
- O `upsertProjectFromCloud` usa o `data.id` (cloud UUID) diretamente como PK, mas o `client_id` aponta para o UUID da nuvem da company, enquanto no SQLite local a company pode ter sido inserida com ID local diferente (via `upsertCompanyFromCloud` que também usa `data.id` direto como PK — isso está OK, mas a `user_companies` usa `resolveLocalEntityId` que pode falhar).

**2. Dois agentes: "Engenharia01" (Online) e "Engenharia" (Offline)**
- O bootstrap (agent-sync, linha 160-169) busca agente existente por `created_by + name` (hostname da máquina).
- O Servidor Local standalone usa o bootstrap manual via token (UI do painel) — não passa pelo fluxo de bootstrap automático do Desktop.
- Resultado: Desktop criou "Engenharia01" (hostname) via `bootstrapFromAccessToken`, Servidor Local standalone registrou "Engenharia" manualmente via token.
- São DOIS agentes independentes apontando para o mesmo projeto, com tokens diferentes.

**3. Servidor Local mostra "Online" mas o agente "Engenharia" está "Offline" na web**
- O Servidor Local standalone envia heartbeat com o token do agente "Engenharia" (ativo localmente).
- Mas o agente no banco é "Engenharia" com token `d32133d8...a929`, que está ativo e enviando heartbeat.
- O painel web mostra "Engenharia" como Offline provavelmente porque o heartbeat está atualizando o agente correto mas o front-end cache não está refreshing, OU porque o `last_seen_at` está stale (o status lógico no banco pode ter sido sobreescrito por algo).

**4. Dispositivo vinculado ao agente errado**
- O dispositivo "Engenharia" (0f240d85) tem `agent_id` apontando para um dos dois agentes. Se está vinculado ao "Engenharia" (offline no web), os comandos/downloads não fluem corretamente.

### Plano de Correção

#### 1. Edge Function `agent-sync`: Filtrar projetos pelo agente
**Arquivo:** `supabase/functions/agent-sync/index.ts`
- `download-projects`: Em vez de baixar todos os projetos, filtrar por `agent.project_id` — retornar apenas o projeto vinculado ao agente E projetos do mesmo `client_id`.
- Isso garante que o servidor local só receba os projetos relevantes.

#### 2. Edge Function `agent-sync`: Rebind de dispositivos no bootstrap
**Arquivo:** `supabase/functions/agent-sync/index.ts`
- No fluxo de `bootstrap`, após criar/atualizar o agente, atualizar automaticamente todos os dispositivos do `project_id` para apontar para o novo `agent_id`.
- Isso resolve dispositivos "órfãos" vinculados a agentes antigos.
- Adicionar endpoint `rebind-devices` que o servidor local pode chamar para vincular dispositivos do projeto ao agente atual.

#### 3. Evitar criação de agentes duplicados
**Arquivo:** `supabase/functions/agent-sync/index.ts`
- No bootstrap, buscar agente existente por `created_by` (sem filtro por `name`) como fallback. Se o usuário já tem um agente para o mesmo `project_id`, reutilizar em vez de criar novo.
- Adicionar lógica: se existe agente do mesmo `created_by` com mesmo `project_id`, atualizar nome e retornar token existente.

#### 4. Corrigir mapeamento de `client_id` nos projetos baixados
**Arquivo:** `electron/database.js`
- No `upsertProjectFromCloud`, o `client_id` vem como UUID da nuvem. O `companies` no SQLite local usa o mesmo UUID (inserido via `upsertCompanyFromCloud` com `data.id`), então o JOIN funciona.
- Problema real: a ordem de download importa. Companies precisam ser baixadas ANTES de projects. Verificar que o `downloadUpdates` em `electron/sync.js` baixa companies antes de projects (já está correto na ordem).
- Verificar se o `fetchCurrentCompanyByUserId` no Desktop resolve corretamente para associar `user_companies` ao `company_id` local.

#### 5. Corrigir `download-projects` para incluir `client` join
**Arquivo:** `supabase/functions/agent-sync/index.ts`
- O `download-projects` retorna apenas campos básicos sem o join de `companies`. O `getProjects()` local faz JOIN com companies mas precisa que a company esteja no SQLite.
- Garantir que a company correspondente ao `client_id` do projeto está sendo baixada (pode não estar se foi criada antes do `since` do incremental sync).

#### 6. Desktop: melhorar o bootstrap para reutilizar agente do servidor local
**Arquivo:** `src/hooks/useAuth.tsx`, `electron/sync.js`
- Se o servidor local já tem um token configurado (via UI do painel), o Desktop não deve criar um novo agente via bootstrap. Verificar se `agent_token` já existe em `sync_meta` antes de chamar bootstrap.
- No `bootstrapFromAccessToken`, checar se já há token configurado e pular se existir.

#### 7. Adicionar diagnóstico de agente no painel web
**Arquivo:** `src/components/devices/AgentManagement.tsx`
- Mostrar a qual `project_id` cada agente está vinculado.
- Indicar quantos dispositivos estão vinculados a cada agente.
- Botão "Vincular dispositivos deste projeto" para rebind manual.

### Detalhes Técnicos

**Ordem de prioridade:**
1. Filtrar projetos por agente (resolve "0 projetos")
2. Evitar agentes duplicados (resolve confusão "Engenharia" vs "Engenharia01")
3. Rebind de dispositivos (resolve dispositivos órfãos)
4. Bootstrap inteligente (evita recriar agente quando servidor local já tem token)

**Arquivos impactados:**
- `supabase/functions/agent-sync/index.ts` — filtro de projetos, rebind, dedup de agentes
- `electron/sync.js` — verificar token existente antes de bootstrap
- `src/hooks/useAuth.tsx` — bootstrap condicional
- `src/components/devices/AgentManagement.tsx` — diagnóstico visual

