
Objetivo: parar de “tentar no escuro” e corrigir a causa real com base no que o código mostra hoje.

Diagnóstico confirmado no código

1. O botão que você usou não recadastra hardware
- `Sync Completo` no servidor local chama `resetAndFullSync()`.
- Em `electron/sync.js`, isso só zera checkpoints e roda `triggerSync()`.
- Não limpa dispositivo, não remove os 9 usuários, não recadastra Alexandre.
- `Forçar Sync` também só roda sincronização de dados.
- Portanto, usar esses botões e ver tudo acontecer “em uma fração de segundo” bate exatamente com o código atual.

2. O `fullDeviceResync()` ainda está logicamente errado
- Em `electron/sync.js`, o resync manda `download-workers?since=...&offset=...`.
- Em `supabase/functions/agent-sync/index.ts`, o endpoint `download-workers` ignora `offset` e já busca todos os trabalhadores ativos internamente.
- Resultado: o loop do resync não pagina de verdade; ele repete o mesmo snapshot completo várias vezes.
- Pior: depois disso ele usa `this.db.getWorkers()` como fonte final de enrollment, então um SQLite local contaminado ainda pode “ganhar” da nuvem.

3. O espelho local continua contaminando a identidade
- `electron/database.js -> upsertWorkerFromCloud()` só reconcilia por `cloud_id` ou `id`.
- Se existir registro local antigo com mesmo `code`/documento, mas outro `id` e `cloud_id` nulo, ele sobrevive.
- `sanitizeWorkers()` hoje remove só parte dos órfãos (`cloud_id IS NULL AND synced = 0`), ou seja, sobra lixo local em vários cenários.

4. A prova de que o agente ainda está trabalhando com identidades locais erradas já apareceu nos logs
- Os logs da função mostram várias linhas como:
  `Resolved worker_id <uuid local> -> <uuid nuvem> via document`
- Isso prova que o agente ainda envia `worker_id` local não canônico em eventos.
- Se a base local estivesse realmente saneada, o evento já sairia com o UUID canônico e essa “tradução via documento” praticamente sumiria.

5. O problema dos “9 duplicados” continua no hardware
- Como `Sync Completo`/`Forçar Sync` não mexem no hardware, eles não têm como corrigir isso.
- E mesmo o `Resync Total` atual não é confiável porque monta o recadastro a partir do SQLite local depois de um download mal orquestrado.

O que isso significa na prática

```text
Nuvem correta
→ Sync normal baixa dados
→ SQLite local continua com resíduos/duplicatas
→ Resync usa base local contaminada
→ Hardware continua com 9 duplicados
→ Reconhecimento novo não gera o efeito esperado
→ Backend ainda precisa “resolver via documento”
```

Plano definitivo de correção

Fase 1 — Tornar o resync realmente autoritativo
- Reescrever `fullDeviceResync()` para usar um único snapshot canônico vindo da nuvem.
- Não usar `this.db.getWorkers()` como fonte para recadastrar hardware.
- Fluxo novo:
  1. baixar snapshot completo de trabalhadores ativos da nuvem
  2. deduplicar em memória por `cloud_id`, `document_number` e `code`
  3. validar contagem esperada
  4. só então limpar o dispositivo
  5. recadastrar o hardware a partir desse snapshot em memória

Arquivos:
- `electron/sync.js`
- `supabase/functions/agent-sync/index.ts`

Fase 2 — Reconstruir o SQLite local em vez de “tentar limpar”
- Substituir a sanitização heurística por uma reconstrução canônica da tabela `workers`.
- Regras:
  - manter somente a versão canônica por trabalhador vindo da nuvem
  - remover duplicatas por `code` mesmo se estiverem `synced = 1`
  - reconciliar por `cloud_id`, e quando necessário por `document_number`
  - registrar relatório claro do que foi removido/unificado
- Se houver referências locais dependentes, preservar ou remapear corretamente.

Arquivos:
- `electron/database.js`
- `electron/sync.js`

Fase 3 — Corrigir o diagnóstico operacional para não enganar mais
- Adicionar um endpoint de diagnóstico profundo no servidor local mostrando:
  - total de trabalhadores na nuvem
  - total local no SQLite
  - duplicados por `code`
  - quantos têm `cloud_id`
  - quantos usuários existem fisicamente no dispositivo
  - último `lastEventId`
  - últimos eventos capturados
  - `reverse_sync_paused`
  - último erro de upload
- Corrigir a listagem de usuários do dispositivo para usar a mesma leitura confiável do resync, não a rota atual ambígua.

Arquivos:
- `server/routes/sync.js`
- `server/routes/devices.js`
- possivelmente `server/lib/controlid.js`

Fase 4 — Remover a ambiguidade da UI
- Renomear e separar claramente as ações:
  - `Forçar Sync (base local)`
  - `Sync Completo (base local)`
  - `Resync Total do Dispositivo (hardware)`
- Exibir aviso explícito: os dois primeiros não alteram usuários do Control iD.
- Exibir relatório pós-resync com:
  - baixados da nuvem
  - canônicos após dedup
  - usuários no dispositivo antes
  - usuários no dispositivo depois
  - falhas por trabalhador

Arquivos:
- `electron/server-ui.html`
- `src/components/devices/DeviceManagement.tsx`
- `src/lib/localServerProvider.ts`

Fase 5 — Fechar o ciclo de identidade dos eventos
- Depois da reconstrução local, o agente deve resolver `code -> worker` sempre para o registro canônico.
- Critério forte de validação:
  - os logs da função não devem mais ficar mostrando repetidamente `Resolved worker_id <uuid local> -> <uuid nuvem> via document` para trabalhadores normais.
- Se isso continuar, ainda existe base local poluída ou lookup incorreto.

Arquivos:
- `electron/agent.js`
- `electron/database.js`
- `supabase/functions/agent-sync/index.ts`

Fase 6 — Só depois tratar histórico contaminado, se ainda necessário
- Primeiro estabilizar hardware + SQLite + captura.
- Depois revisar e corrigir logs históricos específicos, se o Alexandre/Gustavo ainda tiverem rastros antigos afetando telas.

Detalhes técnicos importantes
- O erro principal agora não é “a nuvem está errada”.
- O erro principal é:
  1. ação errada sendo usada para expectativa de hardware
  2. `fullDeviceResync()` montado sobre uma fonte local contaminável
  3. reconciliação fraca do SQLite
- O ponto mais importante da investigação é este:
  o resync precisa passar a usar um snapshot canônico em memória vindo da nuvem, e não a tabela local como verdade final.

Critérios de aceite
1. `Sync Completo` e `Forçar Sync` ficam claramente identificados como sync de base local apenas.
2. `Resync Total do Dispositivo` demora o tempo esperado e mostra números reais.
3. O relatório do resync precisa mostrar algo próximo de 2.531 trabalhadores canônicos, não 9.
4. O dispositivo e a plataforma do Control iD precisam voltar a listar a base completa, sem duplicações.
5. Um novo acesso do Alexandre precisa gerar evento normalmente.
6. Os logs não podem mais depender de “resolver worker_id via document” para casos normais.

Ordem recomendada
1. corrigir `fullDeviceResync()` para snapshot autoritativo da nuvem
2. reconstruir a tabela local `workers`
3. criar diagnóstico profundo
4. corrigir UI/nomes das ações
5. executar novo resync real de hardware
6. validar captura de um acesso novo do Alexandre
7. só então revisar histórico legado se ainda restar sujeira
