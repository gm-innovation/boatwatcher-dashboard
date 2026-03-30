

## Alinhar componentes e polir UI/UX do ClientsManagement

### Problemas identificados
1. Tabela usa HTML raw (`<table>`) em vez dos componentes `Table` do design system
2. Padding e tamanhos de fonte não seguem o padrão do dashboard (`text-xs` cabeçalho, `text-sm` corpo, `py-2 px-3`)
3. Coluna de logo com tamanhos inconsistentes entre imagem e fallback
4. Seção de logos no formulário desalinha quando algumas têm preview e outras não
5. Import do `Avatar` não utilizado
6. Botões de ação sem tooltip para indicar a ação

### Alterações

**`src/components/admin/ClientsManagement.tsx`**

1. **Substituir tabela HTML por componentes Table do design system** (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`)
2. **Aplicar padrão visual do dashboard**: `text-xs` no cabeçalho, `text-sm` nas células, padding compacto `py-2 px-3`
3. **Padronizar coluna de logo**: container fixo `h-8 w-16` tanto para imagem quanto fallback, alinhamento vertical centralizado
4. **Formulário - seção de logos**: adicionar altura mínima fixa nos blocos de preview (`min-h-[60px]`) para manter alinhamento entre as 3 colunas, mesmo quando nem todas têm preview
5. **Remover import não utilizado** do Avatar
6. **Adicionar `Tooltip` nos botões de editar/excluir** para melhor UX
7. **Alinhar verticalmente** todas as células da tabela com `align-middle`

