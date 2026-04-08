

## Correção: Barra de rolagem + Layout adaptativo

### Problema 1: Barra de rolagem horizontal persistente

A causa raiz está no componente `Table` base (`src/components/ui/table.tsx` linha 9): o wrapper interno usa `overflow-auto`, que sempre gera scrollbar quando o conteudo excede. Mesmo com `overflow-hidden` no container externo, o wrapper interno do `<Table>` sobrepoe.

**Solução**: No `WorkersOnBoardTable`, envolver a tabela em um div com `overflow-hidden` e aplicar classe para sobrescrever o wrapper interno do Table (`[&>div]:overflow-hidden`).

### Problema 2: Muito espaço vazio em telas grandes

O grid atual é fixo `xl:grid-cols-5` (3+2). Em telas de TV/monitor grande, sobra muito espaço abaixo e ao redor.

**Solução no `Dashboard.tsx`**:
- Mudar o grid de `xl:grid-cols-5` para `grid-cols-1 lg:grid-cols-3` (tabela 2/3, empresas 1/3)
- Em telas `2xl` (>=1536px), usar `2xl:grid-cols-5` para manter proporção similar

**Solução no `WorkersOnBoardTable.tsx`**:
- Adicionar `[&>div]:overflow-hidden` no container da Table para eliminar o scrollbar do wrapper interno
- Ajustar larguras das colunas com percentuais que funcionam melhor: Nº `w-[5%]`, Nome `w-[25%]`, Local `w-[10%]`, Função `w-[20%]`, Empresa `w-[25%]`, Entrada `w-[15%]`
- Usar `text-[11px] xl:text-xs` para escalar fonte com a tela

### Arquivos alterados
1. `src/components/dashboard/WorkersOnBoardTable.tsx` — eliminar scrollbar, larguras proporcionais
2. `src/components/dashboard/Dashboard.tsx` — grid mais adaptativo

