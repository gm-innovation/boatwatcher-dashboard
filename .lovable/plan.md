
Objetivo imediato: fazer a entrada facial voltar a refletir no dashboard agora.

Diagnóstico confirmado:
- O pipeline principal já está capturando e subindo eventos do facial.
- O agente correto está online, os devices estão vinculados ao projeto certo e o flag `align_cursors_requested` não está mais ativo.
- O evento facial novo já existe na nuvem com os campos funcionais esperados:
  - `device_id` correto
  - `direction = entry`
  - `access_status = granted`
  - `worker_id/worker_name` corretos
- O problema real está no horário do evento facial:
  - o leitor mostrou `13:59:39` local
  - a nuvem recebeu `2026-04-09 13:59:39+00`
  - isso deixa o facial 3 horas atrasado em UTC
- Como o dashboard ordena pelo `timestamp` do evento (o que está certo), ele enxerga uma saída manual posterior e conclui que o trabalhador está fora. Ou seja: o facial sobe, mas perde na lógica cronológica por causa do timestamp errado.

Plano de correção focado só nisso:

1. Corrigir a normalização de horário no agente
- Arquivo: `electron/agent.js`
- Ajustar `normalizeTimestamp` / `parseControlIdEvent` para tratar timestamps vindos do ControlID como horário local BRT da controladora, mesmo quando vierem com `Z` ou `+00:00` incorreto.
- Aplicar essa regra só no fluxo de hardware ControlID, sem mexer em logs manuais/web.

2. Confirmar o formato real do payload durante a implementação
- Validar no `lastEventPayload` qual campo o dispositivo está mandando (`time`, `timestamp`, `date`, `datetime`) e em qual formato.
- Cobrir explicitamente os formatos reais que o ControlID está emitindo hoje, em vez de depender de parse genérico.

3. Corrigir os registros já contaminados que estão bloqueando o dashboard agora
- Criar uma migration SQL para ajustar apenas os logs faciais comprovadamente afetados.
- Corrigir `timestamp = timestamp + interval '3 hours'` somente nos eventos de hardware impactados.
- Não tocar em logs manuais (`device_id is null`).
- Atualizar `updated_at` junto para garantir reconciliação e refetch corretos.

4. Não alterar o dashboard
- `src/hooks/useSupabase.ts` e os componentes do dashboard ficam como estão.
- A lógica atual está correta; ela só precisa receber o horário real do facial.

5. Validação final obrigatória
- Fazer 1 nova entrada no facial.
- Verificar em sequência:
  - o leitor reconhece
  - o evento entra na nuvem
  - `direction = entry`
  - `access_status = granted`
  - o UTC salvo corresponde ao horário local do leitor convertido corretamente
  - o novo `timestamp` fica depois da última saída real
  - o trabalhador volta a aparecer em “Trabalhadores a bordo”

Arquivos envolvidos:
- `electron/agent.js`
- `supabase/migrations/...sql`

Observação técnica:
- Existe um risco separado no endpoint local `server/routes/sync.js` em `/align-cursors`, que ainda chama `markAllLogsSynced()`. Isso é perigoso, mas não explica o problema atual do dashboard. Para manter o foco, eu não incluiria esse ajuste nesta rodada.

Resultado esperado:
- os próximos eventos faciais entram com horário UTC correto
- o evento facial deixa de ficar cronologicamente “antes” da saída manual
- o dashboard volta a refletir a entrada facial imediatamente
