
Objetivo: corrigir a sincronização de eventos no dashboard (Web e Desktop) com paridade real entre os dois ambientes.

1) Diagnóstico técnico confirmado
- O agente está enviando heartbeat (`agent-sync/status`), mas não há evidência de `upload-logs`.
- `local_agents.last_sync_at` permanece `NULL`, indicando que o fluxo de envio de logs não está concluindo.
- Hoje o Desktop não baixa `access_logs` da nuvem (só sobe), então não existe paridade bidirecional Web ↔ Desktop.

2) Sincronização imediata após evento (reduzir latência real)
- Arquivos: `server/index.js`, `electron/sync.js`
- Conectar `agentController.onNewEvent(...)` a um gatilho de sync rápido (com debounce/throttle) para não esperar apenas o ciclo de 60s.
- Manter sync periódico como fallback, mas adicionar “fast lane” para eventos de acesso.

3) Paridade bidirecional Web/Desktop para logs
- Arquivos: `supabase/functions/agent-sync/index.ts`, `electron/sync.js`, `electron/database.js`
- Criar endpoint `GET agent-sync/download-access-logs?since=...` (escopado ao `project_id` do agente via `devices`).
- No SyncEngine, adicionar etapa `download-access-logs` com checkpoint próprio (`last_download_access_logs`).
- Implementar `upsertAccessLogFromCloud` no SQLite para evitar duplicação e permitir reconciliação.

4) Corrigir cálculo local de “trabalhadores a bordo” por projeto
- Arquivo: `electron/database.js`
- Ajustar `getWorkersOnBoard(projectId)` para filtrar logs pelos dispositivos do projeto (hoje o SQL ignora `projectId`).
- Usar regra “último evento do trabalhador no projeto” (entry => a bordo, exit => fora).

5) Robustez de direção dos eventos
- Arquivos: `electron/agent.js`, `src/hooks/useSupabase.ts` (se necessário)
- Normalizar direção para `entry|exit|unknown` no momento da captura (incluindo fallback por configuração do dispositivo), evitando casos em que saída não remove trabalhador.

6) Observabilidade para fechar o problema de vez
- Arquivos: `electron/sync.js`, `server/routes/sync.js`, `src/components/admin/DiagnosticsPanel.tsx`
- Expor contadores de fila de logs, último upload de logs e último erro de sync.
- Mostrar esses indicadores no diagnóstico para confirmar rapidamente se o gargalo está em captura, upload ou download.

Validação final (E2E)
- Teste 1: passar na entrada → aparece no dashboard Web e Desktop.
- Teste 2: passar na saída → trabalhador sai de “a bordo” em ambos.
- Teste 3: simular queda de internet, gerar eventos locais e validar reconciliação ao voltar conexão.
