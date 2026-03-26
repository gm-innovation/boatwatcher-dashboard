
Objetivo: identificar com precisão em qual etapa quebra o fluxo **ControlID → Servidor Local → Lovable Cloud → access_logs** e deixar isso visível no Diagnóstico Web.

Diagnóstico atual (com base no backend):
- O agente local está online e enviando heartbeat (`last_seen_at` atualiza).
- `local_agents.configuration` continua `{}` (sem `deviceTelemetry`).
- Não há inserts em `access_logs` no backend.
- Portanto, **reiniciar não basta** para mudanças de código; para mudanças do servidor local, precisa **atualizar/reinstalar build**.

Plano de implementação

1) Instrumentar heartbeat com “assinatura de build” e métricas de pipeline
- Arquivo: `electron/sync.js`
- Enviar no `agent-sync/status`:
  - `heartbeatSchemaVersion` (ex.: 2)
  - `deviceTelemetry` (sempre array, mesmo vazio)
  - `pipelineMetrics` com:
    - `capturedEventsCount`, `ignoredInvalidCount`, `ignoredDedupeCount`, `lastCapturedAt`, `lastIgnoreReason`
    - `unsyncedLogsCount`, `uploadLogsCount`, `lastUploadLogsError`

2) Persistir e logar recepção dessas métricas no backend
- Arquivo: `supabase/functions/agent-sync/index.ts`
- Na rota `status`, salvar em `local_agents.configuration`:
  - `heartbeatSchemaVersion`
  - `deviceTelemetry`
  - `pipelineMetrics`
  - `lastHeartbeatReceivedAt`
- Adicionar log objetivo:
  - recebeu telemetria? quantos devices? quantos com payload? contagem de capturas? erro de upload?

3) Exibir “Pipeline de Evento” no Diagnóstico Web
- Arquivo: `src/components/admin/DiagnosticsPanel.tsx`
- Ler `local_agents.configuration` e renderizar um card com 4 etapas:
  - Captura no ControlID (captured/ignored/última captura)
  - Fila local (unsynced logs)
  - Upload para backend (upload count/último erro)
  - Persistência em `access_logs` (último registro)
- Mostrar alerta claro quando o agente não envia `heartbeatSchemaVersion`/telemetria:
  - “Servidor local desatualizado — requer atualização (não apenas restart)”.

4) Incluir telemetria no “Copiar Diagnóstico”
- Arquivo: `src/components/admin/DiagnosticsPanel.tsx`
- Adicionar `deviceTelemetry` + `pipelineMetrics` ao JSON copiado para facilitar suporte técnico.

Validação (fim a fim)
- Após atualizar o servidor local, validar no Diagnóstico Web:
  - `heartbeatSchemaVersion` presente
  - card de pipeline preenchido
  - última captura avançando ao passar na catraca
  - `unsyncedLogsCount` sobe e zera após sync
  - novo registro em `access_logs`.

Detalhes técnicos
- Não precisa nova tabela: usar `local_agents.configuration` (JSONB) para snapshot operacional.
- Se `capturedEventsCount` ficar 0 com devices online, falha está na recepção/parsing local.
- Se capturas > 0 e `unsyncedLogsCount` cresce com `lastUploadLogsError`, falha está no envio ao backend.
- Se upload OK e `access_logs` seguir vazio, falha está na persistência/validação no backend.
