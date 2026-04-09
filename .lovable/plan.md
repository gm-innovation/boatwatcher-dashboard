
Objetivo: parar a confusão e deixar a regra única e previsível.

Diagnóstico do que existe hoje:
- Sua leitura conceitual está certa: idealmente não deveríamos “somar 3h e depois tirar 3h” sem motivo.
- Mas o código atual foi desenhado com a convenção: banco em UTC, interface em BRT.
- A UI inteira já segue essa convenção:
  - `src/utils/brt.ts` sempre converte `timestamp` do banco para BRT na tela.
  - dashboard e listas ordenam pela coluna `timestamp` do banco.
- O problema atual é que a ingestão dos leitores ficou inconsistente:
  - `electron/agent.js` hoje está somando `+3h` em `normalizeTimestamp`.
  - ao mesmo tempo, há logs recentes no banco que ainda chegaram sem essa correção.
  - resultado: parte dos eventos está em “UTC corrigido” e parte não, então a ordem cronológica fica errada.

O que isso significa na prática:
- Se o banco vai continuar sendo a fonte cronológica do sistema, então todos os logs precisam entrar no mesmo padrão.
- Hoje não estão.
- Por isso você vê um horário “parecendo certo” na tela, mas a lógica de entrada/saída quebra.

Direção recomendada:
- Manter o padrão correto da aplicação: `access_logs.timestamp` em UTC real no banco e BRT só na exibição.
- Não passar a exibir “o horário cru do dispositivo” diretamente, porque isso quebraria:
  - ordenação global
  - filtros por dia
  - relatórios/PDFs
  - comparação com logs manuais/web
  - consistência entre web, desktop e nuvem

Plano de correção:
1. Fixar uma única regra de ingestão
- Revisar `electron/agent.js` para parar de adivinhar formatos.
- Tratar o timestamp do ControlID de forma explícita e consistente.
- Escolher uma única política para todo evento de hardware e aplicá-la sempre.

2. Validar o payload real do leitor
- Inspecionar o formato exato que o ControlID manda no `lastEventPayload`.
- Confirmar se ele está vindo como hora local rotulada como UTC, ou se já está chegando no formato esperado.
- A correção final deve ser baseada no payload real, não em hipótese.

3. Centralizar a correção em um único ponto
- Evitar dupla responsabilidade entre agente, sincronização e UI.
- A correção deve existir em apenas um lugar do pipeline de hardware.
- A UI deve continuar só exibindo, sem compensações extras além do `brt.ts`.

4. Corrigir os dados já contaminados
- Ajustar somente os `access_logs` de hardware que ficaram em padrão diferente do restante.
- Não mexer nos logs manuais/web.
- O objetivo é deixar todos os eventos recentes comparáveis cronologicamente.

5. Validar ponta a ponta
- Fazer teste real com leitor de entrada e de saída.
- Conferir:
  - valor salvo no banco
  - horário exibido no dashboard
  - ordem cronológica entre entry e exit
  - presença correta em “Trabalhadores a bordo”

Detalhes técnicos:
- Arquivos envolvidos:
  - `electron/agent.js`
  - possivelmente `supabase/functions/agent-sync/index.ts`
  - correção de dados existentes em `access_logs`
- O dashboard não deve ser refeito agora; ele já assume corretamente que o banco é a fonte cronológica.
- A inconsistência está na captura/sync dos logs, não na tabela do dashboard em si.

Resultado esperado:
- todos os logs de facial entram no mesmo padrão
- o horário mostrado continua correto para o usuário
- entrada e saída passam a respeitar a ordem real
- o dashboard deixa de marcar presença errada por mistura de timestamps
