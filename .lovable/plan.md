

## Ajustar StatisticsCards para corresponder ao design de referência

### Diferenças identificadas (atual vs referência)

O print mostra cards com:
- **Layout vertical**: ícone no topo à esquerda, label abaixo, valor embaixo — em coluna, não em linha
- **Fundo branco** (não colorido) com borda sutil e sombra leve
- **Ícone** dentro de um círculo com fundo colorido suave (azul, verde, púrpura)
- **Label** em cinza escuro/muted, fonte pequena
- **Valor** em preto/escuro, fonte grande e bold
- **Sem cores de fundo** nos cards — fundo neutro (bg-white / bg-card)

### Alteração

**`src/components/dashboard/StatisticsCards.tsx`**

Refatorar o `StatCard` para layout vertical:
- Card: `bg-white dark:bg-card rounded-xl border shadow-sm p-6`
- Layout: `flex flex-col gap-3` (vertical)
- Ícone: círculo colorido no topo (`p-3 rounded-full` com cor de fundo suave)
- Label: `text-sm text-muted-foreground`
- Valor: `text-3xl font-bold text-foreground`
- Remover props `bgColor`, `textColor` — simplificar para apenas `iconBgColor`

