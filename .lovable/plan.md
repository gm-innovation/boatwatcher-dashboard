
Objetivo: corrigir o falso indicativo de credenciais no Servidor Local e eliminar o 401 persistente no enrollment com diagnóstico preciso por etapa.

1) Confirmar e corrigir a causa visível do print (UI do Servidor Local)
- Arquivo: `electron/server-ui.html`
- Hoje a coluna “Credenciais” só lê `api_credentials.user`, mas os dispositivos sincronizados da nuvem estão vindo como `api_credentials.username`.
- Ajustar exibição para fallback: `username || user || login`.
- Resultado esperado: o painel deixa de mostrar “—” quando a credencial existe.

2) Tornar o “Teste Manual” um teste real de autenticação
- Arquivos: `electron/server-ui.html`, `electron/server-preload.js`, `electron/local-server-main.js`
- Hoje o botão “Testar” valida apenas conectividade de IP (`/api/status`), não login/sessão.
- Trocar para teste autenticado usando o mesmo fluxo do enrollment (login em `/login.fcgi` + chamada autenticada ao dispositivo).
- Resultado esperado: “Online” só aparece quando credencial + sessão estiverem válidas.

3) Normalizar credenciais em um único formato no runtime local
- Arquivo: `server/lib/controlid.js` (e ponto de leitura no dashboard local)
- Criar normalização central para aceitar variações: `username`, `user`, `login` + `password` + `port`.
- Usar sempre esse normalizador em `loginToDevice`, requests e exibição.
- Resultado esperado: eliminar inconsistências entre credencial salva e credencial usada.

4) Melhorar compatibilidade de autenticação para firmware variado
- Arquivo: `server/lib/controlid.js`
- No login, enviar payload com fallback compatível (mantendo `login` principal, com suporte a aliases).
- Em chamadas autenticadas, manter `session` na query e aplicar fallback de sessão também no body JSON quando aplicável.
- Resultado esperado: reduzir 401 em firmwares que exigem formato mais estrito.

5) Instrumentar erro por fase para parar o “HTTP 401 genérico”
- Arquivos: `server/lib/controlid.js`, `electron/sync.js`
- Padronizar erros com contexto:
  - `phase=login.fcgi`
  - `phase=create_objects.fcgi`
  - `phase=user_set_image.fcgi`
  - status HTTP + trecho de resposta do dispositivo.
- Propagar esse erro completo para `agent_commands.error_message`.
- Resultado esperado: identificar em qual etapa o 401 acontece sem tentativa-cega.

6) Validação E2E após ajuste
- No painel local: confirmar coluna “Credenciais” preenchida para os 2 dispositivos.
- Clicar “Testar” em ambos e validar autenticação real.
- Rodar novo enrollment de 1 trabalhador.
- Confirmar em `agent_commands`: `pending → in_progress → completed` (ou erro com fase explícita, se ainda houver bloqueio no firmware).

Detalhes técnicos (resumo)
```text
Fluxo atual (enganoso no painel):
  Testar = ping IP (/api/status)  -> pode mostrar Online sem login válido

Fluxo corrigido:
  Testar = POST /login.fcgi + chamada autenticada
  Enrollment = login/sessão normalizada + fallback compatível + erro por fase
```

Escopo de arquivos
- `electron/server-ui.html`
- `electron/server-preload.js`
- `electron/local-server-main.js`
- `server/lib/controlid.js`
- `electron/sync.js`

Sem mudanças de banco/migração nesta etapa.
