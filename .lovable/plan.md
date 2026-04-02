

## Substituir layout dos gráficos conforme referência

### Mudanças baseadas no print

O print mostra 3 gráficos com layout específico:

1. **"Acessos por Dia"** (full width) — LineChart com rótulos de valor nos picos. Já existe, precisa adicionar `<LabelList>` nos pontos com valor > 0.

2. **"Quantidade por Semana"** (metade esquerda) — BarChart verde com rótulos de valor no topo das barras e subtítulo "Semanas iniciando aos Domingos". Eixo X no formato "Sem DD/MM". Já existe, precisa:
   - Mudar formato do eixo X de "Sem N" para "Sem DD/MM" (primeira data da semana)
   - Adicionar `<LabelList>` com valores
   - Adicionar subtítulo no CardHeader
   - Mudar cor para verde (`#22c55e` ou similar)

3. **"Distribuição por Dia da Semana (Por Semana)"** (metade direita) — BarChart empilhado onde cada barra é uma semana e as cores representam os dias da semana (Dom=azul, Seg=verde, Ter=laranja, Qua=vermelho, Qui=roxo, Sex=teal, Sáb=marrom). Com legenda colorida embaixo. **Substitui** o gráfico simples "Distribuição por Dia da Semana" atual.

### Arquivo: `src/components/reports/PresenceReport.tsx`

**Dados (useMemo)**:
- Alterar `weeklyChart` para incluir data de início da semana no formato "Sem DD/MM"
- Criar novo dataset `weeklyByDayChart`: array de objetos `{ semana: "Sem DD/MM", Domingo: N, Segunda: N, ... }` para o gráfico empilhado

**Gráficos**:
- "Acessos por Dia": adicionar `<LabelList>` no `<Line>` mostrando valores > 0
- "Quantidade por Semana": subtítulo, labels, cor verde, formato "Sem DD/MM"
- Substituir "Distribuição por Dia da Semana" por `<BarChart>` empilhado com 7 `<Bar>` (uma por dia), cada com cor fixa, e `<Legend>` embaixo

**Manter inalterados**: Weekday vs Weekend (PieChart), Cargo/Função, Top 10 tabela, KPIs.

