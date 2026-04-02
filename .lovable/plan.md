

## Adicionar botão "Baixar PDF" e logos no relatório Visão Geral

### O que será feito

1. **Botão "Baixar PDF"** ao lado do botão "Imprimir" existente, usando `jsPDF` para gerar um PDF completo do dashboard (não depender de `window.print()`).

2. **Logos no cabeçalho do PDF** — logo do cliente (da empresa/projeto) e logo do sistema, seguindo o mesmo padrão já usado em `CompanyReport` e `WorkerTimeReport`.

3. **Conteúdo do PDF gerado**:
   - Cabeçalho com logos + título + período + local
   - Cards de KPI (Total Acessos, Trabalhadores, Empresas, Média Diária, Dia Pico, Dia Baixo)
   - Tabela Top 10 Empresas
   - Resumo textual dos dados estatísticos (gráficos recharts não são exportáveis para jsPDF diretamente, então os dados serão apresentados em tabelas)

### Arquivos alterados

**`src/components/reports/PresenceReport.tsx`**
- Importar `useSystemSetting`, `loadImageAsDataUrl`, `exportReportPdf`
- Buscar `systemLogoSetting` e logo do cliente (via company do projeto)
- Adicionar função `handleExportPdf` que:
  - Carrega logos como base64
  - Monta o PDF com jsPDF usando `exportReportPdf` para tabelas e layout manual para KPIs
- Adicionar botão `<Download>` ao lado do botão Imprimir

**`src/utils/exportReportPdf.ts`**
- Criar nova função `exportOverviewReportPdf` que recebe os dados do dashboard e gera um PDF formatado com:
  - Logos no cabeçalho (reusando `fitImageDimensions`)
  - Bloco de KPIs
  - Tabela de acessos por dia da semana
  - Tabela Top 10 empresas
  - Rodapé com data/página

### Padrão seguido
Mesmo padrão de `exportCompanyReportPdf` — logos, cores, tipografia, rodapé.

