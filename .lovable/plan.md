
Objetivo: corrigir o erro de build (`unknown property 'channel'`) sem perder a separação de canais de update entre Desktop e Local Server.

Diagnóstico rápido
- O erro atual confirma que `channel` está em posição inválida no `electron-builder`.
- `channel` não deve ficar no nível raiz nem em `nsis` para este caso.
- Para o Local Server, o canal deve ser definido no bloco `publish` (gerando `server.yml`) e o app já está correto ao usar `autoUpdater.channel = 'server'`.

Plano de implementação (revisado e completo)
1) Corrigir configuração inválida do Local Server
- Arquivo: `electron-builder.server.yml`
- Ação: remover `channel: server` do bloco `nsis`.

2) Manter canal de update separado de forma válida
- Criar arquivo novo: `electron-builder.release.server.yml`
- Conteúdo: mesmo `publish` do release atual + `channel: server`.
- Exemplo esperado:
  - provider: github
  - owner/repo via env
  - releaseType: release
  - vPrefixedTagName: true
  - channel: server

3) Ajustar script de publish do Local Server
- Arquivo: `package.json`
- Script `build:local-server:publish` passa a usar:
  - `electron-builder.server.yml` + `electron-builder.release.server.yml`
- Desktop continua com `electron-builder.release.yml` (canal padrão `latest`).

4) Preservar lógica de updater no app Local Server
- Arquivo: `electron/local-server-main.js`
- Manter `autoUpdater.channel = 'server'` (já está correto, sem mudança adicional).

5) Garantir pipeline sem regressão
- Arquivo: `.github/workflows/desktop-release.yml`
- Validar que a ordem permanece:
  1. Local Server publish
  2. Desktop publish
- Sem mudança estrutural adicional, apenas confirmar consistência com os novos scripts.

6) Publicar versão limpa
- Arquivo: `package.json`
- Bump de versão para `1.2.2` (evita reaproveitar artefatos de versão com config quebrada).

Validação após aplicar
- Local (sem publicar): `npm run build:local-server` deve finalizar sem erro de schema.
- CI release: assets esperados no GitHub Release da nova tag:
  - `server.yml` (Local Server)
  - `latest.yml` (Desktop)
  - instaladores de ambos.
- Teste funcional:
  - Local Server v1.2.2 deve consultar `server.yml`.
  - Desktop deve consultar `latest.yml`.

Observação importante de transição
- Quem ainda está na v1.0.0 do Local Server precisa instalar manualmente a primeira versão corrigida (v1.2.2). Depois disso, o auto-update do Local Server passa a funcionar pelo canal `server`.
