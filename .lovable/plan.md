
Objetivo

Resolver definitivamente o problema em 3 camadas: identificação no agente local, sincronização do espelho local e cálculo do dashboard “a bordo”.

Conclusão da investigação aprofundada

O problema atual não é único. Hoje existem 3 falhas encadeadas, e por isso “corrigir só o resync” não resolveu.

1. Resolução errada no agente local
- `electron/agent.js` resolve o `user_id` numérico do dispositivo com:
  - `SELECT id, name, document_number FROM workers WHERE code = ?`
- Se o SQLite local tiver mais de um trabalhador com o mesmo `code`, a escolha vira arbitrária.
- Como o lookup é local, a nuvem pode estar correta e mesmo assim o evento ser atribuído ao trabalhador errado antes do upload.

2. O espelho local pode continuar contaminado mesmo após download da nuvem
- `electron/database.js` faz `upsertWorkerFromCloud`, mas não saneia/remueve registros locais antigos ou órfãos antes do uso.
- `electron/sync.js -> fullDeviceResync()` usa `this.db.getWorkers()` como base final para recadastro.
- Então, se o banco local já tiver duplicidades ou linhas antigas, o resync pode reenviar essa base contaminada para o hardware.
- Observação importante: o loop atual de `fullDeviceResync()` ainda está inconsistente porque manda `offset`, mas `agent-sync/download-workers` não usa esse parâmetro. Isso gera retrabalho, mas não explica sozinho o “Gustavo desde 31/03”.

3. O dashboard “a bordo” usa identidade instável e cronologia errada
- `src/hooks/useSupabase.ts` e `electron/database.js` montam o estado usando:
  - chave `worker_name || worker_id`
  - ordem por `created_at`
- Isso é perigoso por dois motivos:
  1. um log antigo com nome errado (“Gustavo”) cria uma sessão fantasma que não é cancelada por uma saída posterior do Alexandre
  2. um evento antigo sincronizado depois pode virar o “último estado” só porque chegou mais tarde
- A tela mostrando “Gustavo” com entrada em `31/03 10:26` combina exatamente com esse bug: uma presença antiga/errada ficou carregada no carry-over.

4. O contrato de horário ainda está inconsistente
- `electron/agent.js` já converte timestamp sem timezone para UTC (+3h).
- `supabase/functions/agent-sync/index.ts` ainda possui uma autocorreção heurística de +3h.
- Isso mantém risco de hora deslocada em instalações legadas, filas atrasadas ou dados mistos.

O que essa investigação confirma
- A nuvem não é mais o principal problema.
- O hardware sozinho não explica o dashboard errado.
- O erro persiste porque o evento pode nascer errado no agente local e depois o dashboard ainda consolida esse erro da pior forma possível.

Fluxo problemático atual
```text
Dispositivo -> agente local resolve code no SQLite local
           -> grava access_log com nome/id possivelmente errados
           -> sync envia para nuvem
           -> dashboard agrupa por worker_name e ordena por created_at
           -> presença fantasma permanece “a bordo” com data antiga
```

Plano de correção definitivo

1. Sanear o banco local antes de qualquer novo resync
- Em `electron/database.js` e `electron/sync.js`, criar uma rotina de reconstrução canônica do espelho local:
  - remover ou arquivar trabalhadores locais que não existem mais na nuvem
  - deduplicar por `code`
  - priorizar registros com `cloud_id` e `synced = 1`
- Se ainda houver duplicidade por `code`, abortar resync com diagnóstico explícito.

2. Tornar o lookup por código determinístico
- Em `electron/agent.js`, substituir o lookup cru por seleção canônica:
  - preferir `cloud_id IS NOT NULL`
  - preferir `synced = 1`
  - preferir registro mais recente
- Se existir conflito por `code`, registrar erro operacional em vez de seguir silenciosamente.

3. Corrigir o cálculo de “a bordo”
- Em `src/hooks/useSupabase.ts` e `electron/database.js`:
  - usar chave estável: `worker_id || worker_document || normalizedName(worker_name)`
  - ordenar a máquina de estado por `timestamp ASC`
  - usar `created_at` apenas como desempate, não como cronologia principal
  - quando houver `worker_id`, exibir sempre o trabalhador canônico por ID
- Isso remove o efeito “Gustavo ficou aberto para sempre”.

4. Unificar a política de horário
- Manter a normalização principal apenas no agente local.
- Remover ou restringir a autocorreção heurística em `supabase/functions/agent-sync/index.ts`.
- Padronizar todo o fluxo para tratar timestamp como UTC canônico.

5. Blindar o full-resync
- Em `electron/sync.js`, usar somente a base local saneada/canônica para recadastro.
- Não depender do conjunto bruto retornado por `getWorkers()`.
- Validar antes de limpar o dispositivo:
  - quantidade esperada
  - ausência de conflitos por `code`
  - ausência de trabalhadores locais órfãos

6. Criar diagnóstico operacional antes da próxima tentativa
- Expor no servidor local um diagnóstico com:
  - códigos duplicados no SQLite
  - trabalhadores sem `cloud_id`
  - conflitos por `code`
  - sessões “a bordo” abertas há dias
  - quantidade real de usuários cadastrados por dispositivo
- Isso evita outra tentativa às cegas.

7. Corrigir os dados já contaminados
- Depois da lógica corrigida:
  - identificar os logs que sustentam a sessão fantasma Gustavo/Alexandre
  - corrigir `worker_id` e `worker_name` dos registros afetados
  - reprocessar o board com a nova lógica
- Se necessário, aplicar uma correção dirigida no backend para o período afetado.

Arquivos principais
- `electron/agent.js`
- `electron/database.js`
- `electron/sync.js`
- `src/hooks/useSupabase.ts`
- `supabase/functions/agent-sync/index.ts`
- opcional para diagnóstico: `server/routes/sync.js` ou `server/routes/devices.js`

Critérios de validação
1. O SQLite local não pode mais ter duplicidade por `code`.
2. O lookup do código do Alexandre deve apontar sempre para o mesmo registro canônico.
3. O dashboard não pode mais manter “Gustavo” aberto quando o evento correto é do Alexandre.
4. A data/hora exibidas devem refletir o `timestamp` real do acesso.
5. O full-resync deve recadastrar somente a base canônica saneada.
6. Um novo acesso/saída do Alexandre deve aparecer como Alexandre, com horário correto, no dispositivo e no dashboard.

Sequência recomendada
1. diagnóstico local
2. saneamento do SQLite
3. correção do lookup por `code`
4. correção da lógica do board
5. unificação de timestamps
6. novo full-resync
7. correção dirigida dos logs históricos contaminados
