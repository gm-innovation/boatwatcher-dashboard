
Diagnóstico objetivo (com base no código + dados atuais):
- O problema principal agora não é mais “falta de saída”, e sim dados corrompidos por correção de horário agressiva.
- Encontrei 4 registros em `access_logs` com `timestamp` no futuro (28–66 min à frente do `created_at`), todos no mesmo lote (`created_at = 2026-03-26 15:38:05.937582+00`).
- A lógica do dashboard usa a entrada mais recente; como existe uma entrada futura (ex.: 16:44 UTC), ela fica “sem saída posterior” e mantém pessoa a bordo indevidamente.
- Também há 1 duplicata de saída (mesmo worker/device/direction/timestamp), sinal de reenvio sem idempotência.

Plano de correção (implementação):
1) Remover a correção heurística perigosa no ingest de logs (backend function)
- Arquivo: `supabase/functions/agent-sync/index.ts`
- Ajuste:
  - Remover o `correctBrtTimestamp` baseado em “diferença de ~3h para o now”.
  - Não aplicar +3h no servidor por heurística temporal.
  - Manter apenas parse/normalização de formato (ISO), e rejeitar timestamps absurdamente no futuro (ex.: > 5 min) com log explícito de rejeição.
- Motivo: essa heurística corrige errado lotes atrasados de ~3h e gera eventos no futuro.

2) Corrigir os registros já corrompidos (migração SQL)
- Criar migração para ajustar somente anomalias seguras:
  - Caso A (supercorreção): `timestamp > created_at + 15 min` e dentro de janela plausível de erro => `timestamp - 3h`.
  - Caso B (se houver): `created_at - timestamp` entre 2h30 e 3h30 => `timestamp + 3h`.
- Escopo inicial: últimos 1–2 dias para evitar tocar histórico antigo sem necessidade.
- Resultado esperado: eliminar entradas futuras que estão “prendendo” trabalhador a bordo.

3) Blindar o dashboard contra outliers de horário
- Arquivo: `src/hooks/useSupabase.ts` (`useWorkersOnBoard`)
- Ajuste:
  - Aplicar teto temporal nas queries de entrada/saída: `timestamp <= now + 2 min`.
- Motivo: um registro futuro isolado não pode quebrar o estado “a bordo”.

4) Corrigir card de “Persistência (access_logs)” no Diagnóstico
- Arquivo: `src/components/admin/DiagnosticsPanel.tsx`
- Ajuste:
  - Buscar último log filtrado pelo projeto ativo (via devices do projeto), não global.
  - Aplicar o mesmo teto temporal (`<= now + 2 min`) para não exibir evento futuro inválido como “último”.
- Motivo: o painel hoje mascara diagnóstico ao mostrar evento global/anômalo.

5) Endurecer deduplicação (estabilização)
- Arquivos: `electron/agent.js`, `electron/sync.js`, `supabase/functions/agent-sync/index.ts` (fase de robustez)
- Ajuste recomendado:
  - Priorizar dedupe por identificador de evento (quando disponível) em vez de só timestamp.
  - Evitar duplicata por reupload (idempotência de envio).
- Motivo: já há duplicata real de saída no banco; isso vira ruído operacional.

Validação pós-implementação (obrigatória):
- Verificar SQL:
  - 0 linhas com `timestamp > created_at + 5 min` (janela recente).
  - 0 linhas com `created_at - timestamp` em ~3h (janela recente).
- Teste E2E:
  - Passar na Entrada e depois na Saída com o mesmo colaborador.
  - Confirmar sequência no banco (entry < exit), no Pipeline (Persistência) e no Dashboard (não fica a bordo após saída).
- Confirmar que novos logs entram sem correção adicional indevida e sem duplicações.
