
## Investigação profunda: causas prováveis reais e plano de correção segura

### O que a leitura do código indica
Há pelo menos 3 problemas diferentes acontecendo ao mesmo tempo:

1. **Logs manuais ainda não entram corretamente em todos os relatórios Desktop**
   - O ajuste em `electron/database.js#getAccessLogs` melhorou só um ponto.
   - Mas o ecossistema inteiro usa caminhos diferentes:
     - `getAccessLogs` no SQLite
     - `getWorkersOnBoard`
     - `fetchAccessLogs` na web/nuvem
     - componentes de relatório
     - exportação PDF/Excel
   - Hoje a lógica manual está **fragmentada** e inconsistente.

2. **Horário -3h nos relatórios/PDFs**
   - A normalização de timestamp está sendo aplicada no ingest dos leitores faciais (`electron/agent.js` e funções cloud como `api` / `controlid-webhook`) com regra fixa de `+3h`.
   - Depois, os relatórios e PDFs fazem `new Date(timestamp)` e formatam direto.
   - Se o timestamp já foi “corrigido” na ingestão e depois volta a ser interpretado/localizado no frontend, o efeito visual fica deslocado.
   - Isso explica por que **webview e PDF erram do mesmo jeito**: ambos consomem a mesma base já contaminada.

3. **Entrada/saída pelos leitores faciais não funcionam**
   - O código de captura local (`electron/agent.js`) depende de `load_objects.fcgi` lendo `access_logs` do hardware.
   - Se o equipamento estiver operando em fluxo diferente (ex.: validação online/monitor/webhook sem persistência local compatível, ou retorno de payload diferente do esperado), o app não registra evento.
   - Além disso, o enrollment pode estar “aparentemente feito” na base, mas insuficiente no hardware/na regra do equipamento.
   - Ou seja: **o problema do facial não parece ser só relatório**; é provável falha no pipeline de captura do hardware.

## Conclusão principal
Não é seguro aplicar mais correções pontuais. O problema precisa ser tratado em **3 camadas**, com uma única regra canônica:

```text
Hardware/Manual -> Ingestão canônica -> SQLite/Cloud com mesmo timestamp sem drift
                 -> Consulta compartilhada -> Relatórios Webview/PDF/Excel/Dashboard
```

## Implementação proposta

### Etapa 1 — Unificar a regra canônica de logs de acesso
Criar uma única estratégia para determinar:
- quais logs pertencem ao projeto
- como identificar logs manuais
- como interpretar timestamps
- como ordenar entrada/saída

**Arquivos a revisar/ajustar**
- `electron/database.js`
- `src/hooks/useDataProvider.ts`
- `src/hooks/useControlID.ts`
- `src/hooks/useSupabase.ts`

**Ações**
- Extrair a lógica de filtro por projeto para incluir:
  - dispositivos faciais do projeto
  - pontos manuais do projeto
- Garantir que `getAccessLogs`, `getWorkersOnBoard` e as consultas cloud usem a mesma regra.
- Padronizar o match de manual point para não depender só de string literal frágil `Manual - <nome>`.

### Etapa 2 — Corrigir a origem do drift de horário
**Arquivos a revisar/ajustar**
- `electron/agent.js`
- `supabase/functions/api/index.ts`
- `supabase/functions/controlid-webhook/index.ts`

**Ações**
- Revisar a normalização de tempo dos leitores faciais para existir em **um único lugar conceitual**.
- Remover dupla compensação de fuso.
- Definir contrato claro:
  - banco salva timestamp canônico em UTC
  - UI apenas formata para exibição local
  - nenhuma tela/PDF recalcula “correção” manual
- Aplicar a mesma regra para:
  - polling local
  - webhook
  - ingestão cloud

### Etapa 3 — Corrigir o pipeline do leitor facial
**Arquivos a revisar/ajustar**
- `electron/agent.js`
- `server/lib/controlid.js`
- `server/routes/workers.js`
- `electron/sync.js`

