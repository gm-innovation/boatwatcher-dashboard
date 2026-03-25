
Objetivo: reduzir drasticamente o tempo entre “salvar trabalhador” e “trabalhador apto no leitor”, atacando o gargalo do agente (não do modal).

Diagnóstico (com evidência do código atual):
- `worker-enrollment` está rápido: enfileira comandos em ~2s.
- Os comandos ficam `pending` por muitos minutos mesmo com agente `online` (status `idle`).
- Causa principal: o processamento de `agent_commands` no servidor local só roda dentro de `triggerSync()` (`electron/sync.js`), que hoje depende de condições de sync offline/pendências locais. Se não houver pendências locais, os comandos de enrollment podem ficar sem consumo.
- Causa secundária (escala): `downloadAndExecuteCommands()` processa fila de forma sequencial; um dispositivo lento/offline bloqueia os demais.

Plano de implementação

1) Separar “poll de comandos” do ciclo de sync completo (correção principal de latência)
- Arquivo: `electron/sync.js`
- Criar loop dedicado de comandos (ex.: 3–5s) independente do `syncIntervalMs` de 60s.
- Esse loop executa `downloadAndExecuteCommands()` mesmo quando `pending_sync_count = 0`.
- Adicionar lock de reentrada (`isProcessingCommands`) para evitar execução concorrente e duplicada.
- Resultado esperado: comando sai de `pending` em segundos, não minutos.

2) Aumentar throughput do agente para não “engarrafar” em massa
- Arquivo: `electron/sync.js`
- Refatorar executor para processar por dispositivo em paralelo controlado:
  - serial por dispositivo (preserva ordem no leitor),
  - paralelo entre dispositivos (evita um leitor ruim bloquear todos).
- Adicionar cache de foto por `photo_signed_url`/worker no ciclo atual para não baixar a mesma foto várias vezes.
- Manter timeout/retry com falha isolada por comando.

3) Melhorar o protocolo de fila para visibilidade e robustez
- Arquivo: `supabase/functions/agent-sync/index.ts`
- Em `download-commands`, marcar lote retornado como `in_progress` antes de devolver (claim de trabalho).
- Em `upload-command-result`, manter `executed_at` apenas em `completed/failed`.
- Incluir retorno de métricas (`claimedCount`, `remainingPending`) para diagnóstico.
- Isso reduz risco de duplicidade e dá rastreabilidade real do processamento.

4) Otimizar cenário de projeto grande (milhares de trabalhadores)
- Arquivos: `supabase/functions/worker-enrollment/index.ts`, `src/components/devices/DeviceManagement.tsx`
- Evitar loop sequencial “1 worker = 1 invoke” no frontend ao cadastrar dispositivo.
- Criar modo bulk no `worker-enrollment` (`workerIds[]` + resolução de devices) para enfileirar em lote no backend.
- Front dispara 1 chamada bulk por projeto/dispositivo novo.
- Resultado: tempo de enfileiramento cai de minutos para segundos.

5) Índice de banco para fila grande
- Migração SQL:
  - `create index if not exists idx_agent_commands_agent_status_created_at on public.agent_commands(agent_id, status, created_at);`
- Melhora consulta de `download-commands` sob carga alta.

6) Critérios de aceite (SLA operacional)
- Com agente online:
  - comando deve sair de `pending` para `in_progress` em até 5s (p95);
  - enrollment de 1 trabalhador em 1–2 dispositivos online em até ~15–30s (dependendo do leitor/rede local).
- Em massa:
  - fila é drenada continuamente sem depender de eventos de sync local.
  - um dispositivo offline não bloqueia os demais.

Arquivos impactados
- `electron/sync.js` (principal)
- `supabase/functions/agent-sync/index.ts`
- `supabase/functions/worker-enrollment/index.ts`
- `src/components/devices/DeviceManagement.tsx`
- `supabase/migrations/*` (índice da fila)

Risco/compatibilidade
- Mudança é compatível com o fluxo atual (continua assíncrono por fila), mas remove o gargalo de espera por ciclo de sync.
- Não altera regra de negócio de vínculo worker→projetos→dispositivos; apenas acelera consumo e escala da fila.
