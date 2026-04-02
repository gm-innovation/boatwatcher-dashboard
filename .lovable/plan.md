

## Corrigir tipos de relatório e lógica de dias retroativos

### Problema
Os tipos de relatório estão incorretos (Conformidade e Dispositivos não existem). Os tipos corretos são: Trabalhadores Simples, Trabalhadores Detalhado, Empresas, Todos Trabalhadores e Visão Geral. Além disso, o campo "Dias Retroativos" deve ser automático conforme a frequência.

### Mudanças

**Arquivo: `src/components/reports/ReportScheduler.tsx`**

1. **Corrigir `REPORT_TYPES`**:
```ts
const REPORT_TYPES = [
  { value: 'presence', label: 'Visão Geral' },
  { value: 'workers_simple', label: 'Trabalhadores Simples' },
  { value: 'workers_detailed', label: 'Trabalhadores Detalhado' },
  { value: 'company', label: 'Empresas' },
  { value: 'all_workers', label: 'Todos Trabalhadores' },
];
```

2. **Remover campo "Dias Retroativos" manual** — substituir por lógica automática baseada na frequência:
   - Diário → dados do dia anterior (1 dia)
   - Semanal → últimos 7 dias
   - Quinzenal → últimos 15 dias
   - Mensal → mês inteiro anterior

3. **Substituir o input de "Dias Retroativos" por um texto informativo** mostrando o período que será coberto conforme a frequência selecionada (ex: "O relatório incluirá dados do dia anterior").

4. **Ao salvar**, calcular `lookback_days` automaticamente no `filters` com base na frequência escolhida (1, 7, 15, 30).

### Arquivos alterados
- `src/components/reports/ReportScheduler.tsx`

