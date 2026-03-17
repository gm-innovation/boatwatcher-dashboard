

## Desinstalar e diagnosticar o Local Server

### Comandos para desinstalar

O app foi instalado via NSIS como **"Dock Check Local Server"**. Para desinstalar:

**Opção 1 — Painel de Controle:**
1. Abra **Configurações > Aplicativos > Aplicativos instalados**
2. Procure **"Dock Check Local Server"**
3. Clique em **Desinstalar**

**Opção 2 — Linha de comando (PowerShell como Admin):**
```powershell
# Encerrar processo se estiver rodando
taskkill /f /im "Dock Check Local Server.exe" 2>$null

# Executar desinstalador silencioso
& "$env:LOCALAPPDATA\Programs\Dock Check Local Server\Uninstall Dock Check Local Server.exe" /S

# Limpar dados residuais (opcional)
Remove-Item -Recurse -Force "$env:APPDATA\Dock Check Local Server" 2>$null
```

### Provável causa do app não abrir

O `local-server-main.js` importa `../server/index` que por sua vez importa `../electron/database`. Se o caminho relativo não resolver corretamente dentro do `.asar`, o app crasha silenciosamente. O `runAfterFinish: false` impede que o app abra após a instalação — o usuário precisa abrir manualmente pelo atalho.

### Correções a implementar

1. **Adicionar try/catch com log de erro no boot** — gravar erro em arquivo de log para diagnóstico quando o app não abre
2. **Corrigir `window-all-closed`** — o handler recebe o evento mas `event.preventDefault()` não é o método correto nesse evento do Electron; deveria simplesmente não chamar `app.quit()`

**Arquivo**: `electron/local-server-main.js`
- Adicionar logging de erro em arquivo (`error.log` no `userData`)
- Corrigir handler de `window-all-closed` (remover `event` param, o evento não tem `preventDefault`)

Depois de desinstalar e reinstalar, se continuar sem abrir, o arquivo `error.log` em `%APPDATA%/Dock Check Local Server/` vai mostrar o que está falhando.