**Ações**
- Validar a compatibilidade entre:
  - enrollment do trabalhador
  - regra de acesso enviada ao dispositivo
  - método de captura dos eventos (`load_objects.fcgi`)
- Tornar o pipeline resiliente para os cenários:
  - evento vindo por polling
  - evento vindo por monitor/webhook
  - equipamento retornando payload parcial
- Garantir que o enrollment/re-enrollment use sempre:
  - `worker.code` correto
  - regra de acesso correta
  - foto quando disponível, mas sem bloquear cadastro se a foto falhar
- Adicionar reconciliação segura para leitores que perderam cadastro local após crash/atualização.

### Etapa 4 — Fazer todos os relatórios e PDFs consumirem a mesma camada já normalizada
**Arquivos a revisar/ajustar**
- `src/components/reports/PresenceReport.tsx`
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/CompanyReport.tsx`
- `src/components/reports/OvernightControl.tsx`
- `src/components/reports/ReportsList.tsx`
- `src/utils/exportReportPdf.ts`
- `src/utils/exportReports.ts`
- utilitários de PDF/Excel relacionados

**Ações**
- Evitar regras locais divergentes por componente.
- Fazer todos consumirem logs já normalizados.
- Padronizar formatação de data/hora para PDF, Excel e tela.
- Garantir que manual + facial apareçam juntos em todas as saídas.

### Etapa 5 — Proteger contra regressão
**Ações**
- Adicionar validações defensivas para:
  - duplicação de log baixado da nuvem
  - log facial sem `worker_id`
  - log manual sem projeto resolvido
  - saída sem entrada anterior
- Preservar o funcionamento offline:
  - SQLite continua sendo fonte offline
  - nuvem e SQLite precisam convergir pelo mesmo modelo canônico

## O que vou corrigir primeiro na implementação
Ordem segura para não “escangalhar” mais nada:

1. **Normalização de timestamp**
2. **Filtro canônico manual + facial**
3. **Pipeline de captura facial**
4. **Consumo unificado nos relatórios/PDFs**
5. **Proteções anti-regressão**

## Resultado esperado após a correção
- Manual e facial aparecem juntos em:
  - relatórios webview
  - PDFs
  - Excel
  - dashboard/feed
- Horário exibido corretamente, sem `-3h`
- Entrada e saída do leitor facial voltam a registrar
- SQLite e nuvem passam a refletir a mesma semântica de dados
- O sistema continua funcionando online e offline

## Detalhes técnicos importantes
- O ajuste anterior em `electron/database.js` foi **insuficiente**, não necessariamente “errado”.
- O bug de horário não está só no relatório: ele nasce na **ingestão**.
- O problema do facial provavelmente não é só cadastro de trabalhador; pode ser incompatibilidade entre **modo do hardware** e o **método de captura** usado pelo agente.
- Por isso a correção precisa ser sistêmica, não pontual.

<lov-actions>
<lov-suggestion message="Teste ponta a ponta entrada e saída nos leitores faciais e no dispositivo manual, depois compare webview e PDF para confirmar que tudo ficou igual">Verifique tudo ponta a ponta</lov-suggestion>
<lov-suggestion message="Implemente a normalização canônica de timestamps e unifique a consulta de logs de acesso para manual e facial em todas as áreas do sistema">Unificar normalização</lov-suggestion>
<lov-suggestion message="Corrija o pipeline de captura dos leitores faciais para suportar polling e monitor/webhook sem perder eventos">Corrigir leitores faciais</lov-suggestion>
<lov-suggestion message="Padronize todos os relatórios e exportações PDF/Excel para consumirem a mesma camada de dados de acesso normalizada">Padronizar relatórios e PDFs</lov-suggestion>
<lov-suggestion message="Adicione validações e proteções contra regressão para evitar drift de horário, duplicidade de logs e divergência entre SQLite e nuvem">Adicionar proteções</lov-suggestion>
</lov-actions>
