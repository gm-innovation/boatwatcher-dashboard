
Objetivo: corrigir de vez o caso “entrada manual → saída facial” e impedir que, depois disso, o facial pareça travado.

Diagnóstico mais provável pelo código atual:
- O problema agora não é mais só frequência de sync; é uma combinação de reconciliação de identidade + fonte errada no dashboard.
- Há 4 pontos frágeis:
  1. `src/hooks/useSupabase.ts` ainda está cloud-first no desktop para `useWorkersOnBoard`, então a saída facial local pode não aparecer imediatamente.
  2. O cálculo de “a bordo” usa chave `worker_id || worker_name` tanto local quanto nuvem. Isso quebra justamente o fluxo manual → facial quando o manual entra com UUID do trabalhador e o facial sai sem o mesmo UUID exato.
  3. `electron/database.js#getWorkersOnBoard` filtra manual com `LIKE 'Manual - %'`, misturando qualquer terminal manual, em vez de só os pontos do projeto.
  4. `electron/sync.js` marca o lote inteiro como sincronizado sempre que a edge function responde `success`, mesmo se parte do lote tiver sido rejeitada. Isso pode fazer uma saída facial sumir silenciosamente.

Plano de correção

1. Fazer o desktop ser realmente local-first para presença
- Em `src/hooks/useSupabase.ts`, no `useWorkersOnBoard`, usar o SQLite local primeiro quando houver servidor local ativo.
- Nuvem fica como fallback, não como fonte principal no desktop.

2. Corrigir a reconciliação entre manual e facial
- Criar uma chave canônica de identidade compartilhada pelos cálculos local e cloud.
- Aplicar em:
  - `electron/database.js#getWorkersOnBoard`
  - `src/hooks/useSupabase.ts#fetchWorkersOnBoardFromCloud`
- Regra:
  - preferir `worker_document`
  - depois `worker_id`
  - depois nome normalizado
- Isso faz a saída facial cancelar corretamente uma entrada manual do mesmo trabalhador, mesmo com IDs diferentes entre os fluxos.

3. Parar de misturar terminais manuais de outros contextos
- Em `electron/database.js#getWorkersOnBoard`, trocar `LIKE 'Manual - %'` por filtro explícito:
  - `device_id` dos devices do projeto
  - ou `device_name IN (SELECT 'Manual - ' || name FROM manual_access_points WHERE project_id = ?)`
- Assim o cálculo local fica coerente com o projeto correto.

4. Blindar o upload para não perder eventos faciais
- Em `supabase/functions/agent-sync/index.ts`, devolver resultado granular por lote.
- Em `electron/sync.js`, marcar como synced apenas os logs realmente aceitos/duplicados tolerados.
- Se houver rejeição parcial, manter os rejeitados locais para retry e diagnóstico.

5. Expor diagnóstico específico do problema
- Em `server/routes/sync.js` e `src/components/admin/DiagnosticsPanel.tsx`, mostrar:
  - últimos logs locais com `source`, `worker_id`, `worker_document`, `device_name`, `direction`, `synced`
  - rejeições de upload
  - divergência de identidade entre manual e facial
- Isso confirma rapidamente se o facial capturou, mas não reconciliou, ou se nem chegou a subir.

Arquivos previstos:
- `src/hooks/useSupabase.ts`
- `electron/database.js`
- `electron/sync.js`
- `supabase/functions/agent-sync/index.ts`
- `server/routes/sync.js`
- `src/components/admin/DiagnosticsPanel.tsx`

Resultado esperado:
- `entrada manual → saída facial` passa a funcionar
- depois desse fluxo, o facial continua funcionando normalmente
- o dashboard desktop passa a refletir o estado local imediatamente
- eventos faciais rejeitados não são mais perdidos silenciosamente
