

## Correção: `channel` na posição errada

O erro é claro: `channel` não é uma propriedade válida no nível raiz do electron-builder. Ela pertence dentro do bloco `nsis`.

### Alteração

| Arquivo | Mudança |
|---|---|
| `electron-builder.server.yml` | Mover `channel: server` de root para dentro de `nsis` |

O arquivo ficará assim:

```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Dock Check Local Server
  deleteAppDataOnUninstall: true
  uninstallDisplayName: Dock Check Local Server
  runAfterFinish: true
  channel: server
```

Nenhuma outra alteração necessária. Após o fix, rodar `npm run build:local-server` novamente.

