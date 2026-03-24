
Diagnóstico objetivo (com evidência)
- O agente está vivo: `local_agents.last_seen_at` está avançando a cada ~60s.
- Os dispositivos não recebem atualização: `devices.updated_at` ficou parado em `20:52:04`.
- Logo, o heartbeat está chegando, mas sem telemetria de dispositivos (sem `devices[]`) no endpoint `agent-sync/status`.
- Do I know what the issue is? **Sim**: existe um descompasso de protocolo (cliente local enviando heartbeat “legado” sem `devices`) e o backend hoje não tem fallback para esse caso.

Plano de correção (em 2 fases, sem depender só de reinstalação local)
1) Compatibilidade imediata no backend (`supabase/functions/agent-sync/index.ts`)
- No `POST /status`, sempre registrar modo do heartbeat:
  - `mode=full` quando vier `devices[]`
  - `mode=legacy` quando não vier
- Se `mode=legacy`, aplicar fallback:
  - atualizar `devices.status='online'` para todos os dispositivos com `agent_id = agent.id`
  - atualizar `updated_at`
- Se `mode=full`, manter atualização por `serial_number` (como já está), com normalização (`trim`).

2) Blindagem de observabilidade no backend (mesmo arquivo)
- Retornar no JSON: `mode`, `devices_received`, `devices_updated`.
- Logar sempre 1 linha por heartbeat com esses campos (inclusive quando `devices` não vier), para não ficar “silencioso” novamente.

3) Correção de protocolo no cliente local (próximo release) (`electron/sync.js` + `electron/agent.js`)
- Garantir envio obrigatório de `devices[]` em todos os heartbeats.
- Incluir `heartbeat_schema_version: 2`.
- Se `devices[]` vier vazio mas houver devices locais, forçar `reloadDevices()` e reenviar no próximo ciclo.
- Manter normalização de serial (`trim`) antes do envio.

4) Evitar falsa percepção no painel local (`electron/server-ui.html`)
- Renomear coluna “Conectividade” para “Teste manual”.
- Mostrar separadamente “Status enviado ao sistema” (baseado no heartbeat), para alinhar expectativa com Web/Desktop.

5) Diagnóstico visível na Web (`src/components/admin/DiagnosticsPanel.tsx` e `src/components/devices/ConnectivityDashboard.tsx`)
- Exibir:
  - Último modo de heartbeat (`full`/`legacy`)
  - `devices_received` e `devices_updated` do último ciclo
  - Timestamp da última atualização de status de dispositivos
- Assim fica claro quando o agente está online, mas sem payload de conectividade.

Validação fim-a-fim
1. Reiniciar serviço local.
2. Confirmar em até 60–90s:
- `local_agents.last_seen_at` avança
- `devices.updated_at` avança
- status muda para online na Web/Desktop
3. Desligar o agente local:
- dispositivos voltam para offline por ausência de heartbeat (ou por regra de staleness, se aplicada).
4. Confirmar no Diagnóstico:
- heartbeat em `full` (ideal) ou `legacy` (compatibilidade ativa).

Arquivos-alvo
- `supabase/functions/agent-sync/index.ts` (principal, correção imediata)
- `electron/sync.js`
- `electron/agent.js`
- `electron/server-ui.html`
- `src/components/admin/DiagnosticsPanel.tsx`
- `src/components/devices/ConnectivityDashboard.tsx`
