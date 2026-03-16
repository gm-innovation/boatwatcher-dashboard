
Objetivo

Transformar o Desktop em uma estação autenticada de operador, onde:
- o operador faz login obrigatoriamente
- vê apenas Dashboard, Relatórios e Gestão de Pessoas
- acessa os projetos do cliente ao qual está vinculado
- recebe automaticamente novos projetos criados no sistema web para esse mesmo cliente
- nunca vê Administração, exceto você como admin

O que precisa mudar

1. Autenticação obrigatória no Desktop
- Remover o bypass local do Electron.
- O Desktop passará a usar a autenticação normal.
- Ao logar, o sistema identifica:
  - role do usuário em `user_roles`
  - cliente do usuário em `user_companies`

2. Regra de acesso por cliente
Hoje há um desalinhamento:
- os projetos estão visíveis por `user_projects`
- você definiu que o operador é vinculado a um cliente, não a projetos individuais

Vou ajustar para este modelo:
- operador → vinculado a um cliente em `user_companies`
- projetos visíveis → todos os projetos cujo `client_id` pertence a esse cliente
- admin → continua vendo todos os projetos

3. Sincronização automática de projetos do cliente
- O servidor local deixará de tratar projetos como fixos da máquina.
- A sincronização passará a baixar:
  - cliente do operador
  - projetos do cliente
  - atualizações e novos projetos criados no web
- Assim, quando surgir um novo projeto para aquele cliente, ele aparecerá no Desktop após sync.

4. Projeto ativo no Desktop
Como um cliente pode ter vários projetos:
- o operador escolhe um projeto ativo no seletor
- o projeto ativo filtra Dashboard, Relatórios e Gestão de Pessoas
- a última seleção fica salva localmente
- se o projeto deixar de existir ou ficar inativo, o sistema escolhe outro válido automaticamente

5. Administração restrita
- A tela Administração ficará oculta para operadores no menu e nas rotas.
- Apenas usuários com role `admin` poderão acessar `/admin`.
- No Desktop, isso continuará valendo: não haverá exceção por ser Electron.

Ajustes de backend/dados

Precisaremos alinhar a regra de acesso no banco:
- manter `user_roles` como fonte da role
- usar `user_companies` para descobrir o cliente do operador
- atualizar visibilidade de `projects` para também permitir:
  - admin ver tudo
  - usuário ver projetos do cliente ao qual está vinculado
- revisar consultas relacionadas que hoje dependem só de `user_projects`

Importante:
- `user_projects` pode continuar existindo para usos futuros/especiais
- mas, para o fluxo do operador Desktop, a regra principal passará a ser “por cliente”

Arquivos que devo ajustar

Frontend
- `src/lib/runtimeProfile.ts`
- `src/hooks/useAuth.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- `src/contexts/ProjectContext.tsx`
- `src/components/ProjectSelector.tsx`
- `src/components/layouts/AppSidebar.tsx`
- `src/pages/Admin.tsx`
- `src/components/Header.tsx`

Servidor local / sync
- `server/routes/projects.js`
- `server/index.js`
- `electron/sync.js`
- possivelmente `src/lib/localServerProvider.ts`

Banco / segurança
- políticas de acesso em `projects`
- possivelmente função auxiliar para obter os projetos do cliente do usuário

Resultado esperado

Operador:
- faz login
- vê só as áreas operacionais
- acessa automaticamente os projetos do seu cliente
- recebe novos projetos via sincronização

Admin:
- faz login
- vê Administração
- continua com acesso total

Detalhes técnicos
- Fonte de identidade:
  - `user_roles`
  - `user_companies`
- Fonte dos projetos do operador:
  - `projects.client_id = user_companies.company_id`
- Regra de menu:
```text
admin -> Dashboard, Relatórios, Gestão de Pessoas, Administração
operador -> Dashboard, Relatórios, Gestão de Pessoas
```
- Regra de sync:
```text
login do operador
-> descobrir cliente vinculado
-> sincronizar projetos desse cliente
-> atualizar lista local periodicamente
-> exibir novos projetos no seletor
```
