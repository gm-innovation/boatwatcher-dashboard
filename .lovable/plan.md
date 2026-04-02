

## Reformular aba "Visão Geral" — Dashboard Estatístico Completo

### Objetivo
Transformar a aba "Visão Geral" (atualmente `PresenceReport`) de uma simples tabela de presença em um painel estatístico completo do projeto, conforme o modelo de referência enviado.

### Layout (baseado no print)

**1. Cabeçalho**
- Título: "Visão Geral do Projeto: {nome}" + período + botão "Abrir para Impressão"

**2. Cards de Resumo (linha 1 — 4 cards)**
- Total de Acessos (entradas granted)
- Trabalhadores Únicos (distinct worker_id)
- Empresas (distinct companies dos trabalhadores)
- Média Diária de acessos

**3. Cards de Resumo (linha 2 — 2 cards)**
- Dia com Mais Acessos (data + contagem)
- Dia com Menos Acessos (data + contagem)

**4. Gráfico: Acessos por Dia**
- Line chart com eixo X = datas do período, Y = total de acessos/dia

**5. Gráficos lado a lado**
- Quantidade por Semana (bar chart)
- Distribuição por Dia da Semana (bar chart — Seg a Dom)

**6. Gráficos lado a lado**
- Dias Úteis vs Fins de Semana (pie/donut chart)
- Distribuição por Cargos/Funções (horizontal bar chart)

**7. Top 10 Empresas por Nº de Trabalhadores**
- Tabela simples: Empresa | Trabalhadores

### Dados necessários
- `useAccessLogs(projectId, startDate, endDate, 5000)` — logs do período
- `useWorkers()` — para company_id e job_function_id
- `useCompanies()` — nomes das empresas
- `useJobFunctions()` — nomes das funções
- `useProjects()` — nome/location do projeto

Toda a computação estatística será feita client-side via `useMemo`.

### Gráficos
Usar **recharts** (já disponível no projeto como dependência shadcn/ui chart). Componentes: `LineChart`, `BarChart`, `PieChart` do recharts.

### Arquivo alterado
- `src/components/reports/PresenceReport.tsx` — reescrita completa

### Complexidade
Componente único, ~400-500 linhas, sem novos hooks ou utilitários. Apenas processamento de dados existentes e renderização com recharts.

