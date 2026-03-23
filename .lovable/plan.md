

## Problema: Local Server v1.0.0 instala o Desktop ao atualizar

### Causa Raiz

Ambos os builds (Desktop e Local Server) publicam para o mesmo GitHub Release. O Desktop gera `latest.yml` apontando para `DockCheck-Desktop-Setup-1.2.0.exe`. O Local Server com `channel: server` gera `server.yml`, mas o `generateUpdatesFilesForAllChannels: true` não está sobrescrevendo o `latest.yml` do Desktop como esperado.

O Local Server v1.0.0 **não tem** `autoUpdater.channel = 'server'` (essa linha só existe no código v1.2.0). Então ele busca `latest.yml` → encontra o Desktop → instala o Desktop.

### Problema Irreversível na v1.0.0

Não é possível corrigir o auto-updater da v1.0.0 retroativamente. O código da v1.0.0 sempre vai buscar `latest.yml`. A solução exige duas partes:

### Parte 1: Separar os canais de atualização definitivamente

| Arquivo | Mudança |
|---|---|
| `electron-builder.yml` (Desktop) | Remover `generateUpdatesFilesForAllChannels` |
| `electron-builder.server.yml` (Local Server) | Remover `generateUpdatesFilesForAllChannels` |
| `.github/workflows/desktop-release.yml` | Inverter a ordem: **Local Server primeiro**, **Desktop por último** |

Com isso:
- Local Server gera apenas `server.yml` → para v1.2.0+
- Desktop gera apenas `latest.yml` → para Desktop
- Sem colisão de arquivos

### Parte 2: Transição da v1.0.0

Como a v1.0.0 do Local Server **sempre** vai buscar `latest.yml` (que agora apontará para Desktop), **não há como fazer auto-update da v1.0.0 para v1.2.0 automaticamente**.

**Solução:** O usuário precisa **instalar manualmente** o `DockCheck-Local-Server-Setup-1.2.0.exe` da página de releases do GitHub. Após essa instalação manual, o auto-updater da v1.2.0 usará `server.yml` e futuras atualizações funcionarão normalmente.

### Parte 3: Limpar atalhos antigos

O atalho "vite_react_s..." e o "dock-check-..." na área de trabalho são resquícios das instalações anteriores do Desktop. Precisam ser deletados manualmente.

### Versão

Bumpar para `1.2.1` no `package.json` para gerar um release limpo com os canais separados.

### Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `package.json` | `version` → `1.2.1` |
| `electron-builder.yml` | Remover `generateUpdatesFilesForAllChannels: true` |
| `electron-builder.server.yml` | Remover `generateUpdatesFilesForAllChannels: true` |
| `.github/workflows/desktop-release.yml` | Inverter ordem: Local Server primeiro, Desktop por último |

### Após o commit
```powershell
git pull
# Instalar manualmente o Local Server v1.2.0 atual da página de releases
# Depois, criar nova tag para o release limpo:
git tag v1.2.1
git push origin v1.2.1
```

### Ação manual necessária
1. Baixar `DockCheck-Local-Server-Setup-1.2.0.exe` diretamente da página de releases do GitHub
2. Instalar por cima da v1.0.0
3. Deletar os atalhos antigos ("vite_react_s..." e "dock-check-...") da área de trabalho
4. Após a instalação da v1.2.0+, futuras atualizações do Local Server serão automáticas via `server.yml`

