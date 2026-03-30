

## Vincular usuários a clientes em vez de projetos

### Alteração

**`src/components/UserManagement.tsx`**
- Substituir `useProjects()` por `useClients()` para listar clientes (companies com type='client')
- Trocar os checkboxes de "Projetos" por checkboxes de "Clientes"
- No submit, inserir em `user_companies` (já existe no schema) em vez de `user_projects`
- Remover o `AdminProjectFilter` do topo (não faz sentido filtrar projetos se a vinculação é por cliente)
- Ajustar mensagens de sucesso para refletir "cliente(s)" em vez de "projeto(s)"

### Lógica
- O usuário criado será vinculado a um ou mais clientes via `user_companies`
- O filtro inline no topo permanece apenas com o select de Cliente para filtrar a lista de clientes exibidos nos checkboxes (útil se houver muitos clientes)

