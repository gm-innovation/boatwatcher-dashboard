
Objetivo: eliminar de vez o atraso de -3h no Dashboard Desktop (mantendo Web como referência correta).

Diagnóstico confirmado (com base no código atual):
- O Web está correto porque lê direto da nuvem.
- O Desktop usa prioritariamente o caminho local (`/api/projects/:id/workers-on-board`), cuja lógica de data/hora diverge da web.
- Há risco de inconsistência local por reconciliação incompleta de logs:
  - `upsertAccessLogFromCloud` ignora registros já existentes (não corrige timestamp local antigo).
  - Isso pode manter horário “velho/errado” no SQLite mesmo com horário correto na nuvem.

Plano de implementação (curto e direto):

1) Hotfix imediato de paridade Web/Desktop
- Arquivo: `src/hooks/useSupabase.ts`
- Ajustar `useWorkersOnBoard` para usar a mesma consulta da nuvem como caminho principal quando houver conexão.
- Manter o endpoint local apenas como fallback offline.
- Resultado esperado: Desktop online passa a mostrar exatamente o mesmo horário da Web.

2) Correção estrutural do runtime local (UTC)
- Arquivo: `electron/database.js`
- Reescrever `getWorkersOnBoard` para alinhar 1:1 com a semântica da web:
  - início do dia em horário local convertido para UTC (sem `toISOString().split('T')[0]` ingênuo),
  - teto temporal de +2 min (igual web),
  - normalização única de timestamp antes de retornar `entryTime`.
- Isso remove o drift local em cenários offline.

3) Reconciliação correta dos logs baixados da nuvem
- Arquivo: `electron/database.js`
- Em `upsertAccessLogFromCloud`, quando o ID já existir:
  - atualizar campos canônicos (incluindo `timestamp`) em vez de simplesmente “return”.
- Resultado esperado: registros locais antigos/errados são autocorrigidos pelo dado canônico da nuvem.

4) Evitar divergência futura por duplicidade/identidade de log
- Arquivos:
  - `electron/sync.js` (manter `id` no payload de upload de logs),
  - `supabase/functions/agent-sync/index.ts` (upsert por `id` no upload).
- Objetivo: mesma identidade de evento ponta a ponta, evitando pares duplicados com horários diferentes.

5) Validação final (obrigatória)
- Testar entrada real no dispositivo e comparar:
  - Dashboard Web vs Desktop (mesmo trabalhador, mesma hora),
  - exportação CSV do Desktop,
  - janela próxima da meia-noite (virada de dia),
  - modo offline (fallback local ainda consistente).
- Critério de aceite: diferença máxima de 0 min entre Web e Desktop no mesmo evento.

Detalhes técnicos (resumo):
- Arquivos-alvo principais:
  - `src/hooks/useSupabase.ts`
  - `electron/database.js`
  - `electron/sync.js`
  - `supabase/functions/agent-sync/index.ts`
- Causa técnica central: divergência entre pipeline local e canônico (nuvem) no tratamento de timestamps + reconciliação incompleta do SQLite.
