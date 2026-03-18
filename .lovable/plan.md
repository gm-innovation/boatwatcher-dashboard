

## Corrigir GUI do Local Server — Adicionar Dispositivos Manualmente

### Problema
A GUI atual só permite colar o token e espera que os dispositivos já estejam vinculados ao agente na nuvem (`devices.agent_id`). Mas o fluxo real é: o admin instala o Local Server, cola o token, e **depois precisa adicionar os dispositivos manualmente** com IP, ID, nome, usuário e senha — exatamente como fazia no `config.json` do script Python.

### O que muda

A interface `server-ui.html` precisa de um formulário para **adicionar dispositivos localmente**, com os campos:
- **IP** do dispositivo (ex: `192.168.1.100`)
- **Device ID** (UUID do dispositivo cadastrado na nuvem)
- **Nome** (ex: "Leitor Portaria")
- **Usuário** (credencial do ControlID, default `admin`)
- **Senha** (credencial do ControlID, default `admin`)

### Implementação

**1. Atualizar `electron/server-ui.html`**
- Adicionar formulário "Adicionar Dispositivo" na seção de dispositivos do dashboard, com campos: IP, Device ID, Nome, Usuário, Senha
- Botão "Adicionar" que salva o dispositivo via IPC
- Na tabela de dispositivos, mostrar botão "Remover" por dispositivo
- Dispositivos vindos do cloud (via download-devices) também aparecem, mas os adicionados manualmente são salvos localmente

**2. Atualizar `electron/server-preload.js`**
- Adicionar método `addDevice(data)` → IPC para salvar dispositivo no SQLite com IP e credenciais
- Adicionar método `removeDevice(id)` → IPC para remover dispositivo

**3. Atualizar `electron/local-server-main.js`**
- Adicionar handler `server:add-device` que recebe `{ ip, device_id, name, user, password }` e salva no SQLite via `db.upsertDeviceFromCloud` (ou `db.createDevice`) com as credenciais em `api_credentials: { user, password }`
- Adicionar handler `server:remove-device` que remove o dispositivo do SQLite
- Após adicionar, chamar `agentController.reloadDevices()` para iniciar polling no novo IP

**4. Nenhuma mudança no edge function** — o endpoint `download-devices` continua funcionando para dispositivos já vinculados na nuvem, mas agora o Local Server também suporta dispositivos adicionados manualmente

### Resultado
O admin instala o Local Server → cola o token → adiciona dispositivos com IP/credenciais → o servidor começa a pollar cada dispositivo pelo seu IP → eventos são sincronizados com a nuvem.

