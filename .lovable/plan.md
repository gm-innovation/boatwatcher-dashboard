

## Reformular aba "Todos Trabalhadores" — Lista de Trabalhadores que Acessaram

### Contexto
A aba "Todos Trabalhadores" atualmente exibe logs brutos de acesso (cada evento individual). O objetivo real é mostrar uma **lista deduplicada de trabalhadores únicos** que acessaram a embarcação no período selecionado, agrupados por empresa — conforme o print de referência.

### O que muda

**Arquivo: `src/components/reports/ReportsList.tsx`** — reescrever completamente

1. **Dados**: Continuar usando `useAccessLogs` para buscar os logs do período, mas processar client-side para extrair trabalhadores únicos
2. **Deduplicação**: Agrupar logs por `worker_id`, extraindo de cada grupo: `worker_name`, `worker_document`, `company_name` (via lookup), `code` e `job_function`
   - Para obter empresa e função, buscar workers via `useWorkers` (ou dados já disponíveis nos logs)
   - Precisarei consultar a tabela `workers` para obter `code` e `job_function_id`, e `companies` para nome da empresa
3. **Agrupamento por empresa**: Renderizar seção por empresa com logo e nome (como no print), listando os trabalhadores daquela empresa
4. **Colunas da tabela**: Nº (code serial), Nome, Empresa, CPF, Função
5. **Busca**: Filtro por nome/CPF mantido
6. **Título**: "Todos os Trabalhadores com Acesso"
7. **Exports PDF/Excel**: Atualizar para exportar a lista deduplicada (não logs brutos)

### Dados necessários (hooks adicionais)
- `useWorkers(projectId)` — para obter `code`, `company_id`, `job_function_id`
- `useCompanies()` — para nome da empresa
- `useJobFunctions()` — para nome da função

### Lógica de processamento
```text
accessLogs (período) 
  → extrair worker_ids únicos com access_status === 'granted'
  → cruzar com workers table para code, company_id, job_function_id
  → agrupar por company_id
  → renderizar seções por empresa
```

### Layout (conforme print)
- Header: "Todos os Trabalhadores com Acesso"
- Para cada empresa: logo + nome como sub-header
- Tabela: Nº | Nome | Empresa | CPF | Função
- Botões: Exportar CSV, Exportar PDF

### Arquivo alterado
- `src/components/reports/ReportsList.tsx` — reescrita completa do componente

