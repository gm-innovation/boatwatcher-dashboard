
Objetivo: parar de perseguir sintomas e corrigir o ponto exato onde o evento de hoje está se perdendo.

Diagnóstico aprofundado confirmado

1. O problema não está no dashboard
- A consulta do dashboard está correta.
- No web, a requisição de hoje para `access_logs` usa `timestamp >= 2026-04-07T03:00:00.000Z` e voltou `[]`.
- No desktop, o dashboard também é cloud-first para “a bordo”, então ele herda o mesmo vazio.
- Conclusão: web e desktop mostram 0 porque a nuvem realmente não tem eventos de hoje para esse projeto.

2. O erro 401 anterior foi resolvido
- O token do agente está válido.
- A função `agent-sync/upload-logs` está recebendo token e processando lote com sucesso.
- Há log explícito de sucesso:
```text
Agent ...: received=100 accepted=100 rejected=0
```
- Então o problema atual não é mais autenticação.

3. O que está chegando à nuvem são eventos antigos, não os eventos atuais
- As linhas mais recentes do banco continuam com timestamps antigos/históricos.
- A própria consulta do banco mostrou `since_brt_midnight = 0`.
- Os eventos visíveis pertencem a datas como 2024-10 e 2026-03, não ao acesso atual de 07/04.
- Isso bate com os logs da função, que seguem resolvendo vários `worker_id` antigos “via document”.

4. Não é filtro de projeto
- Os dispositivos `Engenharia - Entrada` e `Engenharia - Saída` estão vinculados ao projeto `Skandi Botafogo`.
- Os logs existentes também apontam para esse mesmo projeto.
- Então a hipótese de “evento foi para outro projeto” não se sustenta.

Causa raiz mais provável

O pipeline local está vivo, mas não chegou no evento atual do hardware.

Hoje o cenário mais consistente com os dados é este:

```text
Hardware tem evento novo de hoje
→ agente local está uploadando lote(s)
→ esses lotes são backlog histórico / reprocessamento
→ a nuvem ainda não recebeu o evento de hoje
→ consulta “hoje” retorna vazio
→ web e desktop mostram 0
```

Ou seja: o gargalo agora está no cursor/backlog do agente local, não na UI e não no upload autenticado.

Pontos técnicos que sustentam isso
- `electron/agent.js` usa cursor por `lastEventId`.
- `fullDeviceResync()` reconstrói trabalhadores e recadastra hardware, mas não mostra uma estratégia explícita para reposicionar o cursor de eventos no “ponto atual” do buffer do dispositivo.
- Se o cursor foi resetado ou ficou desalinhado, o agente pode estar drenando histórico antigo antes de alcançar o evento novo.
- Como o dashboard filtra “hoje”, qualquer replay antigo continua deixando a tela zerada.

Plano de correção

Fase 1 — Diagnóstico definitivo do cursor e da fila local
Adicionar telemetria para provar exatamente o que está sendo enviado:
- `lastEventId` atual por dispositivo
- `maxEventId` atual no hardware
- quantidade de logs locais não sincronizados
- `timestamp` mínimo e máximo desses logs locais pendentes
- amostra dos últimos logs locais capturados
- primeiro e último `id/timestamp` do lote enviado em `uploadLogs()`

Arquivos:
- `electron/agent.js`
- `electron/sync.js`
- `electron/database.js`
- `server/routes/sync.js`

Fase 2 — Corrigir a estratégia de recuperação após resync
Ao concluir `Resync Total`, o sistema deve parar de reimportar backlog antigo do hardware.
Implementação proposta:
- ler o `maxEventId` do dispositivo no fim do resync
- gravar esse valor como novo cursor canônico
- opcionalmente permitir apenas um backfill curto e controlado (ex.: últimos minutos), não histórico inteiro

Isso evita que o agente fique “preso no passado” antes de chegar aos eventos atuais.

Arquivos:
- `electron/agent.js`
- `electron/sync.js`

Fase 3 — Higienizar backlog local obsoleto
Se existirem logs locais pendentes muito antigos, eles precisam ser tratados para não mascarar o estado atual:
- diagnosticar se os mesmos 100 logs estão sendo reenviados repetidamente
- identificar se `markLogsSynced()` está persistindo corretamente no SQLite em uso
- se necessário, criar rotina segura para arquivar/descartar backlog antigo fora da janela operacional

Arquivos:
- `electron/database.js`
- `electron/sync.js`

Fase 4 — Expor status operacional claro
Mostrar no painel local/admin:
- último evento capturado no hardware
- último evento enviado com sucesso
- evento mais antigo pendente
- cursor atual vs max cursor do dispositivo
- indicador “replay histórico em andamento” quando aplicável

Arquivos:
- `server/routes/sync.js`
- `src/components/admin/DiagnosticsPanel.tsx`
- possivelmente `src/lib/localServerProvider.ts`

Critérios de aceite

1. O diagnóstico mostra claramente que o cursor local está alinhado ao ponto atual do hardware.
2. Após um novo acesso real no dispositivo, surge uma linha nova na nuvem com timestamp do dia atual.
3. A requisição web de “hoje” para `access_logs` deixa de retornar `[]`.
4. Web e desktop passam a exibir o mesmo trabalhador a bordo.
5. O sistema deixa de ficar drenando eventos antigos como se fossem novidade operacional.

Resumo executivo
- O problema atual não é mais 401.
- O problema atual não é o dashboard.
- O problema atual não é filtro de projeto.
- O problema atual está no fluxo de recuperação/cursor do agente local: ele está processando backlog antigo e ainda não alcançou o evento atual que deveria alimentar as telas.
