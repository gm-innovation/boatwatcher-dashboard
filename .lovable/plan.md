
Objetivo imediato: focar só em fazer os eventos do leitor facial voltarem ao dashboard, sem mexer no restante.

Diagnóstico minucioso do que o código mostra:
1. O dashboard não está “quebrado” de forma genérica.
- `src/hooks/useSupabase.ts#useWorkersOnBoard` busca direto na nuvem.
- Ele só considera logs:
  - com `access_status = 'granted'`
  - pertencentes ao projeto por `device_id` do projeto, ou manual point do projeto
  - cujo estado final do trabalhador no dia seja `direction = 'entry'`
- Então, se o facial não aparece, o problema real está antes disso: o evento não está chegando na nuvem do jeito que o dashboard consegue reconhecer.

2. O funil exato para o facial é:
```text
Leitor facial
  -> electron/agent.js processEvent()
  -> SQLite access_logs local
  -> electron/sync.js uploadLogs()
  -> supabase/functions/agent-sync upload-logs
  -> tabela access_logs na nuvem
  -> useWorkersOnBoard filtra por projeto + granted + entry
  -> dashboard
```

3. O token antigo não parece mais ser a causa principal.
- O código já prioriza token do SQLite em `electron/sync.js`.
- Os logs recentes do backend mostram chamadas válidas com `fe25b788`.
- Então agora a investigação precisa sair de “autenticação” e ir para “semântica do evento”.

4. Existem 4 hipóteses fortes ainda abertas no código:
- Hipótese A: o evento facial está sendo capturado, mas sobe com `direction = 'unknown'` ou `exit`, então o dashboard ignora.
- Hipótese B: o evento sobe com `access_status != 'granted'`, então o dashboard ignora.
- Hipótese C: o evento sobe com `device_id` nulo/errado, ou com `device_id` que não pertence ao projeto selecionado, então o filtro do dashboard exclui.
- Hipótese D: o evento fica só no SQLite local porque o upload “success=true” não significa necessariamente que inseriu um log útil; hoje o sync marca tudo como sincronizado se a função responder sucesso, mesmo que `accepted/inserted` seja zero ou parcial.

5. Há um ponto crítico no agente:
- `electron/agent.js#normalizeDirection()` depende de `rawEvent.direction`, `rawEvent.passage_direction`, `rawEvent.sentido` ou fallback de `device.configuration.passage_direction`.
- Se o payload real do facial vier com outro campo, ou vier vazio, o log vai como `unknown`.
- E `useWorkersOnBoard` só monta estado a bordo quando o log final é `entry`.

6. Há um ponto crítico no upload:
- `supabase/functions/agent-sync/index.ts#upload-logs` aceita logs, normaliza, e pode:
  - anular `device_id` se formato for inválido
  - manter `direction = 'unknown'`
  - manter `access_status` diferente do esperado
- Mesmo assim a resposta geral pode voltar `success: true`.
- E `electron/sync.js#uploadLogs()` marca o lote inteiro como synced se `response.success` vier true, sem verificar se o evento realmente entrou com os campos corretos.

7. O dashboard também depende do projeto certo.
- `useWorkersOnBoard` só inclui logs cujo `device_id` esteja entre os devices de `project_id` selecionado.
- Se o leitor facial estiver vinculado ao agente, mas não ao projeto correto na nuvem, o evento pode até existir em `access_logs` e ainda assim nunca aparecer no dashboard.

Fase única agora: investigação cirúrgica e correção só do fluxo facial para dashboard

1. Validar o evento facial recém-gerado na nuvem
- Consultar os logs mais recentes em `access_logs` para o período do seu último teste.
- Conferir especificamente:
  - `device_id`
  - `device_name`
  - `direction`
  - `access_status`
  - `worker_id`
  - `worker_name`
  - `timestamp`
- Cruzar com os devices do projeto selecionado.

2. Validar o vínculo do leitor facial com o projeto
- Confirmar no backend que o leitor facial usado no teste está com:
  - `agent_id` correto
  - `project_id` correto
  - `configuration.passage_direction` coerente
- Se o `device_id` do log não cair no conjunto de devices desse projeto, o dashboard nunca vai mostrar.

3. Validar se o agente está classificando a direção corretamente
- Inspecionar `electron/agent.js#processEvent()` e o payload real salvo em `lastEventPayload`.
- Ver se o facial está chegando sem `direction/passage_direction/sentido`.
- Se estiver, ajustar só a lógica de normalização para esse formato real do ControlID, sem tocar no fluxo manual.

4. Validar se o upload está “confirmando sucesso” sem produzir log utilizável
- Revisar a resposta de `upload-logs` para comparar:
  - `received`
  - `accepted`
  - `inserted`
  - `rejected`
- Se houver sucesso parcial com evento descartado, corrigir `electron/sync.js` para não marcar como synced quando o lote não for efetivamente persistido de forma útil.

5. Corrigir apenas o ponto comprovado pela evidência
- Se o problema for direção: ajustar somente o parsing do facial.
- Se for device/project mismatch: ajustar somente o vínculo/consulta do device.
- Se for persistência parcial: ajustar somente a regra de confirmação do upload.
- Não mexer na lógica dos eventos manuais nem nos relatórios agora.

6. Teste obrigatório antes de qualquer fase seguinte
- Gerar 1 nova entrada pelo leitor facial.
- Verificar em sequência:
  - evento capturado no local
  - evento persistido na nuvem
  - `direction = entry`
  - `access_status = granted`
  - `device_id` pertencente ao projeto selecionado
  - trabalhador aparecendo no dashboard
- Só depois disso seguir para qualquer outra correção.

Arquivos mais prováveis de ajuste:
- `electron/agent.js`
- `electron/sync.js`
- `supabase/functions/agent-sync/index.ts`

Detalhe técnico importante:
Hoje a causa mais provável não é mais “token antigo”. O código aponta que o gargalo restante está na qualidade semântica do log facial que chega ao backend: direção, status, vínculo com device/projeto ou confirmação enganosa de upload.

Resultado esperado desta fase:
- o próximo evento facial entra na nuvem com os campos corretos
- ele passa no filtro de `useWorkersOnBoard`
- volta a aparecer no dashboard sem afetar o que já funciona
