
Objetivo agora: desfazer a regressão e restaurar um fluxo único e confiável para dashboard + relatórios + sync bidirecional, sem “forçar cloud” e sem depender do fuso da máquina.

Do I know what the issue is? Sim.

Diagnóstico confirmado no código:
1. Ainda existe split-brain entre dashboard e relatórios.
- Dashboard usa caminho cloud-first em `src/hooks/useSupabase.ts#useWorkersOnBoard`.
- Relatórios usam `useAccessLogs` → `fetchAccessLogs` → local-first em `src/hooks/useDataProvider.ts`.
- Resultado: um evento pode aparecer no dashboard e não no relatório, ou vice-versa.

2. A correção de convergência ficou incompleta no SQLite.
- `electron/database.js` cria `access_logs` sem coluna `updated_at`.
- `upsertAccessLogFromCloud()` recebe `updated_at`, mas não salva esse campo; hoje ele sobrescreve `created_at`.
- Então a sync por `updated_at` foi implementada na função cloud e no cursor do desktop, mas o banco local ainda não preserva a versão canônica do log.

3. O horário errado ainda está espalhado em vários pontos.
- Há uso residual de timezone implícito em:
  - `src/components/dashboard/RecentActivityFeed.tsx`
  - `src/components/dashboard/WorkersOnBoardTable.tsx`
  - `src/components/reports/PresenceReport.tsx`
  - `src/components/reports/OvernightControl.tsx`
  - `src/utils/exportReportPdf.ts`
  - `src/utils/exportReports.ts`
  - partes de `src/utils/exportWorkerReportPdf.ts`
- Também há parsing perigoso com `new Date(startDate)` para strings `yyyy-MM-dd`, que pode deslocar o dia.

4. O dashboard ignora eventos faciais sem identidade resolvida.
- Em `useWorkersOnBoard`, o trabalhador só entra no estado se houver `worker_id` ou `worker_name`.
- Se o facial entrou no SQLite local mas não convergiu corretamente para a nuvem, o relatório local pode ver algo que o dashboard cloud não vê.

5. Existe suspeita real no parser do agente para payloads do Control iD.
- `electron/agent.js#normalizeTimestamp()` trata timestamps com timezone como “já corretos”.
- Se o dispositivo estiver enviando timestamp com marcador enganoso, isso mantém o erro de -3h na origem.
- Isso explica por que ainda há entrada aparecendo 3h antes mesmo após a camada de formatação em BRT.

Plano de correção revisado:
1. Consertar a convergência real cloud ↔ SQLite
- Adicionar `updated_at` em `access_logs` local e migrar registros existentes.
- Salvar `updated_at` corretamente em `upsertAccessLogFromCloud()`.
- Atualizar reconciliação local para usar a versão mais nova do evento, sem reaproveitar `created_at` como se fosse atualização.
- Preservar a chave canônica por `device_id/device_name + timestamp + direction`.

2. Unificar a semântica de consulta entre dashboard e relatórios
- Extrair uma regra única para seleção de logs por projeto:
  - dispositivos do projeto
  - terminais manuais do projeto
  - apenas eventos válidos
  - ordenação por `timestamp` real
- Aplicar a mesma regra em:
  - `fetchAccessLogs`
  - `getWorkersOnBoard` local
  - `fetchWorkersOnBoardFromCloud`
- Assim dashboard e relatórios passam a depender da mesma verdade lógica.

3. Corrigir a ingestão temporal na origem
- Revisar `electron/agent.js#normalizeTimestamp()` com foco em todos os formatos reais do Control iD.
- Tratar explicitamente:
  - epoch numérico
  - string sem timezone
  - string com timezone possivelmente ambíguo
- Padronizar: armazenar UTC canônico, exibir BRT.

4. Finalizar a padronização BRT na UI e exportações
- Trocar todos os usos restantes de `format(new Date(...))`, `getDay(new Date(...))`, `parseISO(...)` e `new Date('yyyy-mm-dd')` por utilitários centralizados de `src/utils/brt.ts`.
- Corrigir também labels de período e rodapés de PDF/export para não dependerem do timezone do navegador/Electron.

5. Restaurar o facial no dashboard sem quebrar o manual
- Garantir que logs faciais resolvidos localmente subam rápido e reapareçam no cloud/dashboard.
- Garantir que enriquecimentos cloud voltem para o SQLite e substituam cópias incompletas.
- Manter manual e facial no mesmo pipeline lógico de projeto.

6. Reparar dados já afetados
- Aplicar correção dirigida para eventos gerados na janela quebrada:
  - preencher identidade faltante quando houver correspondência segura
  - corrigir timestamps deslocados apenas nos registros comprovadamente afetados
- Fazer isso de forma cirúrgica para não alterar históricos já corretos.

Arquivos principais:
- `electron/agent.js`
- `electron/database.js`
- `electron/sync.js`
- `supabase/functions/agent-sync/index.ts`
- `src/hooks/useDataProvider.ts`
- `src/hooks/useSupabase.ts`
- `src/hooks/useControlID.ts`
- `src/components/dashboard/RecentActivityFeed.tsx`
- `src/components/dashboard/WorkersOnBoardTable.tsx`
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/CompanyReport.tsx`
- `src/components/reports/PresenceReport.tsx`
- `src/components/reports/OvernightControl.tsx`
- `src/utils/exportWorkerReportPdf.ts`
- `src/utils/exportReportPdf.ts`
- `src/utils/exportReports.ts`

Resultado esperado:
- facial volta a aparecer no dashboard
- manual continua aparecendo no dashboard
- manual e facial aparecem juntos nos relatórios
- web e desktop batem
- horário em tela/PDF/CSV/Excel fica correto em BRT
- cloud e SQLite voltam a convergir de verdade
