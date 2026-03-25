

## Adicionar painel de atualização ao Desktop

### Situação atual

O Desktop já possui toda a infraestrutura de auto-update no backend Electron:
- `electron/main.js`: handlers IPC (`updater:getStatus`, `updater:checkForUpdates`, `updater:installDownloadedUpdate`)
- `electron/preload.js`: bridge exposta (`electronAPI.updater.*`, `onUpdaterStatusChange`)
- `src/lib/dataProvider.ts`: tipos TypeScript (`UpdaterStatus`)

O que falta é **apenas a UI React** para exibir o status e permitir ações de atualização. No Local Server isso existe no `server-ui.html`, mas no Desktop não há nenhum componente consumindo essas APIs.

### Plano

#### 1. Criar componente `DesktopUpdater` (`src/components/desktop/DesktopUpdater.tsx`)

Componente que:
- Chama `electronAPI.updater.getStatus()` ao montar para obter o estado inicial
- Escuta `electronAPI.onUpdaterStatusChange()` para atualizações em tempo real
- Exibe um card compacto com:
  - **Versão atual** (via `app.getVersion()` — já exposto como `getVersion` no preload? verificar, senão usar o status)
  - **Status**: idle / checking / downloading (com %) / downloaded / error
  - **Botão "Verificar atualizações"**: chama `electronAPI.updater.checkForUpdates()`
  - **Botão "Instalar e reiniciar"** (quando `downloaded = true`): chama `electronAPI.updater.installDownloadedUpdate()`
  - **Mensagem de erro** com link para download manual quando falha

#### 2. Integrar o componente na página de Administração (`src/pages/Admin.tsx`)

Adicionar uma nova aba ou seção "Atualização do Desktop" visível apenas quando `isElectron() === true`, renderizando o `DesktopUpdater`.

### Arquivos afetados
- `src/components/desktop/DesktopUpdater.tsx` (novo)
- `src/pages/Admin.tsx` (adicionar aba/seção condicional)

