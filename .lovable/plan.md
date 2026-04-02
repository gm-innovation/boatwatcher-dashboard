

## Unificar PDF e Impressão com Gráficos e Logos

### Problema
1. **Impressão (window.print)**: mostra os gráficos mas não tem logos
2. **PDF (jsPDF)**: tem logos mas não tem gráficos — só tabelas de texto
3. Os dois devem ser idênticos

### Solução

Usar **html2canvas** para capturar o conteúdo renderizado (com gráficos Recharts) e montar o PDF a partir dessas imagens. Adicionar cabeçalho com logos visível apenas na impressão.

### Comparação com imagens de referência

O relatório atual já cobre os dados principais. As imagens de referência mostram um estilo visual diferente (fundo escuro), mas os dados são equivalentes:
- Acessos por dia (temos LineChart — referência usa BarChart)
- Top 10 empresas com tabela (temos — referência também mostra PieChart ao lado)
- Acessos por dia da semana (temos)
- Distribuição semanal (temos)

**Dados faltando**: a tabela Top 10 mostra apenas "Trabalhadores", mas a referência mostra "Média" e "Total de Acessos" por empresa. Vou adicionar essas colunas.

### Arquivos alterados

**1. `package.json`** — adicionar `html2canvas` como dependência

**2. `src/components/reports/PresenceReport.tsx`**
- Adicionar `ref` no container do relatório (`reportContainerRef`)
- Adicionar **cabeçalho print-only** com logos (sistema + cliente) visível apenas em `@media print`
- Alterar `handleExportPdf`:
  - Usar `html2canvas` para capturar `reportContainerRef` com `scale: 2`
  - Dividir a imagem capturada em páginas A4
  - Adicionar logos no topo da primeira página do PDF
  - Rodapé com data e paginação
- Remover chamada a `exportOverviewReportPdf` (não mais necessária para este relatório)
- Atualizar Top 10 para incluir colunas "Média Diária" e "Total de Acessos" (não só trabalhadores)

**3. `src/components/reports/PresenceReport.tsx`** — dados do dashboard
- Calcular `accessCount` e `avgDaily` por empresa no `useMemo` para alimentar as novas colunas da tabela Top 10

**4. `src/index.css`** — ajustar print styles
- Adicionar regra para `.print-only-header` (display: none na tela, display: block na impressão)
- Garantir que logos no cabeçalho de impressão fiquem posicionadas corretamente

### Fluxo do PDF (html2canvas)

```text
┌──────────────────────────┐
│  reportContainerRef      │
│  (todo conteúdo visível  │
│   incluindo gráficos)    │
└──────────┬───────────────┘
           │ html2canvas(ref, {scale:2})
           ▼
┌──────────────────────────┐
│  Canvas (imagem)         │
└──────────┬───────────────┘
           │ split into A4 pages
           ▼
┌──────────────────────────┐
│  jsPDF                   │
│  Page 1: logos + content │
│  Page N: content + footer│
└──────────────────────────┘
```

### Detalhes técnicos

- `html2canvas` já está no `package-lock.json` (dependência transitiva), mas precisa ser adicionada como dependência direta
- Captura com `useCORS: true` e `scale: 2` para qualidade
- Antes de capturar, temporariamente esconder botões (`.print:hidden`) e forçar fundo branco no container
- Largura da imagem ajustada para caber em A4 (190mm úteis) com proporção mantida
- Cada "página" é um slice vertical da imagem capturada

