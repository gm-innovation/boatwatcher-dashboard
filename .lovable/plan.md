

## Problema: Versão hardcoded "v1.0.0" no Local Server

O arquivo `electron/server-ui.html` tem a versão **hardcoded** na linha 186:
```html
<span class="version" id="versionLabel">v1.0.0</span>
```

Não existe nenhum mecanismo para buscar a versão real do `app.getVersion()` (que vem do `package.json`). Por isso, mesmo instalando a v1.2.13, a UI sempre mostra "v1.0.0" — e o auto-updater usa esse label para exibir "Versão atual", causando confusão.

O build do instalador **está correto** (o arquivo se chama `DockCheck-Local-Server-Setup-1.2.13.exe`), mas a UI não reflete.

### Correções

**1. `electron/local-server-main.js`** — Adicionar IPC handler para retornar a versão real:
```javascript
ipcMain.handle('server:get-version', () => app.getVersion());
```

**2. `electron/server-preload.js`** — Expor no bridge:
```javascript
getVersion: () => ipcRenderer.invoke('server:get-version'),
```

**3. `electron/server-ui.html`** — No `DOMContentLoaded`, buscar versão real e atualizar o label:
```javascript
const version = await window.serverAPI.getVersion();
document.getElementById('versionLabel').textContent = `v${version}`;
document.getElementById('currentVersion').textContent = `v${version}`;
```

### Arquivos alterados
- `electron/local-server-main.js` — 1 linha (novo IPC handler)
- `electron/server-preload.js` — 1 linha (expor getVersion)
- `electron/server-ui.html` — atualizar init para buscar versão dinâmica

