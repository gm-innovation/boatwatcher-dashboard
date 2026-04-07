
Objetivo: sair do ciclo de tentativas e atacar a causa estrutural. A investigação mostra que o problema não está no dashboard, nem só no upload, e nem em diferença entre web e desktop.

Diagnóstico aprofundado

1. Web e desktop estão corretos ao mostrar zero
- Ambos usam a nuvem como fonte principal para “a bordo”.
- `useWorkersOnBoard` consulta a nuvem nas duas versões; no desktop o local só entra como fallback.
- Portanto, se os dois mostram 0, o problema está antes da UI.

2. A nuvem continua sem eventos de hoje
- A consulta no banco confirmou `total_today = 0`.
- Então o evento atual ainda não está chegando de forma utilizável ao backend.

3. O pipeline está vivo, mas contaminado por replay histórico
- A nuvem recebeu milhares de inserts recentes, porém com `created_at` de agora e `timestamp` antigo (2024), quase todos do dispositivo `Engenharia - Saída`.
- Muitos desses logs chegam com `worker_id` e `worker_name` nulos.
- Isso prova que o sistema está enviando massa histórica/repetida, não o fluxo operacional atual.

4. Há um indício forte de cursor inconsistente
- A telemetria do agente mostrou no `Engenharia - Entrada` um `lastEventPayload.id = 109`, mas `lastEventId = 108`.
- Ou seja: o evento atual foi capturado, mas o cursor não estava refletindo isso no mesmo estado observado.

5. Encontrei um bug estrutural no caminho de webhook/monitor
- Em `server/index.js`, a rota `/api/notifications/dao` chama `agentController.processEvent(device, rawEvent)`.
- Em `electron/agent.js`, `processEvent()` insere o log, mas não atualiza `lastEventId`.
- Hoje o cursor só é persistido com segurança no loop de polling (`pollDevice`) quando a resposta vem em array e o `maxId` é calculado.
- Resultado: eventos processados via monitor push ou fallback de evento único podem ser gravados sem avançar o cursor, abrindo espaço para replay/duplicação.

6. O full resync atual alinha cursor de apenas um dispositivo
- `fullDeviceResync(deviceId)` ajusta o cursor somente do device passado.
- Mas o replay atual vem do `Engenharia - Saída`.
- Se o resync/alinhamento foi feito em outro terminal, o segundo continua contaminando a nuvem.

7. A fila local favorece starvation durante replay
- `getUnsyncedLogs()` retorna só 100 linhas e sem `ORDER BY`.
- Em cenário de replay contínuo, isso pode manter evento novo preso atrás de ruído histórico, atrasando ou impedindo a chegada do acesso real ao backend.

Conclusão técnica
A causa raiz mais provável é a combinação de:
- cursor não persistido em todos os caminhos de captura;
- alinhamento parcial de cursores após resync;
- backlog histórico de um segundo dispositivo monopolizando a fila de upload.

Plano de correção

Fase 1 — Tornar o cursor consistente em qualquer origem de evento
Arquivos:
- `electron/agent.js`
- `server/index.js`

Implementação:
- Fazer `processEvent()` receber/usar `rawEvent.id` e persistir `lastEventId` quando houver ID válido.
- Garantir que o cursor só avance para frente, nunca para trás.
- No caminho do webhook `/api/notifications/dao`, persistir explicitamente o cursor do evento processado.
- No fallback de evento único em `pollDevice`, também atualizar cursor.

Efeito esperado:
- cada evento processado vira também avanço de cursor;
- o mesmo evento deixa de reaparecer em loops posteriores.

Fase 2 — Alinhar todos os dispositivos do agente/projeto, não só um
Arquivos:
- `electron/sync.js`
- `server/routes/sync.js`
- `src/components/admin/DiagnosticsPanel.tsx`

Implementação:
- Após `fullDeviceResync`, alinhar cursores de todos os dispositivos vinculados ao agente/projeto.
- Expor uma ação de “alinhar todos os cursores” no diagnóstico local.
- Mostrar por dispositivo: `lastEventId`, `maxEventId`, último payload capturado e atraso entre cursor e hardware.

Efeito esperado:
- o `Engenharia - Saída` deixa de continuar despejando histórico enquanto o `Entrada` já está correto.

Fase 3 — Tornar a fila de upload determinística e resistente a replay
Arquivos:
- `electron/database.js`
- `electron/sync.js`

Implementação:
- Ordenar `getUnsyncedLogs()` por `created_at ASC` (ou `rowid ASC`) para drenagem previsível.
- Exibir claramente no diagnóstico a faixa temporal real da fila.
- Após correção de cursor, limpar de forma segura backlog local obsoleto ainda não enviado, para não continuar priorizando ruído.

Efeito esperado:
- o próximo acesso real não ficará escondido atrás de lotes históricos.

Fase 4 — Confirmar ingestão atual no backend
Arquivos:
- `supabase/functions/agent-sync/index.ts`
- `src/hooks/useSupabase.ts` (somente se necessário para telemetria, não para lógica principal)

Implementação:
- Adicionar logging enxuto do lote aceito com `min/max timestamp`, device e quantidade rejeitada.
- Confirmar se algum evento atual está sendo rejeitado individualmente.
- Só mexer na query do dashboard se, depois da correção de captura/cursor, ainda houver divergência.

Efeito esperado:
- separar definitivamente problema de ingestão vs. problema de leitura.

Critérios de aceite
1. Um novo acesso no `Engenharia - Entrada` gera linha do dia atual no backend.
2. O flood de timestamps antigos do `Engenharia - Saída` para.
3. O dashboard web deixa de retornar vazio para hoje.
4. O desktop passa a exibir o mesmo trabalhador da web.
5. A telemetria mostra cursor avançando junto com o evento capturado.

Resumo executivo
- Não é bug de UI.
- Não é diferença entre web e desktop.
- Não é RLS.
- O problema central está no controle de cursor e replay histórico entre dispositivos, com o `Saída` contaminando a fila e o evento atual ficando sem chegar corretamente à nuvem.

Arquivos que eu atacaria primeiro
- `electron/agent.js`
- `server/index.js`
- `electron/sync.js`
- `electron/database.js`
- `server/routes/sync.js`
- `src/components/admin/DiagnosticsPanel.tsx`
