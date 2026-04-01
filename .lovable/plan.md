

## Recriar Layout dos PDFs — Formato Retrato com Logos

### Contexto

Os prints mostram o layout desejado com:
- **Logo do cliente** (OceanPact) à esquerda e **logo do sistema** (googlemarine) à direita no cabeçalho
- Formato **retrato** (portrait) em ambos os PDFs
- Cabeçalho com: título, projeto + local, período, contagem de trabalhadores (diurnos/noturnos), empresas
- Nota sobre `(*)` indicando permanência além do período
- **PDF Padrão**: agrupado por período (Diurno 05:00-18:59 / Noturno 19:00-04:59), não por empresa
- **PDF Detalhado**: seção individual por trabalhador com registros separados por período diurno/noturno, e informações detalhadas (primeira entrada, status, tempo total, tempo efetivo)
- Linha horizontal separadora antes de cada seção principal

### Arquivos alterados

| Arquivo | Mudança |
|---------|------|
| `src/utils/exportWorkerReportPdf.ts` | Reescrever ambas funções com novo layout |
| `src/components/reports/WorkerTimeReport.tsx` | Passar dados de projeto (location, client logos, system logo) para as funções de PDF |

### 1. Interface de opções — adicionar campos de logo e projeto

```typescript
interface PdfOptions {
  rows: WorkerRow[];
  grouped: [string, WorkerRow[]][];
  startDate: string;
  endDate: string;
  projectName?: string;
  projectLocation?: string;
  clientLogoUrl?: string;   // logo_url_light da company/client do projeto
  systemLogoUrl?: string;   // system_logo light_url
}
```

### 2. Novo `drawHeader` com logos

- Carregar as duas imagens (client logo esquerda, system logo direita) como `Image()` com `crossOrigin = 'anonymous'`
- Se falhar o carregamento, ignorar a logo e usar espaço para texto
- Título: "Relatório de Acesso por Trabalhador" (padrão) ou "Relatório de Controle de Acessos de Colaboradores" (detalhado)
- Subtítulo: `Projeto: {name} | Local: {location}`
- Período: `Período: dd/MM/yyyy a dd/MM/yyyy`
- Contagem: `Total de Trabalhadores: X (Diurnos: Y, Noturnos: Z) | Total de Empresas: W`
- Data geração em verde/cinza claro
- Nota `(*)` em itálico
- Linha horizontal separadora

### 3. PDF Padrão — agrupar por período, não por empresa

Mudança principal: em vez de agrupar por empresa, agrupar os trabalhadores em dois blocos:
- **"Trabalhadores - Período Diurno (05:00 - 18:59)"**: trabalhadores cuja primeira entrada foi entre 05:00-18:59
- **"Trabalhadores - Período Noturno (19:00 - 04:59)"**: trabalhadores cuja primeira entrada foi entre 19:00-04:59
- Se um período não tem trabalhadores: "Nenhum trabalhador noturno neste período."
- Colunas: Nº (código), Nome, CPF, Função, Empresa, Entrada (com indicador D/N), Saída, Total
- Usar `workerCode` (não índice sequencial) na coluna Nº
- Orientação: **portrait** A4

### 4. PDF Detalhado — seção por trabalhador com períodos

Para cada trabalhador:
- Linha horizontal separadora
- **"Trabalhador: {Nome} (Nº: {código})"** em bold
- CPF, Função, Empresa numa linha
- Primeira Entrada no Período, Status ao Final, Tempo Total, Tempo Efetivo
- Sub-seção **"Registros Diurnos (05:00 - 18:59)"** com lista cronológica: data, hora, ENTRADA/SAÍDA, dispositivo
- Sub-seção **"Registros Noturnos (19:00 - 04:59)"** idem
- Orientação: **portrait** A4

### 5. WorkerTimeReport.tsx — passar dados extras

- Buscar o projeto selecionado (com `client_id`) para obter `location` e `client.logo_url_light`
- Buscar `system_logo` setting (light_url)
- Passar `projectName`, `projectLocation`, `clientLogoUrl`, `systemLogoUrl` para ambas funções de export
- Pré-carregar as imagens como data URLs antes de chamar o export (usando `fetch` + `blob` + `toDataURL` via canvas) para evitar problemas de CORS no jsPDF

### Detalhes técnicos

- As logos são carregadas como base64 data URLs antes de passar ao jsPDF (resolve CORS)
- `jsPDF.addImage(dataUrl, 'PNG', x, y, w, h)` para posicionar as logos
- Classificação diurno/noturno baseada na hora da primeira entrada do trabalhador
- O formato passa de landscape para **portrait** no PDF padrão (colunas mais compactas)

