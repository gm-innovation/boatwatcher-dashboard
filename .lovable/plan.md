

# Reestruturar Página de Relatórios conforme referência

## Objetivo
Redesenhar a página de relatórios para seguir o layout do sistema de produção: título "Relatórios de Acesso", filtros globais no topo (Projeto + Período + Buscar Dados), abas simplificadas (Trabalhadores, Empresas, Todos Trabalhadores, Visão Geral, Controle de Pernoite), e na aba "Trabalhadores" exibir tempo de trabalho por trabalhador com sub-filtros e agrupamento por empresa.

## Mudanças

### 1. `src/pages/Reports.tsx` — Reestruturar layout
- Renomear título para "Relatórios de Acesso"
- Manter filtros globais no topo: Projeto (select), Período (data início / data fim), botão "Buscar Dados" (azul)
- Mudar abas para: **Trabalhadores** (default), **Empresas**, **Todos Trabalhadores**, **Visão Geral**, **Controle de Pernoite**
- Remover abas "Gerados", "Agendamentos" e "Conformidade" da página principal (podem ser acessadas via Admin)
- Passar `projectId`, `startDate`, `endDate` para todos os componentes de aba
- A aba "Trabalhadores" usará um novo componente `WorkerTimeReport`
- A aba "Todos Trabalhadores" reutiliza `ReportsList` (todos os acessos brutos)

### 2. Criar `src/components/reports/WorkerTimeReport.tsx` — Aba principal
Componente que mostra "Tempo de Trabalho por Trabalhador", seguindo o print:
- **Sub-filtros**: buscar trabalhador (input), filtro por função (select com job_functions), filtro por empresa (select), checkbox "a Bordo"
- **Botões de exportação**: CSV, PDF, Detalhado (PDF) — alinhados à direita
- **Tabela**: colunas Nº, Nome (com badge "A bordo" se sem saída), Função, Empresa, Entrada, Saída, Tempo Total
- **Agrupamento por empresa**: header de grupo com logo/nome da empresa antes dos trabalhadores daquela empresa
- **Dados**: query access_logs no período selecionado, cruzar com workers (name, role/job_function, company), calcular entrada/saída/tempo total por trabalhador
- Detectar "a bordo" (última entrada sem saída correspondente)

### 3. Ajustar componentes existentes
- `CompanyReport`, `OvernightControl`, `PresenceReport`: remover filtros internos redundantes (já recebem do nível da página)
- Todos recebem `projectId`, `startDate`, `endDate` como props

## Detalhes Técnicos
- Query: `access_logs` filtrado por devices do projeto, período selecionado
- Join: `workers` com `companies` e `job_functions` para nome, função, empresa
- Cálculo de tempo: primeira entrada - última saída por trabalhador/dia; "a bordo" = entry sem exit posterior
- Agrupamento: Map por company_name, renderizar header de grupo antes de cada bloco
- Hooks utilizados: `useAccessLogs`, `useJobFunctions`, `useCompanies`, `useWorkers`

### Arquivos alterados/criados
- `src/pages/Reports.tsx` — reestruturar
- `src/components/reports/WorkerTimeReport.tsx` — novo componente principal
- `src/components/reports/PresenceReport.tsx` — remover filtros internos, receber props
- `src/components/reports/CompanyReport.tsx` — já recebe props (ok)
- `src/components/reports/OvernightControl.tsx` — já recebe props (ok)

