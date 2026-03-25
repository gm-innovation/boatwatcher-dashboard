

## Remover URL manual — Desktop deve usar GitHub automático como o Local Server

### Problema

O Desktop exige que o operador configure manualmente uma URL de atualização (`generic` provider), enquanto o Local Server funciona automaticamente porque o `electron-builder` embute a configuração do GitHub no arquivo `app-update.yml` durante o build.

O `electron-builder.release.yml` já tem a configuração GitHub correta. Quando o Desktop é empacotado com `--config electron-builder.release.yml`, o `app-update.yml` gerado contém owner/repo/provider automaticamente. O `autoUpdater` lê esse arquivo sem precisar de `setFeedURL()`.

### Correção

#### 1. `electron/main.js`
- Remover toda a lógica de `updateFeedUrl` (variável, config, `setFeedURL`)
- Inicializar o `autoUpdater` como o Local Server: apenas `autoDownload = false`, sem `setFeedURL`
- Envolver a inicialização em try-catch para resiliência em dev (como o Local Server faz)
- `checkForUpdates()` simplesmente chama `autoUpdater.checkForUpdates()` — se não for packaged, retorna erro
- Remover os IPC handlers `config:getUpdateUrlSync` e `config:setUpdateUrl`
- O status `configured` passa a ser `true` quando `app.isPackaged` (o `app-update.yml` existe)

#### 2. `electron/preload.js`
- Remover `getUpdateUrl` e `setUpdateUrl` do `contextBridge`

#### 3. `src/components/desktop/DesktopUpdater.tsx`
- Remover o campo de input da URL e o botão Salvar
- Simplificar: mostrar apenas o status e o botão "Verificar atualizações"
- Quando não empacotado, mostrar mensagem "Disponível apenas na versão instalada"

#### 4. `src/lib/dataProvider.ts`
- Remover `getUpdateUrl` e `setUpdateUrl` da interface `ElectronAPI` / `UpdaterStatus`

### Resultado
O Desktop passa a funcionar exatamente como o Local Server: o `electron-builder` embute a config do GitHub no build, e o `autoUpdater` a usa automaticamente. Zero configuração manual.

