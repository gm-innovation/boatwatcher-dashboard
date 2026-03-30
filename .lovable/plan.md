

## Trocar checkboxes de Clientes por dropdown multi-select

### Alteração

**`src/components/UserManagement.tsx`**

Substituir o bloco de checkboxes (linhas 203-223) por um `DropdownMenu` com `DropdownMenuCheckboxItem` para cada cliente. O botão trigger exibirá a contagem de clientes selecionados (ex: "3 clientes selecionados") ou "Selecione os clientes" quando vazio.

- Importar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuCheckboxItem` de `@/components/ui/dropdown-menu`
- Remover import do `Checkbox`
- Manter a mesma lógica de `handleToggleClient` e `selectedClients`
- O trigger será um `Button variant="outline"` com largura total, estilizado como um select

