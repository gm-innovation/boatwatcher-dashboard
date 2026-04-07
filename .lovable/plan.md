
Correção do diagnóstico anterior

Você está certo: o problema não é visibilidade do botão. O botão existe, renderiza e o clique está disparando.

Do I know what the issue is?

Sim, agora o problema está claro no código:

1. O botão chama `localSync.alignCursors()` em `src/components/admin/DiagnosticsPanel.tsx`.
2. Esse método faz `POST /api/sync/align-cursors` em `src/lib/localServerProvider.ts`.
3. A rota existe no código atual em `server/routes/sync.js` e está montada em `server/index.js`.
4. Portanto, receber `Not Found` ao clicar significa que a requisição não está chegando no backend HTTP que corresponde a este código atual.

Problema exato

Há um desencontro entre o que a UI mostra e o servidor HTTP real atendendo a porta configurada:

- o texto “Versão atual: v1.3.53” da janela do local server vem de `app.getVersion()` em `electron/local-server-main.js` via `electron/server-ui.html`;
- isso mostra a versão do app-shell do servidor local, não prova que a API Express ativa em `localhost:3001` é a mesma build;
- como a rota existe no repositório, um `404 Not Found` indica uma destas causas estruturais:
  - a UI está apontando para outra URL configurada em `getServerUrl()`;
  - existe um processo antigo ocupando a porta e recebendo `/api/sync/align-cursors`;
  - o shell abriu em v1.3.53, mas a API carregada/ativa não corresponde ao bundle esperado;
  - há conflito de instância/porta sem tratamento explícito no boot do servidor local.

Evidências do código

- `DiagnosticsPanel.tsx`: o clique está correto.
- `localServerProvider.ts`: a chamada vai para `window.electronAPI.getServerUrl()` ou `http://localhost:3001`.
- `server/routes/sync.js`: a rota `/align-cursors` está implementada.
- `server/index.js`: o router `/api/sync` está montado.
- `electron/server-ui.html`: “Versão atual” usa `server:get-version` do Electron, não `/api/health.version`.
- `electron/local-server-main.js`: o boot não deixa claro para a UI se houve conflito de porta/instância do servidor HTTP.

Plano de implementação

1. Expor a verdade operacional no diagnóstico
Arquivos:
- `src/components/admin/DiagnosticsPanel.tsx`
- `src/lib/localServerProvider.ts`

Implementar:
- mostrar no painel:
  - URL base atual do servidor local (`getServerUrl()`);
  - versão retornada por `/api/health`;
  - versão retornada por `/api/sync/diagnostics`;
- no erro do botão, trocar o toast genérico por mensagem diagnóstica:
  - “Rota ausente no servidor HTTP atual”
  - incluir URL alvo e versão do backend, quando disponível.

Resultado:
- para de existir ambiguidade entre “versão do app” e “versão da API”.

2. Diferenciar versão do shell vs versão da API no Local Server
Arquivos:
- `electron/server-ui.html`
- `electron/server-preload.js`
- `electron/local-server-main.js`

Implementar:
- manter a versão do app-shell;
- adicionar também “API local: vX.Y.Z” lendo `/api/health.version`;
- se a API responder offline/404, mostrar isso explicitamente na tela do servidor local.

Resultado:
- o operador passa a ver imediatamente se o shell está em 1.3.53, mas a API real não está alinhada.

3. Endurecer o boot contra conflito de porta/instância errada
Arquivos:
- `server/index.js`
- `electron/local-server-main.js`

Implementar:
- tratar erro de `listen` no servidor local, especialmente conflito de porta;
- se a porta já estiver em uso:
  - não seguir como se tudo estivesse normal;
  - registrar erro visível;
  - avisar na UI/tray que outra instância/processo está atendendo a porta configurada;
- opcionalmente validar no boot que `/api/health.version` da instância ativa bate com a build esperada.

Resultado:
- elimina o cenário “app abriu, mas quem responde HTTP é outro processo”.

4. Adicionar capability check antes do clique
Arquivos:
- `server/index.js` ou `server/routes/sync.js`
- `src/components/admin/DiagnosticsPanel.tsx`

Implementar:
- incluir em `/api/health` ou novo endpoint um bloco `capabilities`, por exemplo:
  - `align_cursors: true`
- antes de habilitar/executar a ação, o front valida essa capability;
- se não existir, mostra aviso claro em vez de tentar a rota cega.

Resultado:
- mesmo se houver backend antigo, o usuário recebe mensagem precisa em vez de `Not Found`.

5. Fallback remoto opcional
Arquivos:
- `src/components/admin/DiagnosticsPanel.tsx`
- `electron/sync.js`

Implementar:
- se a rota local não existir, permitir fallback por sinalização remota ao agente;
- isso resolve o uso pela web e também serve como contingência quando a API local estiver desatualizada.

Resultado:
- a ação continua disponível mesmo fora do caminho HTTP local.

Abordagem recomendada

Fase 1 — corrigir o diagnóstico e a observabilidade
- expor URL real;
- expor versão da API;
- melhorar a mensagem do erro.

Fase 2 — corrigir a causa estrutural
- tratar conflito de porta/instância;
- validar capabilities no boot.

Fase 3 — adicionar fallback remoto
- opcional, mas útil para resiliência.

Critérios de aceite

1. Ao abrir o painel, fica visível:
- URL do servidor local em uso;
- versão do app-shell;
- versão da API local.

2. Se a API ativa não tiver `/api/sync/align-cursors`, o sistema mostra:
- que a rota está ausente naquele backend;
- qual URL/backend respondeu.

3. Se houver processo antigo ocupando a porta, o servidor local não aparenta estar saudável silenciosamente.

4. Quando a API correta estiver ativa, o botão executa sem `404`.

Arquivos principais
- `src/components/admin/DiagnosticsPanel.tsx`
- `src/lib/localServerProvider.ts`
- `electron/server-ui.html`
- `electron/server-preload.js`
- `electron/local-server-main.js`
- `server/index.js`
- `server/routes/sync.js`
