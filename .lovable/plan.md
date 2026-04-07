
Diagnóstico confirmado

- Você tem razão: do jeito que o código está hoje, esse botão efetivamente “não existe” na prática para boa parte dos cenários.
- Eu confirmei no código que o texto `Alinhar Todos os Cursores` está em `src/components/admin/DiagnosticsPanel.tsx`, mas ele fica escondido por 2 condições ao mesmo tempo:
  1. só renderiza se `isLocalRuntime` for `true`;
  2. e ainda fica dentro do bloco `deviceTelemetry?.agent?.devices`, então se a telemetria não vier, o botão inteiro some.
- Na web ele nunca aparece, porque está preso ao runtime local.
- No desktop ele também pode não aparecer, mesmo com servidor local, se a telemetria do agente não estiver carregada.

O que corrigir

1. Tornar a ação visível de forma estável
- Tirar o botão de dentro do card de telemetria dos dispositivos.
- Colocar a ação em uma área própria do painel de diagnóstico, sempre visível quando fizer sentido operacionalmente.

2. Padronizar o acesso via provider
- Criar um método próprio no provider local para essa ação, em vez de usar `fetch('http://localhost:3001/...')` direto dentro do componente.
- Isso mantém o padrão já usado no restante do app para `/api/sync/*`.

3. Corrigir a lógica por ambiente
- Desktop com servidor local: botão ativo e chamando o endpoint local `/api/sync/align-cursors`.
- Web e desktop em fallback: não esconder a ação silenciosamente.
  - Opção recomendada: mostrar o botão desabilitado com mensagem clara explicando que o alinhamento depende do servidor local/agente conectado.
  - Se quisermos suportar acionamento remoto via web, aí precisa implementar um fluxo separado por sinalização em nuvem.

4. Melhorar feedback visual
- Exibir estados explícitos:
  - “Disponível no desktop com servidor local”
  - “Servidor local indisponível”
  - “Telemetria ausente, mas ação disponível”
  - resultado do alinhamento com total de dispositivos e logs limpos

5. Evitar nova confusão
- Ajustar o texto do painel para não sugerir que o botão está disponível apenas quando a telemetria aparece.
- Garantir que a ação não dependa de `deviceTelemetry` para existir.

Arquivos envolvidos

- `src/components/admin/DiagnosticsPanel.tsx`
  - mover o botão para fora do bloco de telemetria
  - renderizar conforme runtime
  - adicionar estado/explicação visual
- `src/lib/localServerProvider.ts`
  - criar método `localSync.alignCursors()`
- opcional, se quisermos suporte remoto real pela web:
  - `electron/sync.js`
  - possivelmente leitura/escrita em `local_agents.configuration`

Abordagem recomendada

Fase 1 — corrigir já o problema de visibilidade
- Mostrar a ação em local fixo no painel.
- No desktop local: ativa.
- Na web/fallback: visível, porém desabilitada com explicação.

Fase 2 — se você quiser uso remoto pela web
- Implementar uma “solicitação de alinhamento” enviada ao agente via nuvem.
- O agente lê essa solicitação no ciclo de sync e executa o alinhamento localmente.
- Aí sim o botão funcionará também na web, não apenas aparecerá.

Resultado esperado

- O botão deixa de ficar “fantasma”.
- No desktop com servidor local ele aparece sempre, independentemente da telemetria.
- Na web o sistema deixa claro por que a ação não roda localmente, ou passa a rodar remotamente se implementarmos a fase 2.
