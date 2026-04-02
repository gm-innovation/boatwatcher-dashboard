

## Melhorar Impressão do Relatório Visão Geral

### Problema
O `window.print()` imprime a página inteira (sidebar, header, filtros, tabs) e os gráficos/cards são cortados entre páginas.

### Solução

**1. Adicionar estilos `@media print` em `src/index.css`**
- Esconder sidebar, header global, filtros, tabs e botão de imprimir
- Forçar fundo branco, sem sombras
- `page-break-inside: avoid` em cada Card para que gráficos e tabelas nunca sejam cortados
- Garantir que os charts tenham tamanho fixo para impressão
- Remover scroll containers que impedem renderização completa

**2. Atualizar `src/components/reports/PresenceReport.tsx`**
- Adicionar classe `print:break-inside-avoid` em cada `<Card>`
- Nos grids de 2 colunas, usar `print:grid-cols-1` para evitar compressão lateral
- Remover `ScrollArea` wrapper se existir

### CSS Print Rules (index.css)
```css
@media print {
  /* Hide app shell */
  [data-sidebar], header, nav, .print\\:hidden { display: none !important; }
  
  /* Full width content */
  main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
  
  /* Prevent cutting cards/charts */
  .print-no-break { break-inside: avoid; page-break-inside: avoid; }
  
  /* White background */
  body, * { background: white !important; color: black !important; }
  
  /* Charts fixed size for print */
  .recharts-responsive-container { height: 250px !important; }
}
```

### Arquivos alterados
- `src/index.css` — adicionar bloco `@media print`
- `src/components/reports/PresenceReport.tsx` — adicionar classes `print-no-break` e `print:grid-cols-1` nos cards e grids

