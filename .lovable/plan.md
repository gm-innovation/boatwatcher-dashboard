
Plano direto para encerrar esse problema de vez (startup + log invisível):

1) Diagnóstico provável (com base no código atual)
- O `error.log` pode não ser criado porque `logToFile()` usa `app.getPath('userData')` antes do app estar pronto em alguns fluxos de erro.
- O erro de boot pode acontecer antes do bloco `try` principal (`new Tray(...)` está fora do `try`).
- O caminho do ícone em produção (`process.resourcesPath/build/icon.png`) é frágil no app empacotado e pode quebrar o `Tray`.
- `runAfterFinish: false` faz o instalador terminar sem abrir o app (como é app de bandeja, parece que “não abriu”).

2) Correções de implementação
- Arquivo: `electron/local-server-main.js`
  - Criar `resolveLogPath()` com fallback robusto:
    - `app.getPath('userData')` (quando disponível)
    - `%APPDATA%\Dock Check Local Server`
    - `%LOCALAPPDATA%\Dock Check Local Server`
    - `os.tmpdir()`
  - Garantir `fs.mkdirSync(dirname, { recursive: true })` antes de escrever.
  - Registrar log inicial obrigatório no boot com caminho final do log.
  - Mover criação do Tray para dentro de `try/catch` (junto com boot do servidor).
  - Resolver ícone por lista de candidatos (primeiro existente):
    - `path.join(app.getAppPath(), 'build', 'icon.png')`
    - `path.join(app.getAppPath(), 'public', 'favicon-512.png')`
    - fallback de dev atual.
  - Adicionar item no menu da bandeja: “Abrir pasta de logs” e “Abrir error.log”.

- Arquivo: `electron-builder.server.yml`
  - Ajustar `nsis.runAfterFinish` para `true` (abre após instalar).
  - Manter configuração simples (sem `include` NSIS custom que já causou erro).

- Arquivo novo: `scripts/uninstall-local-server.ps1`
  - Encerrar processo: `taskkill /f /im "Dock Check Local Server.exe"`.
  - Executar desinstalador se existir.
  - Limpar resíduos em caminhos dos dois nomes possíveis de app (incluindo `vite_react_shadcn_ts`).
  - Script idempotente (não falha se algo não existir).

- Arquivo: `package.json`
  - Novo script: `"local-server:uninstall": "powershell -ExecutionPolicy Bypass -File scripts/uninstall-local-server.ps1"`.

3) Comando de diagnóstico imediato (antes mesmo do patch)
- Procurar qualquer `error.log` no Windows:
  - `Get-ChildItem "$env:APPDATA","$env:LOCALAPPDATA" -Filter error.log -Recurse -ErrorAction SilentlyContinue | Select-Object FullName,LastWriteTime`
- Verificar se o servidor está vivo mesmo “sem abrir”:
  - `Invoke-RestMethod http://localhost:3001/api/health`

4) Critério de sucesso
- Instalação termina e o app inicia automaticamente.
- Ícone aparece na bandeja sem crash.
- `error.log` sempre existe em caminho previsível.
- Reinstalação limpa via `npm run local-server:uninstall` + novo setup.
- `http://localhost:3001/api/health` responde após abrir o app.
