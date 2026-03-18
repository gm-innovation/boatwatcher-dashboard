

## Interface Visual do Local Server + Endpoint de Dispositivos

### Entendimento do fluxo completo

```text
Web UI                              Local Server
──────                              ────────────
1. Criar Agente → token
2. Criar Dispositivo(s)
   - IP, serial, projeto
   - Vincular agent_id
3. Copiar token do agente
                                    4. Instalar Local Server
                                    5. Abrir GUI → colar token
                                    6. Validar token via agent-sync
                                    7. Baixar dispositivos do agente
                                       (com IPs individuais)
                                    8. Iniciar polling nos IPs
                                    9. Enviar eventos para cloud
```

O ponto-chave que faltava: o Local Server precisa saber quais dispositivos (e seus IPs) pertencem ao agente. O edge function `agent-sync` não tem endpoint `download-devices`.

### Implementacao (5 partes)

**1. Adicionar endpoint `download-devices` ao edge function `agent-sync`**
- Novo handler `GET /download-devices` que busca na tabela `devices` onde `agent_id = agent.id`
- Retorna: `id`, `name`, `controlid_ip_address`, `controlid_serial_number`, `api_credentials`, `configuration`, `status`, `location`
- O agente já está autenticado pelo token no header

**2. Criar `electron/server-ui.html`** — Interface HTML standalone
- **Tela 1 - Configuracao** (sem token salvo):
  - Logo + titulo "Dock Check Local Server"
  - Campo para colar token do agente
  - Botao "Conectar" → valida via `agent-sync/status` (POST heartbeat com token)
  - Se valido: salva token no SQLite `sync_meta`, exibe info do agente/projeto
  - Se invalido: mensagem de erro
- **Tela 2 - Dashboard** (token configurado):
  - Card Status: servidor online, porta, uptime
  - Card Agente: nome, projeto vinculado, status sync
  - Card Dispositivos: lista dispositivos baixados do cloud (nome, IP, serial, status de conectividade local)
    - Botao "Testar Conexao" por dispositivo (HTTP GET ao IP)
  - Botao "Forcar Sync" 
  - Botao "Desconectar" (remove token, volta tela 1)
  - Ultimas linhas do log
- CSS embutido, visual escuro consistente com o sistema

**3. Criar `electron/server-preload.js`** — Bridge IPC
- `getServerHealth()` → porta, uptime, status
- `getAgentConfig()` → token (mascarado), nome agente, projeto, status
- `setAgentToken(token)` → salva em sync_meta, dispara sync, retorna info do agente
- `removeAgentToken()` → limpa sync_meta
- `getDevices()` → lista dispositivos do SQLite local (baixados do cloud)
- `testDeviceConnection(ip)` → HTTP GET com timeout
- `triggerSync()` → forca sincronizacao
- `getLogContent()` → ultimas 100 linhas do error.log
- `openFolder(type)` → shell.openPath

**4. Atualizar `electron/local-server-main.js`**
- Importar `BrowserWindow`, `ipcMain`
- Registrar handlers IPC para cada funcao do preload
- `openConfigWindow()` → carrega `server-ui.html` com preload
- `tray.on('double-click', openConfigWindow)`
- Adicionar "Abrir painel" no menu da bandeja
- Corrigir URL exibida: `localhost:3001` ao inves de `0.0.0.0:3001`
- No handler `setAgentToken`: salvar token, chamar `syncEngine.bootstrapFromAccessToken()` ou equivalente, baixar dispositivos via `agent-sync/download-devices`
- Ao receber dispositivos: salva no SQLite local, recarrega `agentController.reloadDevices()`

**5. Atualizar `electron-builder.server.yml`**
- Adicionar `electron/server-ui.html` e `electron/server-preload.js` na lista de files

### Fluxo completo pos-implementacao
1. Admin cria agente na web → copia token
2. Admin cria dispositivos na web → vincula ao agente (cada um com seu IP)
3. Instala Local Server → duplo clique abre painel
4. Cola token → sistema valida, baixa lista de dispositivos com IPs
5. Agent Controller comeca a pollar cada dispositivo pelo seu IP
6. Eventos de acesso sao salvos no SQLite e sincronizados com a cloud

### Nota sobre build error
O erro `@swc/core native binding` e do ambiente Lovable (preview web) e nao afeta o build do Electron. Os arquivos `.js` e `.html` nao passam pelo Vite.

