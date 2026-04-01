

## Relatório PDF de Empresas — Seguir Padrão do Print

O PDF atual usa `exportReportPdf` genérico (sem logos, sem info do projeto). O print mostra o mesmo layout usado nos relatórios de trabalhadores: logos do cliente e do sistema, nome do projeto, local, período, tabela com cabeçalho escuro, e rodapé com "Total de Empresas".

### Plano

#### 1. Criar função dedicada `exportCompanyReportPdf` em `src/utils/exportReportPdf.ts`

Nova função que segue o padrão de `exportWorkerReportPdf.ts`:
- **Logos**: Cliente (esquerda) e Sistema (direita) no topo, usando `doc.addImage`
- **Cabeçalho**: Título "Relatório de Empresas" centralizado, linha com "Projeto: X | Local: Y", linha com "Período: dd/MM/yyyy a dd/MM/yyyy"
- **Separador**: Linha horizontal após o cabeçalho
- **Tabela**: Cabeçalho com fundo escuro (#323232), colunas: Empresa, Funcionários, Entrada (formato `dd/MM HH:mm`), Saída ("A bordo" ou `dd/MM HH:mm`), Permanência
- **Rodapé da tabela**: "Total de Empresas: X" em negrito
- **Paginação**: "Página X de Y" no rodapé

Interface de parâmetros:
```typescript
interface CompanyPdfOptions {
  companies: { name, totalWorkers, firstEntry, lastExit, allExited, onBoardNow, totalMinutes }[];
  startDate: string;
  endDate: string;
  projectName?: string;
  projectLocation?: string;
  clientLogoDataUrl?: string;
  systemLogoDataUrl?: string;
}
```

#### 2. Atualizar `CompanyReport.tsx` — `handleExportPdf`

- Importar `loadImageAsDataUrl` de `exportWorkerReportPdf`
- Importar `useSystemSetting` e buscar `system_logo`
- Tornar `handleExportPdf` async
- Pré-carregar logos (cliente e sistema) como Base64
- Chamar `exportCompanyReportPdf` com dados completos (projeto, local, logos, empresas filtradas)

#### Arquivos alterados
- `src/utils/exportReportPdf.ts` — adicionar `exportCompanyReportPdf`
- `src/components/reports/CompanyReport.tsx` — atualizar import, buscar logo do sistema, refazer `handleExportPdf`

