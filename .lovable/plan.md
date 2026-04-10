
Você está certo: o erro foi de escopo. Pelo código atual, a regressão veio de misturar correção de relatório com o pipeline do dashboard.

Diagnóstico confirmado no código:
- `src/hooks/useSupabase.ts` hoje faz uma normalização de horário dentro de `useWorkersOnBoard()` para o caminho do dashboard local. Essa foi a intervenção errada: o dashboard passou a carregar regra de correção que deveria ficar isolada no fluxo de relatórios.
- O problema de manual no Desktop está em outro lugar: `AccessControl.tsx` envia `worker_id` vindo da nuvem, mas no SQLite local os trabalhadores são salvos com `id` local e `cloud_id` separado. Em `electron/database.js`, `insertAccessLog()` grava `worker_id` direto. Isso pode quebrar a gravação local ou forçar fallback para nuvem, o que explica exatamente o padrão “web ok / desktop não” nos eventos manuais.
- O fluxo de relatórios já tem uma camada própria (`server/routes/access-logs.js` + `src/utils/reportNormalization.ts`). O erro foi levar essa lógica para o dashboard.

Plano de correção, sem repetir a confusão dos últimos dias:

1. Restaurar o dashboard ao estado estável
- Remover a correção de +3h adicionada em `src/hooks/useSupabase.ts` dentro de `useWorkersOnBoard()`.
- Não adicionar nova lógica de fuso no dashboard.
- Não mexer em:
  - `src/components/dashboard/Dashboard.tsx`
  - `src/components/dashboard/WorkersOnBoardTable.tsx`
  - contadores/cards do dashboard

2. Corrigir o fluxo manual do Desktop na borda local
- Em `electron/database.js`, ajustar `insertAccessLog()` para resolver `worker_id` por `workers.id OR workers.cloud_id` antes de inserir no SQLite.
- Isso faz o manual gravar localmente de forma imediata, sem depender de download posterior da nuvem.
- Como o sync já sabe converter `worker_id` local de volta para o ID da nuvem no upload, essa correção é compatível com o restante do pipeline.

3. Endurecer o fallback do controle de acesso manual
- Em `src/hooks/useOfflineAccessControl.ts`, trocar a decisão baseada só no snapshot (`usesLocalServer()`) por uma checagem ativa de disponibilidade do servidor local antes de cair para nuvem.
- Assim eu cubro os dois cenários que hoje geram inconsistência:
  - ID incompatível entre nuvem e SQLite
  - fallback indevido para nuvem mesmo com servidor local disponível

4. Deixar relatórios isolados do dashboard
- Não tocar nos componentes visuais dos relatórios neste primeiro reparo.
- Se, depois de restaurar o dashboard e consertar o fluxo manual local, ainda restar erro de horário nos relatórios do Desktop, o ajuste ficará restrito a um destes pontos centrais:
  - `server/routes/access-logs.js`
  - `src/utils/reportNormalization.ts`
- Ou seja: correção de relatório continua no pipeline de relatório, não no dashboard.

Arquivos previstos nesta rodada:
- `src/hooks/useSupabase.ts` — remover a normalização indevida do dashboard
- `electron/database.js` — resolver `worker_id` local/cloud no `insertAccessLog()`
- `src/hooks/useOfflineAccessControl.ts` — checagem real do servidor local antes do fallback

Arquivos que não entram nesta recuperação:
- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/WorkersOnBoardTable.tsx`
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/PresenceReport.tsx`
- `package.json`
- arquivos de release / installer / electron-builder

Validação que eu vou seguir antes de considerar a correção fechada:
- entrada manual: web e desktop
- saída manual após entrada facial: web e desktop
- entrada facial: web e desktop
- saída facial: web e desktop
- horário de empresa no dashboard web
- horários dos relatórios no desktop

Resultado esperado:
- o dashboard volta ao comportamento que você já tinha como correto
- o manual no Desktop deixa de “sumir” para a nuvem
- a consistência volta entre web e desktop
- qualquer correção restante de relatório fica isolada no fluxo de relatório, sem mexer de novo no dashboard
