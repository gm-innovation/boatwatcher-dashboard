

## Redesign da aba Agendamentos conforme referência

### Mudanças

**1. Formulário inline (substituir Dialog modal)**
- Botão "Novo Agendamento" alterna visibilidade de um Card de formulário inline
- Layout em grid conforme print:
  - Linha 1: Nome do Agendamento (col-span-7) | Projeto (col-span-5, Select com projetos via `useSupabase`)
  - Linha 2: Tipos de Relatório (multi-select com Checkboxes) | Frequência (Select) | Horário de Envio (time input)
  - Linha 3: Dias Retroativos (number input) — campo que define quantos dias anteriores o relatório cobre (ex: 1 = relatório do dia anterior)
  - Linha 4: Destinatários de Email (full width) com botão "+ Adicionar Email"
- Rodapé: "Testar Envio" | "Forçar Execução" (ghost) | "Cancelar" (outline) | "Salvar" (primary)

**2. Tipo de relatório: multi-select com checkboxes**
- Substituir Select único por lista de checkboxes (usando componente Checkbox)
- Tipos disponíveis: Visão Geral, Relatório por Empresa, Relatório de Conformidade, Relatório de Dispositivos
- `report_type` passa a ser armazenado como string separada por vírgula (ex: `"presence,company"`) no campo existente, ou como array no `filters.report_types`
- Na listagem, exibir múltiplos badges

**3. Frequência: adicionar "Quinzenal"**
- Opções: Diário, Semanal, Quinzenal, Mensal
- Adicionar `{ value: 'biweekly', label: 'Quinzenal' }`

**4. Novos campos armazenados em `filters` (JSON)**
- `send_time` (string, ex: "06:00")
- `lookback_days` (number, ex: 1) — dias retroativos
- `report_types` (string[], ex: ["presence", "company"]) — tipos selecionados

**5. Listagem com abas Ativos/Inativos**
- Usar `Tabs` para separar "Agendamentos Ativos" e "Agendamentos Inativos"
- Filtrar por `is_active`

### Arquivos alterados

- `src/components/reports/ReportScheduler.tsx` — reescrever layout completo
- `src/hooks/useReportSchedules.ts` — atualizar tipos (`CreateReportScheduleInput` para incluir `filters` com os novos campos)

### Sem migração
Campos novos (`send_time`, `lookback_days`, `report_types`) ficam no campo JSON `filters` que já existe.

