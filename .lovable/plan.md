
Correção proposta (foco: dispositivos seguem offline no Web/Desktop)

Diagnóstico confirmado
- O agente local está mandando heartbeat (o agente aparece online no backend), mas os dispositivos não são atualizados: `devices.updated_at` está parado.
- Isso indica que o heartbeat de status está chegando sem `devices` útil (array vazio ou sem seriais válidos), então a atualização de dispositivos não roda.
- Há um ponto crítico no runtime local: o `AgentController` só começa polling quando `start()` é chamado, e hoje isso depende de chamada manual. Se ele não estiver rodando, a telemetria de conectividade não sobe para o backend.
- A UI do Local Server mostra “online” via teste direto de IP, mas isso não é a mesma fonte usada pelo heartbeat do sistema.

Plano de implementação

1) Garantir polling do agente sempre ativo no Local Server
- Arquivo: `server/index.js`
- Iniciar `agentController.start()` automaticamente no boot do servidor local (com tratamento de erro e log, sem derrubar o serviço).
- Motivo: elimina dependência de botão/manual e garante geração contínua de conectividade para heartbeat.

2) Persistir conectividade no SQLite local a cada ciclo de polling
- Arquivo: `electron/agent.js`
- No `pollDevices()`, além de atualizar `deviceConnectivity` em memória, atualizar também `devices.status` no SQLite para `online/offline`.
- Manter `last_event_timestamp` apenas para evento real (não sobrescrever sem evento), mas registrar “status de conectividade” localmente.
- Motivo: o Desktop (modo local) lê status do banco local; sem isso, ele continua offline mesmo quando o leitor está acessível.

3) Blindar payload de heartbeat para nunca subir vazio quando há dispositivos
- Arquivo: `electron/sync.js`
- Antes de enviar heartbeat, forçar `reloadDevices()` se o relatório vier vazio e houver dispositivos no banco local.
- Normalizar serial (`trim`) ao montar `devices`.
- Logar no runtime local quantos dispositivos foram enviados no heartbeat (ex.: `devices_sent=2`).
- Motivo: evita falso “agente online / dispositivos offline” por falha de carregamento em memória.

4) Robustez no endpoint de status do backend
- Arquivo: `supabase/functions/agent-sync/index.ts`
- Normalizar `serial_number` recebido (`trim`) antes do `update`.
- Contabilizar quantos dispositivos foram recebidos e quantos updates efetivamente aplicados; retornar isso na resposta do endpoint.
- Adicionar log de diagnóstico quando `body.devices` vier vazio.
- Motivo: facilita diagnosticar rapidamente se o problema está no envio local ou no match por serial/agent.

5) Observabilidade na interface de diagnóstico
- Arquivos: `src/components/admin/DiagnosticsPanel.tsx` e/ou `src/components/devices/ConnectivityDashboard.tsx`
- Mostrar 2 indicadores novos:
  - “Dispositivos enviados no último heartbeat”
  - “Última atualização de status dos dispositivos”
- Motivo: deixa explícito quando o agente está online mas sem telemetria de dispositivos.

Validação (fim-a-fim)
1. Reiniciar o serviço local.
2. Confirmar que o polling do agente está “running”.
3. Em até 60–90s:
   - `devices.updated_at` deve avançar no backend.
   - status dos dois dispositivos deve mudar para `online` no Web.
   - no Desktop (modo local), status também deve refletir `online`.
4. Desligar temporariamente um leitor e confirmar transição para `offline` em ambos (Web/Desktop).

Detalhes técnicos (resumo por arquivo)
- `server/index.js`: auto-start do `AgentController`.
- `electron/agent.js`: persistência de `status` local por ciclo + normalização de serial no relatório.
- `electron/sync.js`: heartbeat resiliente (reload fallback + logs de envio).
- `supabase/functions/agent-sync/index.ts`: parsing/normalização robusta + métricas de aplicação de update.
- `src/components/...`: diagnóstico visual para evitar nova zona cega operacional.

Risco e compatibilidade
- Sem migração de banco.
- Sem quebra de fluxo existente de sync/enrollment.
- Mudança backward-compatible; melhora consistência entre Local Server, Web e Desktop.
