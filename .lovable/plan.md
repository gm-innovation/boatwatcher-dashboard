
Objetivo
Corrigir de forma definitiva o erro “FOREIGN KEY constraint failed” na tela “Conectar ao Sistema” do Servidor Local, sem voltar a quebrar o fluxo de vínculo por token.

Diagnóstico (com base no código atual)
- O fluxo de conexão (`electron/local-server-main.js`, handler `server:set-agent-token`) valida o token chamando primeiro `agent-sync/status` (endpoint de escrita).
- Se esse update falhar no backend por qualquer integridade referencial do agente, a conexão é bloqueada antes mesmo de baixar os dados.
- O erro exibido na UI é bruto (`result.error`) e não tem fallback.
- Além disso, há pontos no sync local (`electron/database.js`) que podem gerar falhas de FK em upserts relacionais quando um pai não existe localmente.

Plano de implementação

1) Tornar o vínculo por token resiliente (não bloquear por heartbeat)
Arquivo: `electron/local-server-main.js`
- Alterar a validação inicial do token para endpoint de leitura (`agent-sync/download-devices`) em vez de `agent-sync/status`.
- Manter `agent-sync/status` como “best effort” (não bloqueante): se falhar, logar e continuar conexão.
- Preservar retorno de erro apenas para casos reais de token inválido (401/Invalid token), não para falhas operacionais de update.

2) Auto-recuperação no backend ao atualizar status do agente
Arquivo: `supabase/functions/agent-sync/index.ts`
- No endpoint `POST /status`, implementar retry defensivo:
  - tentar update normal;
  - se vier erro de FK de `project_id`, limpar `project_id` para `null` e repetir update;
  - se vier erro de FK de `created_by`, limpar `created_by` para `null` e repetir update.
- Garantir que o endpoint retorne erro detalhado apenas se o retry também falhar.

3) Aplicar a mesma proteção no relay de agente
Arquivo: `supabase/functions/agent-relay/index.ts`
- No trecho que faz update de `local_agents` para online/last_seen, aplicar mesma estratégia de retry defensivo (evita regressão em outros fluxos de agente que também atualizam status).

4) Blindar upserts locais para não explodir por referência ausente
Arquivo: `electron/database.js`
- Em `upsertUserCompanyFromCloud`, `upsertCompanyDocumentFromCloud`, `upsertWorkerDocumentFromCloud`:
  - se entidade pai local não existir, não inserir/atualizar filho; logar warning e seguir.
- Evitar inserir `null` em colunas NOT NULL ou IDs inválidos em FK.
- Resultado esperado: sync continua, sem travar por 1 registro ruim.

5) Melhorar robustez por registro no download
Arquivo: `electron/sync.js`
- Nas etapas de download de user_companies / company_documents / worker_documents, adicionar `try/catch` por item (como já existe para workers), para um erro não abortar lote inteiro.

6) Saneamento de dados no backend (migração única)
Nova migration SQL
- Limpar referências quebradas em `local_agents`:
  - `project_id -> null` quando projeto não existir.
  - `created_by -> null` quando usuário não existir.
- Isso remove causa raiz em dados legados sem depender só de lógica de runtime.

Validação (fim-a-fim)
1. Conectar com token válido no Servidor Local (sem erro de FK na tela).
2. Confirmar que dashboard abre e baixa empresas/projetos/dispositivos.
3. Rodar sync completo e validar ausência de crash por FK em logs.
4. Testar token inválido (deve falhar com mensagem clara de token inválido).
5. Verificar que atualizações de status do agente continuam funcionando após reconnect.

Detalhes técnicos (resumo)
- Arquivos afetados:
  - `electron/local-server-main.js`
  - `electron/database.js`
  - `electron/sync.js`
  - `supabase/functions/agent-sync/index.ts`
  - `supabase/functions/agent-relay/index.ts`
  - `supabase/migrations/<nova_migration>.sql`
- Estratégia principal:
  - separar “validação de token” (read-only) de “heartbeat” (write),
  - adicionar auto-heal de referências quebradas,
  - impedir que um único registro inválido derrube o fluxo.
