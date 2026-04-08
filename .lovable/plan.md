
Objetivo revisado: corrigir sem “forçar cloud” nos relatórios. O comportamento correto será:
- cloud e SQLite convergem para o mesmo conjunto de logs
- web e desktop exibem os mesmos horários em BRT
- manual + facial continuam juntos em tela, PDF e Excel
- offline continua funcionando com SQLite, mas sem divergência quando voltar online

O que a leitura do código confirmou agora

1. O problema não é só “desktop lendo SQLite”
- `fetchAccessLogs()` hoje usa SQLite no desktop quando o servidor local está disponível.
- Isso por si só não seria problema se a sincronização estivesse realmente bidirecional e canônica.
- O erro real é que a sincronização de `access_logs` não garante convergência completa.

2. A sync de logs está assimétrica e deixa o SQLite desatualizado
- `electron/sync.js#downloadAccessLogs` baixa logs por checkpoint de `created_at`.
- `supabase/functions/agent-sync/index.ts#download-access-logs` também filtra por `created_at`.
- Só que vários logs podem ser enriquecidos/corrigidos depois (ex.: preencher `worker_id`, `worker_name`, `worker_document`) sem mudar `created_at`.
- Resultado: a nuvem fica certa e o SQLite continua com versão velha/incompleta do mesmo evento.
- Isso explica por que o desktop pode seguir “vendo menos” ou “vendo errado” mesmo depois de a nuvem já estar correta.

3. O webview também está errado no horário porque a UI ainda depende do timezone da máquina
Há vários pontos usando `format(new Date(timestamp), ...)` e `getHours()`/`parseISO()` diretamente:
- `WorkerTimeReport.tsx`
- `PresenceReport.tsx`
- `OvernightControl.tsx`
- `exportWorkerReportPdf.ts`
- `exportReports.ts`

Isso faz a exibição e o agrupamento dependerem do timezone do renderer/browser, não do BRT explicitamente.

Implementação proposta

1. Tornar a sincronização de access logs realmente bidirecional e convergente
Arquivos:
- `supabase/migrations/...`
- `supabase/functions/agent-sync/index.ts`
- `electron/sync.js`
- `electron/database.js`

Ações:
- Adicionar `updated_at` em `access_logs` no backend, com backfill e trigger de atualização.
- Passar a sincronização de download de logs a usar `updated_at`, não `created_at`.
- Incluir `updated_at` no payload de `download-access-logs`.
- Salvar `updated_at` também no SQLite.
- Trocar o checkpoint local de logs para semântica baseada em atualização canônica, não só criação.

Impacto:
- Se um log for enriquecido/corrigido na nuvem, o desktop baixa a versão nova.
- Cloud e SQLite passam a convergir de verdade.

2. Reconciliar logs no SQLite por chave canônica do evento
Arquivos:
- `electron/database.js`

Ações:
- Ao receber log da nuvem em `upsertAccessLogFromCloud`, não casar só por `id`.
- Também reconciliar por chave canônica do evento:
  - `device_id + timestamp + direction` para eventos de dispositivo
  - `device_name + timestamp + direction` para eventos manuais sem `device_id`
- Se já existir uma linha local equivalente, atualizar essa linha com os dados canônicos da nuvem em vez de inserir duplicata/stale copy.
- Preservar `worker_id`, `worker_name`, `worker_document`, `timestamp`, `device_name`, `updated_at` como versão canônica da nuvem.

Impacto:
- Evita que o SQLite fique com evento “antigo/local” e a nuvem com evento “corrigido”.
- Remove a principal causa de divergência entre desktop e web.

3. Centralizar a regra de data/hora em BRT
Arquivos:
- criar utilitário compartilhado em `src/lib/` ou `src/utils/`
- `src/hooks/useDataProvider.ts`
- `electron/database.js`
- componentes e exportadores de relatório

Ações:
- Criar helpers únicos para:
  - formatar timestamp em BRT
  - obter hora BRT
  - obter chave de dia em BRT
  - calcular limites UTC do dia BRT (`03:00Z` até `02:59:59Z`)
- Parar de repetir `T03:00:00.000Z`, `02:59:59.999Z` e `new Date(...)/format(...)` espalhados.
- Usar esse helper tanto nas queries quanto na apresentação.

Impacto:
- Webview e desktop deixam de depender do timezone do sistema.
- O horário exibido passa a ser explicitamente BRT em todos os lugares.

4. Corrigir todos os relatórios webview que ainda usam timezone implícito
Arquivos:
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/CompanyReport.tsx`
- `src/components/reports/PresenceReport.tsx`
- `src/components/reports/OvernightControl.tsx`
- `src/components/reports/ReportsList.tsx`
- `src/components/CompaniesList.tsx`

Ações:
- Trocar exibição direta `format(new Date(timestamp), ...)` por formatter BRT central.
- Corrigir agrupamento por dia em `PresenceReport` para usar chave BRT, não timezone local.
- Corrigir cálculo/label de pernoite para usar comparação de datas em BRT.
- Manter cálculos de duração em milissegundos UTC, mas exibição/classificação em BRT.

Impacto:
- O webview deixa de mostrar horário errado.
- Os agrupamentos por dia/turno/pernoite ficam consistentes.

5. Corrigir PDFs e Excel para usar a mesma camada temporal
Arquivos:
- `src/utils/exportWorkerReportPdf.ts`
- `src/utils/exportReportPdf.ts`
- `src/utils/exportReports.ts`

Ações:
- Substituir `getHours()` e `format(new Date(log.timestamp), ...)` por utilitários BRT.
- Fazer PDF/Excel exibirem exatamente os mesmos horários do webview.
- Garantir que classificação diurno/noturno e timestamps detalhados usem a mesma regra.

Impacto:
- Webview, PDF e Excel passam a bater entre si.

6. Preservar o requisito do usuário: leitura e escrita em 2 vias
Decisão de arquitetura:
- Não vou tratar “forceCloud” como correção principal dos relatórios.
- O fluxo correto será:
```text
captura local/manual/cloud
 -> nuvem recebe versão canônica
 -> desktop baixa atualizações canônicas
 -> SQLite e cloud convergem
 -> relatórios podem usar a abstração normal sem divergência
```

Detalhes técnicos importantes
- O bug central de paridade é o uso de `created_at` na sync de `access_logs`; isso impede o desktop de receber enriquecimentos/correções já feitos na nuvem.
- O bug de horário no webview é de apresentação/agregação: ainda existe uso de timezone implícito em vários relatórios.
- Não vou “mascarar” o problema usando nuvem apenas; vou corrigir a convergência bidirecional como você pediu.

Arquivos principais a ajustar
- `supabase/migrations/...` para `access_logs.updated_at`
- `supabase/functions/agent-sync/index.ts`
- `electron/sync.js`
- `electron/database.js`
- utilitário compartilhado de data/hora BRT
- `src/hooks/useDataProvider.ts`
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/CompanyReport.tsx`
- `src/components/reports/PresenceReport.tsx`
- `src/components/reports/OvernightControl.tsx`
- `src/components/reports/ReportsList.tsx`
- `src/components/CompaniesList.tsx`
- `src/utils/exportWorkerReportPdf.ts`
- `src/utils/exportReports.ts`

Resultado esperado
- web e desktop mostram os mesmos eventos
- webview exibe horários corretos em BRT
- desktop exibe horários corretos em BRT
- PDF e Excel batem com a tela
- manual + facial aparecem juntos
- cloud e SQLite passam a refletir a mesma verdade canônica
