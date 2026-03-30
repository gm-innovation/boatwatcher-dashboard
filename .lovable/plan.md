

## Remover aba "Aprovações" da Administração

A aba "Aprovações" (`pending`) na página Admin é redundante — a mesma funcionalidade já existe em Gestão de Pessoas como "Cadastros Pendentes".

### Alteração

**`src/pages/Admin.tsx`**:
- Remover o item `{ value: 'pending', label: 'Aprovações', icon: UserCheck, content: <PendingRegistrations /> }` do array `tabs`
- Remover os imports não utilizados: `PendingRegistrations` e `UserCheck`

