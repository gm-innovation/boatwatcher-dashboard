

## Corrigir PDFs — Adicionar Logos, Cabeçalho e Layout Correto

### Problema
Os PDFs exportados na aba "Todos Trabalhadores" (`ReportsList.tsx`) usam a função genérica `exportAccessLogsToPdf` que não tem logos, info do projeto, nem o layout correto. O PDF deveria seguir o mesmo padrão dos relatórios de trabalhadores e empresas (logos, título, projeto, local, resumo, tabela estilizada).

### Solução

#### 1. Criar `exportAllWorkersReportPdf` em `src/utils/exportWorkerReportPdf.ts`

Nova função dedicada que recebe a lista deduplicada de trabalhadores (não logs brutos) e gera o PDF seguindo o padrão existente:

- **Logos**: Cliente (esquerda) e Sistema (direita) — usando `drawLogos` já existente
- **Título**: "Relatório de Todos os Trabalhadores Registrados"
- **Metadados**: "Projeto: X | Local: Y", "Gerado em: dd/MM/yyyy HH:mm:ss"
- **Resumo**: "Total de Trabalhadores: X | Total de Empresas: Y"
- **Tabela**: Cabeçalho escuro, colunas: Nº, Nome, Empresa, CPF, Função
- **Paginação**: "Página X de Y" no rodapé

Interface:
```typescript
interface AllWorkersReportOptions {
  workers: { code: number | null; name: string; companyName: string; document: string; jobFunction: string }[];
  projectName?: string;
  projectLocation?: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
}
```

#### 2. Atualizar `ReportsList.tsx`

- Importar `exportAllWorkersReportPdf` e `loadImageAsDataUrl` de `exportWorkerReportPdf`
- Receber `projectName`, `projectLocation`, `clientLogoUrl` como props (ou via contexto)
- Tornar `handleExportPdf` async
- Pré-carregar logos como Base64
- Chamar `exportAllWorkersReportPdf` com dados deduplicados + logos + info do projeto
- Adicionar `useSystemSettings` para buscar logo do sistema

#### 3. Atualizar componente pai para passar props necessárias

Verificar onde `ReportsList` é renderizado para garantir que `projectName`, `projectLocation`, e `clientLogoUrl` estão disponíveis.

### Arquivos alterados
- `src/utils/exportWorkerReportPdf.ts` — adicionar `exportAllWorkersReportPdf`
- `src/components/reports/ReportsList.tsx` — refazer exports com logos e layout

