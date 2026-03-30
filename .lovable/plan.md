

## Reduzir fonte e padding para caber em uma linha

O problema principal: o componente `Table` base usa `p-4` (16px) nas células e `h-12` nos cabeçalhos. Isso causa quebra de linha. Na imagem de produção, tudo é compacto e cabe em uma linha.

### Alterações

**1. `src/components/dashboard/WorkersOnBoardTable.tsx`**
- Header do card: `p-6` → `p-4`
- Título: `text-xl` → `text-base`
- Todas as `TableHead`: adicionar `py-2 px-3 text-xs whitespace-nowrap`
- Todas as `TableCell`: adicionar `py-2 px-3 text-sm whitespace-nowrap`
- Remover `min-w-[600px]` (desnecessário com nowrap)

**2. `src/components/dashboard/CompaniesOnBoardList.tsx`**
- Header do card: `p-6` → `p-4`
- Título: `text-xl` → `text-base`
- Todas as `TableHead`: adicionar `py-2 px-3 text-xs whitespace-nowrap`
- Todas as `TableCell`: adicionar `py-2 px-3 text-sm whitespace-nowrap`

Não mexer no `table.tsx` global — apenas override local via className.

