
Objetivo: investigar e corrigir a causa raiz da falta de sincronização de eventos (entrada/saída) entre Servidor Local e dashboard.

1) Evidências já confirmadas (investigação profunda)
- O agente está autenticado e vivo: `agent-sync/status` está chegando continuamente (logs da função mostram heartbeat do agente ativo).
- O upload de logs não está acontecendo: não há logs de `upload-logs` na função, e `local_agents.last_sync_at` permanece `NULL`.
- O dashboard Web está consultando corretamente `devices` + `access_logs` (requests 200), então o problema principal está antes da camada de visualização.
- Existem logs no cloud, mas parecem de teste/manual; não há sinal consistente de novos eventos vindos do ciclo local.

2) Causas-raiz prováveis (ordem de prioridade)
- Causa A (alta confiança): `electron/agent.js` parseia evento com contrato frágil (`event.timestamp`, `event.access`, `event.direction`), mas o payload real do ControlID pode vir com outros campos (ex.: `time`, `event` numérico). Resultado: evento é ignorado ou classificado errado.
- Causa B (alta confiança): direção não é normalizada de forma robusta (`entry|exit|unknown`). Se vier `entrada/saida/in/out/numérico`, pode quebrar lógica “a bordo” e também causar falhas no insert cloud (enum).
- Causa C (média/alta): deduplicação compara timestamp como string (`event.timestamp <= lastTimestamp`), suscetível a formatos diferentes e descarte indevido de eventos válidos.
- Causa D (média): endpoint `/api/access/last` pode não refletir todas as mudanças entre polls; sem parser resiliente e fallback, eventos críticos podem não entrar na fila local.

3) Plano de correção (implementação)
- Etapa 1 — Hardening de captura no agente local (`electron/agent.js`)
  - Criar parser canônico de evento com fallback de campos:
    - timestamp: `event.timestamp || event.time || now`
    - status: mapear `event.access`/`event.event` para `granted|denied`
    - direction: mapear `event.direction`/`passage_direction`/códigos para `entry|exit|unknown`
  - Trocar dedupe para comparação temporal real (`Date.parse`) e fallback seguro.
  - Adicionar logs internos de decisão (capturado, ignorado por dedupe, ignorado por payload inválido).

- Etapa 2 — Blindagem do upload (`supabase/functions/agent-sync/index.ts`)
  - Normalizar novamente `direction` e `access_status` no servidor (defesa em profundidade).
  - Inserir em lotes e registrar erro por payload inválido com detalhe (sem falha silenciosa).
  - Retornar métricas no response (`received`, `accepted`, `rejected`) para diagnóstico.

- Etapa 3 — Observabilidade operacional (`electron/sync.js` + `server/routes/sync.js` + `DiagnosticsPanel.tsx`)
  - Expor no status:
    - `capturedEventsCount`
    - `ignoredEventsCount` (+ motivo)
    - `lastUploadAttemptAt`
    - `lastUploadSuccessAt`
    - `lastUploadError`
  - Exibir isso no painel de Diagnóstico para identificar exatamente onde o fluxo quebra (captura → fila → upload → cloud).

- Etapa 4 — Validação de consistência da lógica “a bordo”
  - Garantir que o cálculo local/cloud só interprete `entry/exit` canônicos.
  - Validar que evento `exit` remove trabalhador corretamente quando for o último evento do trabalhador no projeto.

4) Arquivos a ajustar
- `electron/agent.js` (parser robusto + normalização + dedupe temporal)
- `electron/sync.js` (telemetria de upload/captura no status)
- `server/routes/sync.js` (expor métricas extras)
- `src/components/admin/DiagnosticsPanel.tsx` (render dos novos indicadores)
- `supabase/functions/agent-sync/index.ts` (normalização e logging de rejeições no upload)

5) Critérios de aceite (E2E)
- Entrada no leitor: aparece no dashboard Web e Desktop em até ~10s.
- Saída no leitor: trabalhador sai de “a bordo” em até ~10s.
- Diagnóstico mostra progressão real: capturados > enviados > cloud atualizado.
- Em caso de payload fora do padrão, erro aparece claramente no diagnóstico (não silencioso).
