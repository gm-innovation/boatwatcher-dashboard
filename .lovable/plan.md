

## Corrigir scroll e ajustar modal de detalhes do trabalhador

### Problema
O modal usa `ScrollArea` do Radix, que conforme padrão já estabelecido neste projeto, causa bugs de cálculo de altura dinâmica impedindo o scroll. O modal também precisa de ajustes visuais para ficar mais fiel ao modelo.

### Correções

**Arquivo: `src/components/workers/WorkerDetailsDialog.tsx`**

1. **Scroll**: Substituir `<ScrollArea className="flex-1 pr-4">` (linha 254) por `<div className="flex-1 overflow-y-auto pr-4">` — padrão nativo já adotado no projeto para modais complexos.

2. **Footer sticky**: Mover os botões "Salvar Alterações" e "Fechar" para fora do scroll mas dentro do flex container, mantendo `flex-shrink-0` (já está correto nas linhas 673-683).

3. **Remover import não utilizado**: Remover `ScrollArea` do import se não for mais usado no componente (ainda é usado no diálogo interno de projetos na linha 641, então manter).

### Resultado
- Scroll funciona corretamente com `overflow-y-auto` nativo
- Footer com botões fica fixo na parte inferior do modal
- Todas as seções (Documentos, Strikes) ficam acessíveis por rolagem

