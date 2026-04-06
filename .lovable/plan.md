
Objetivo: fazer uma investigação corretiva, com base no código e nos dados reais, para ter certeza da causa raiz. A conclusão é que o problema não está mais no dashboard nem na leitura facial em si; ele está no fluxo de sincronização local e no jeito como o “full resync” foi implementado e acionado.

1. Conclusão da investigação
- A nuvem está correta hoje:
  - existem 2.531 trabalhadores ativos e 2.531 códigos distintos.
  - Alexandre Silva está com código 350.
  - os logs recentes já aparecem como Alexandre Silva, inclusive as saídas.
- O problema persiste no ambiente local/dispositivo:
  - o resync completo atual baixa trabalhadores da nuvem de forma incorreta.
  - o botão “Sync Completo” do servidor local não executa o “full device resync”; ele só reseta checkpoints e roda um sync normal.
  - o sync normal faz auto-enrollment durante o download e pode reenviar um conjunto parcial/sujo para o dispositivo.
  - por isso o dispositivo ficou com poucos usuários e duplicações.

2. Causa raiz confirmada
Há 3 falhas concretas no código atual:

- Falha A: paginação quebrada no fullDeviceResync
  - Em `electron/sync.js`, o método `fullDeviceResync()` reseta `last_download_workers` para epoch, mas depois de cada página salva `last_download_workers = now()`.
  - Como o endpoint `agent-sync/download-workers?since=...` filtra por `updated_at >= since`, a próxima chamada passa a buscar “a partir de agora”, pulando quase toda a base.
  - Resultado prático: em vez de baixar 2.531 trabalhadores, ele tende a pegar só a primeira leva e depois parar.

- Falha B: o botão “Sync Completo” não limpa nem recadastra os dispositivos
  - Em `electron/server-ui.html`, o botão chama `window.serverAPI.resetAndFullSync()`.
  - Isso vai para `resetAndFullSync()` em `electron/sync.js`, que apenas reseta checkpoints e roda `triggerSync()`.
  - Ou seja: ele não chama `POST /api/devices/:id/full-resync` e não executa `fullDeviceResync(deviceId)`.
  - Então o operador acha que fez uma limpeza total do dispositivo, mas na prática só rodou um sync geral.

- Falha C: auto-enrollment durante download pode repovoar o hardware com base incompleta
  - Em `downloadUpdates()`, cada trabalhador baixado chama `autoEnrollWorkerPhoto(worker)`.
  - Se o download estiver parcial ou sujo, o sistema já vai cadastrando esse subconjunto no dispositivo.
  - Isso explica o cenário de poucos usuários cadastrados e duplicações observadas no hardware.

3. Evidências objetivas encontradas
- `supabase/functions/agent-sync/index.ts`
  - `download-workers` retorna todos os ativos, com paginação correta no backend.
  - Portanto a nuvem não é o gargalo.
- `electron/sync.js`
  - `fullDeviceResync()` usa `since = last_download_workers` e depois grava `last_download_workers = now()` dentro do loop, quebrando a paginação.
  - `downloadUpdates()` também faz auto-enrollment no mesmo momento em que baixa os trabalhadores.
- `electron/server-ui.html`
  - “Sync Completo” chama `resetAndFullSync()`, não o resync do dispositivo.
- `src/lib/localServerProvider.ts`
  - não existe método exposto para disparar `POST /api/devices/:id/full-resync` pela interface.
- Dados reais no banco:
  - Alexandre Silva já aparece com saídas recentes atribuídas corretamente.
  - total ativo = 2531, distinct codes = 2531.
  - isso reforça que o erro restante está no ambiente local/hardware, não no banco principal.

4. O que vou implementar
- Corrigir `fullDeviceResync()` para baixar a base completa de forma confiável
  - sem avançar checkpoint para “agora” dentro do loop.
  - usar cursor determinístico da própria resposta ou um full-download único controlado.
- Separar “sync de dados” de “resync de hardware”
  - `resetAndFullSync()` continuará sendo sync de banco/local.
  - criarei um fluxo explícito para “Limpar e recadastrar dispositivo”.
- Impedir auto-enrollment durante full refresh de trabalhadores
  - adicionar um modo/flag para baixar tudo sem provisionar no hardware no meio do processo.
- Expor ação real de resync completo por dispositivo
  - no servidor local e na UI de dispositivos.
- Melhorar diagnósticos
  - retornar no resync: total baixado, total ativo, total único por code, total enviado ao dispositivo, falhas.
  - mostrar mensagem clara se a base local vier parcial.
- Blindar reverse sync durante recuperação
  - manter a pausa e garantir que ela cubra também o fluxo de recuperação disparado pelo servidor local.

5. Resultado esperado após a correção
Fluxo correto:
```text
1. baixar 2.531 trabalhadores completos da nuvem
2. validar quantidade mínima
3. deduplicar por code
4. limpar o dispositivo
5. recadastrar todos os trabalhadores corretos
6. Alexandre voltar a existir apenas com o código 350 no hardware
7. Gustavo deixar de herdar eventos do Alexandre
```

6. Arquivos que precisam ser ajustados
- `electron/sync.js`
  - corrigir paginação e checkpoint do fullDeviceResync
  - bloquear auto-enrollment durante full refresh
  - alinhar pausa do reverse sync
- `electron/server-ui.html`
  - trocar o botão atual ou adicionar um botão explícito para resync real de dispositivo
- `electron/server-preload.js`
  - expor chamada para full resync por dispositivo
- `src/lib/localServerProvider.ts`
  - adicionar método local para chamar `/api/devices/:id/full-resync`
- `src/components/devices/DeviceManagement.tsx`
  - adicionar ação de “Re-sincronização total” por dispositivo com feedback detalhado

7. Validação que farei depois da implementação
- confirmar que o resync informa ~2.531 trabalhadores, não 9
- confirmar que o dispositivo deixa de listar duplicados
- confirmar que Alexandre aparece só uma vez, com código 350
- confirmar que uma nova saída do Alexandre entra como Alexandre no fluxo completo
- confirmar que o botão usado pelo operador dispara o fluxo correto de hardware, não apenas um sync de banco

8. Nota importante
O diff de versão `server/package.json` (1.3.17 → 1.3.18) não é a causa do problema funcional. O problema real é de lógica/fluxo: o operador está disparando uma ação que não faz o resync de hardware esperado, e o resync existente está paginando errado.

Se aprovado, o próximo passo é implementar essa correção estrutural e deixar um caminho único e seguro para recuperar os dispositivos sem recontaminar a base.
