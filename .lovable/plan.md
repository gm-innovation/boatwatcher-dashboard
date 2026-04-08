
Objetivo: parar de “remendar” pontos isolados e restaurar um comportamento único e estável para entrada/saída manual + facial e relatórios WebView/PDF com o mesmo conjunto de dados e o mesmo horário.

Diagnóstico real após revisão do código:
1. O sistema hoje mistura dois modelos de tempo ao mesmo tempo:
   - `electron/agent.js` e funções cloud convertem timestamps para UTC.
   - `electron/database.js` e alguns comentários/tratamentos ainda assumem “wall-clock time”.
   - relatórios e PDFs usam `new Date(...)` diretamente em vários pontos.
   Resultado: desvio de horário e filtros inconsistentes.
2. A fonte de dados também está fragmentada:
   - relatórios usam `useAccessLogs` → `fetchAccessLogs`
   - “a bordo” usa outro caminho (`useWorkersOnBoard`)
   - manual e facial são combinados por regras diferentes entre SQLite e nuvem
   Resultado: WebView/PDF/dashboard podem discordar entre si.
3. O fluxo facial está frágil em dois pontos:
   - captura local depende de `load_objects.fcgi` + normalização/local lookup do `worker.code`
   - enrollment existe, mas qualquer inconsistência entre `code`, `allowed_project_ids`, device binding ou resolução local quebra o reconhecimento
   Resultado: manual funciona, facial não.

Do I know what the issue is?
Sim. O problema principal não é “um bug só”; é a combinação de:
- semântica de timestamp inconsistente
- consultas de acesso divergentes entre áreas
- pipeline facial dependente de resolução local frágil

Plano de correção segura

1. Congelar a semântica canônica de tempo
- Adotar explicitamente: banco guarda UTC canônico, UI apenas formata.
- Revisar e alinhar estes pontos para a mesma regra:
  - `electron/agent.js`
  - `supabase/functions/api/index.ts`
  - `supabase/functions/controlid-webhook/index.ts`
  - `supabase/functions/agent-sync/index.ts`
  - `electron/database.js`
- Remover suposições conflitantes como “timestamps are stored as wall-clock time”.
- Substituir parsing ambíguo em relatórios/PDFs por parsing explícito e utilitário compartilhado.

2. Criar uma camada única de normalização/consulta de access logs
- Extrair uma regra canônica para:
  - logs faciais do projeto por `device_id`
  - logs manuais do projeto por `manual_access_points`
  - filtro de intervalo por data
  - ordenação por timestamp real
- Aplicar a mesma regra em:
  - `electron/database.js#getAccessLogs`
  - `src/hooks/useDataProvider.ts#fetchAccessLogs`
  - `src/hooks/useSupabase.ts#fetchWorkersOnBoardFromCloud`
  - `electron/database.js#getWorkersOnBoard`
- Eliminar discrepâncias entre WebView, PDF e dashboard.

3. Restaurar o pipeline facial sem quebrar o manual
- Revisar a cadeia completa de enrollment/captura:
  - `src/components/workers/WorkerManagement.tsx`
  - `server/routes/workers.js`
  - `server/lib/controlid.js`
  - `electron/sync.js`
  - `electron/agent.js`
- Garantir que o enrollment use sempre o `worker.code` correto e dispositivos resolvidos pelos projetos autorizados.
- Endurecer a resolução do trabalhador no agente/local:
  - lookup determinístico por `code`
  - logs defensivos quando o evento vier sem `user_id` ou sem match local
  - não degradar eventos válidos para “desconhecido” silenciosamente
- Preservar manual intacto enquanto a correção facial é feita.

4. Unificar relatórios e PDFs no mesmo parsing de data
- Atualizar componentes/utilitários que hoje usam `new Date(...)` de forma direta:
  - `src/components/reports/WorkerTimeReport.tsx`
  - `src/components/reports/CompanyReport.tsx`
  - `src/components/reports/PresenceReport.tsx`
  - `src/components/reports/OvernightControl.tsx`
  - `src/utils/exportReportPdf.ts`
  - `src/utils/exportWorkerReportPdf.ts`
- Criar um utilitário compartilhado para:
  - parse seguro de timestamp
  - formatação consistente
  - cálculo de entrada/saída/permanência

5. Proteger contra novas regressões
- Adicionar validações defensivas para:
  - logs faciais sem worker resolvido
  - duplicidade cloud/local
  - filtros de período inconsistentes
  - manual/facial fora do projeto
- Não alterar o fluxo manual além do necessário.
- Manter compatibilidade online/offline com a mesma semântica.

Arquivos principais a alterar
- `electron/agent.js`
- `electron/database.js`
- `electron/sync.js`
- `server/lib/controlid.js`
- `server/routes/workers.js`
- `src/hooks/useDataProvider.ts`
- `src/hooks/useSupabase.ts`
- `src/components/reports/WorkerTimeReport.tsx`
- `src/components/reports/CompanyReport.tsx`
- `src/components/reports/PresenceReport.tsx`
- `src/components/reports/OvernightControl.tsx`
- `src/utils/exportReportPdf.ts`
- `src/utils/exportWorkerReportPdf.ts`
- `supabase/functions/api/index.ts`
- `supabase/functions/controlid-webhook/index.ts`
- `supabase/functions/agent-sync/index.ts`

Resultado esperado
- entrada/saída manual continuam funcionando
- entrada/saída facial voltam a funcionar
- WebView e PDF passam a mostrar manual + facial juntos
- horários deixam de aparecer com -3h
- desktop online/offline e nuvem passam a refletir a mesma regra de dados

Estratégia de implementação
1. corrigir semântica de timestamp
2. unificar consulta manual + facial
3. reforçar pipeline facial/enrollment
4. alinhar relatórios e PDFs
5. validar ponta a ponta sem mexer em mais nada fora dessa trilha
