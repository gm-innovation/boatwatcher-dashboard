

## Remover seletor global de projetos da Administração e adicionar filtros inline

### Resumo
Ocultar o `ProjectSelector` do header quando o admin está em `/admin`. Cada aba que precisa de filtragem (Clientes, Projetos, Dispositivos) terá seus próprios filtros contextuais de cliente/projeto no topo.

### Alterações

**1. Criar `src/components/admin/AdminProjectFilter.tsx`** (novo)
- Componente controlado com dois `Select`: "Cliente" e "Projeto"
- Usa `useClients()` para listar clientes e `useProjects()` para listar projetos
- Ao selecionar um cliente, filtra os projetos por `client_id`
- Ambos possuem opção "Todos"
- Props: `selectedClientId`, `selectedProjectId`, `onClientChange`, `onProjectChange`
- Layout horizontal compacto (inline com o título da seção)

**2. `src/components/Header.tsx`**
- Ocultar o bloco do `ProjectSelector` (tanto desktop quanto mobile) quando `location.pathname.startsWith('/admin')`
- Manter o comportamento normal em todas as outras rotas

**3. `src/components/admin/ClientsManagement.tsx`**
- Adicionar filtro de texto (busca por nome) no topo da lista de clientes
- Filtrar a lista localmente pelo termo digitado

**4. `src/components/admin/ProjectsManagement.tsx`**
- Adicionar o `AdminProjectFilter` no topo (apenas o select de Cliente)
- Filtrar a lista de projetos pelo `client_id` selecionado
- Opção "Todos" exibe todos os projetos

**5. `src/components/devices/DeviceManagement.tsx`**
- Substituir `const { selectedProjectId } = useProject()` por estado local
- Adicionar `AdminProjectFilter` (cliente + projeto) no topo
- Filtrar `devices` e passar `selectedProjectId` local para `useDevices()` e `useLocalAgents()`
- Sub-aba Agentes: passar o `selectedProjectId` local como prop ou contexto

**6. `src/components/UserManagement.tsx`**
- Adicionar o `AdminProjectFilter` no topo
- Filtrar a listagem de usuários por projeto vinculado (via `user_projects`)

### O que NÃO muda
- O seletor global continua funcionando em Dashboard, Relatórios, Gestão de Pessoas, etc.
- A aba Clientes permanece como aba na Administração
- Nenhuma alteração de banco de dados

