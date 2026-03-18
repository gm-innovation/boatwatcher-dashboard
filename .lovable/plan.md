

## Auto-updater para o Servidor Local

Hoje, para aplicar qualquer correção no Local Server, é necessário baixar e reinstalar manualmente. O Desktop já tem auto-updater completo via `electron-updater` — vamos replicar o mesmo padrão no Local Server.

### Alterações

**1. `electron-builder.server.yml`** — Habilitar metadados de update
- Mudar `generateUpdatesFilesForAllChannels: false` para `true`
- Adicionar bloco `publish` apontando para GitHub Releases (mesmo repo)

**2. `electron/local-server-main.js`** — Adicionar lógica de auto-updater
- Importar `autoUpdater` de `electron-updater`
- Criar estado `updateStatus` e handlers (`update-available`, `download-progress`, `update-downloaded`, `error`)
- `autoDownload = false` — só baixa com autorização do admin
- Verificar atualizações na inicialização e a cada 6 horas
- Adicionar item "Verificar atualização" no menu do System Tray
- Registrar IPC handlers: `server:check-update`, `server:download-update`, `server:install-update`, `server:get-update-status`

**3. `electron/server-preload.js`** — Expor APIs de update
- `checkForUpdate()`, `downloadUpdate()`, `installUpdate()`, `onUpdaterStatus(callback)`

**4. `electron/server-ui.html`** — Seção de atualização na GUI
- Card no dashboard mostrando versão atual
- Botão "Verificar atualização"
- Estados visuais: verificando, disponível (com versão), baixando (com progresso), pronto para instalar
- Botão "Instalar e reiniciar" quando download completo

**5. `.github/workflows/desktop-release.yml`** — Incluir Local Server no release
- Adicionar step para `npm run build:local-server:publish` (novo script)
- Os artefatos do servidor (instalador + `latest.yml`) vão para a mesma GitHub Release

**6. `package.json`** — Novo script
- `build:local-server:publish` usando `electron-builder --config electron-builder.server.yml --config electron-builder.release.yml --publish always`

### Resultado
- O admin verá a versão atual e poderá atualizar com um clique no painel do servidor
- O tray também terá opção de verificar atualização
- Cada release no GitHub incluirá tanto o Desktop quanto o Local Server

