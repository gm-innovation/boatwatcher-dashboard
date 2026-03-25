
Objetivo: eliminar de vez o erro de re-sincronização biométrica (`UNIQUE constraint failed: users.id`) e garantir autorização após reconhecimento.

Diagnóstico confirmado:
- O fluxo Web está enfileirando comandos corretamente.
- Os comandos no backend estão falhando no agente local com `"[phase=create_objects.fcgi] ... users.id"`.
- Isso indica que o executor local ainda está tratando “usuário já existe” como falha em pelo menos um caminho de enrollment.
- Do I know what the issue is? **Sim**: o enrollment local não está 100% idempotente em runtime (ou o binário ativo não está usando a versão corrigida), então o passo de criação do usuário aborta antes de consolidar regra de acesso/foto.

Plano de implementação:
1) Tornar criação de usuário realmente idempotente no executor local
- Em `server/lib/controlid.js`, trocar o passo de criação de `users` para `create_or_modify_objects.fcgi` (upsert nativo do Control iD), evitando erro de UNIQUE.
- Manter fallback compatível: se `create_or_modify_objects` não existir no firmware, usar `create_objects` com tolerância a duplicidade sem depender de token exato (`users.id`).

2) Blindar vínculo de regra de acesso
- Ainda em `server/lib/controlid.js`, manter/fortalecer o passo de `user_access_rules` com comportamento idempotente.
- Preservar `device.configuration.access_rule_id` e fallback para `1`.
- Se a API do dispositivo suportar upsert para o objeto, usar upsert; senão ignorar duplicidade com parser robusto.

3) Alinhar caminho alternativo de hardware
- Aplicar a mesma estratégia idempotente em `supabase/functions/controlid-api/index.ts` (fluxo direto), para não existir diferença entre caminhos de execução.

4) Adicionar prova de versão em runtime (evitar falso “atualizado”)
- Incluir um identificador de revisão do enrollment (ex.: `enrollment_revision`) no health/status do servidor local e no resultado do comando processado.
- Assim fica visível no painel qual revisão do código realmente executou o comando que falhou.

5) Melhorar feedback do modal de re-sincronização
- Em `src/components/workers/WorkerManagement.tsx`, ajustar o estado final:
  - Se houver falhas: “Finalizado com falhas” (ícone de alerta), não check verde.
  - Mostrar resumo: `sucesso X/Y`, `falha Z`, e revisão do executor quando disponível.

6) Validação ponta a ponta
- Re-sincronizar o mesmo trabalhador já existente em 2 dispositivos.
- Esperado: sem falha por `users.id`; comandos “completed”.
- Validar no equipamento: reconhecimento + acesso autorizado.
- Repetir nova re-sincronização para confirmar idempotência (não deve quebrar no segundo envio).

Detalhes técnicos (arquivos):
- `server/lib/controlid.js` (correção principal do executor local)
- `supabase/functions/controlid-api/index.ts` (paridade de comportamento)
- `electron/sync.js` e/ou rota de status local (exposição de revisão em runtime)
- `src/components/workers/WorkerManagement.tsx` (status final correto no tracker)
