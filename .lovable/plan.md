

## Relatórios PDF de Trabalhadores — Padrão e Detalhado

### Resumo

Substituir o botão "PDF" único por dois botões: **PDF Padrão** (tabela resumida com primeira entrada, última saída, tempo bruto) e **PDF Detalhado** (ficha por trabalhador com todos os eventos individuais e tempo efetivo descontando ausências).

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/utils/exportWorkerReportPdf.ts` | **Novo** — duas funções de geração PDF |
| `src/components/reports/WorkerTimeReport.tsx` | Modificar — adicionar CPF ao data model, dois botões PDF, calcular tempo efetivo |

### 1. Novo utilitário `exportWorkerReportPdf.ts`

**`exportStandardWorkerPdf(options)`** — PDF Padrão:
- Cabeçalho: título, projeto, período, data de geração
- Resumo: total trabalhadores, a bordo, total empresas
- Tabela única com colunas: Nº, Nome, CPF, Função, Empresa, Entrada (primeira), Saída (última), Total (tempo bruto = última saída - primeira entrada)
- Agrupado por empresa (linha de cabeçalho com nome da empresa)
- Landscape A4 para caber todas as colunas

**`exportDetailedWorkerPdf(options)`** — PDF Detalhado:
- Cabeçalho igual ao padrão
- Para cada trabalhador, seção individual com:
  - Dados: Nº, Nome, CPF, Função, Empresa
  - Tabela de todos os eventos individuais: Data/Hora, Tipo (Entrada/Saída), Dispositivo
  - Tempo bruto (última saída - primeira entrada)
  - **Tempo efetivo**: soma dos pares entrada→saída individuais (desconta ausências)
  - Indicador "A bordo" se última ação foi entrada
- Quebra de página entre trabalhadores (ou agrupamento compacto se poucos eventos)

### 2. Mudanças em `WorkerTimeReport.tsx`

- Adicionar `documentNumber` (CPF) ao interface `WorkerTimeRow` e ao `useMemo` de processamento (já disponível via query de workers: `document_number`)
- Adicionar cálculo de `effectiveMinutes` (soma dos pares entry→exit individuais) ao `WorkerTimeRow`
- Substituir botão "PDF" por dropdown com duas opções:
  - "PDF Padrão" → chama `exportStandardWorkerPdf`
  - "PDF Detalhado" → chama `exportDetailedWorkerPdf`
- Passar dados já processados (filteredRows com rawLogs, grouped) para as funções de PDF

### Detalhes técnicos

- Usa `jsPDF` (já instalado) com layout manual
- Tempo bruto = `lastExit - firstEntry` (já calculado como `totalMinutes`)
- Tempo efetivo = soma de `(exit[i].timestamp - entry[i].timestamp)` para cada par alternado nos rawLogs
- CPF vem do campo `document_number` do worker, já disponível na query existente
- Não precisa de queries adicionais ao banco — todos os dados já estão carregados no componente
- Os PDFs são gerados client-side e baixados diretamente

