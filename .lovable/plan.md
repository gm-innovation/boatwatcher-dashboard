

## Consolidar Dispositivos e Agentes com suporte multi-cliente/projeto

### Contexto
Atualmente dispositivos e agentes são abas separadas na Administração, ambas já filtradas pelo `selectedProjectId`. A estrutura de dados já suporta múltiplos projetos por cliente (tabela `projects` com `client_id`). O que falta é unificar a gestão em um único local e garantir que a navegação por cliente/projeto seja clara.

### Alterações

**1. `src/components/devices/DeviceManagement.tsx`**
- Adicionar sub-abas internas: "Dispositivos" (conteúdo atual) e "Agentes" (`<AgentManagement />`)
- Importar `AgentManagement` e `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
- Envolver todo o conteúdo atual na sub-aba "Dispositivos"

**2. `src/pages/Admin.tsx`**
- Remover entrada `agents` do array `tabs`
- Remover imports: `AgentManagement`, `Bot`

**3. `src/components/devices/ConnectivityDashboard.tsx`** (avaliar)
- A aba "Conectividade" já é separada e pode permanecer como visão geral de saúde do sistema

### Sobre multi-cliente/projeto
A filtragem já funciona via `ProjectContext` (`selectedProjectId`). Quando o operador troca de projeto no seletor global, tanto dispositivos quanto agentes se atualizam automaticamente. Cada dispositivo já possui `project_id` e `agent_id`, e cada agente já possui `project_id`. Nenhuma mudança de banco de dados é necessária -- a estrutura relacional já está preparada para N projetos por cliente.

### Resultado
A aba "Dispositivos" passa a conter duas sub-abas -- "Dispositivos" e "Agentes" -- centralizando toda a gestão de hardware e conectividade de campo em um ponto único, já filtrado pelo projeto ativo.

