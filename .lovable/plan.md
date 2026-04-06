

## Problema: Códigos trocados nos dispositivos ControlID

### O que aconteceu

Quando os 2.531 trabalhadores foram importados da plataforma legada, os códigos numéricos foram reatribuídos:
- Alexandre Silva: era código **1**, passou a ser código **350**
- Gustavo Magalhães: recebeu o código **1**

Porém, nos dispositivos ControlID, o rosto do Alexandre **ainda está cadastrado como código 1**. Quando Alexandre passa na saída, o dispositivo envia `user_id = 1`, e o sistema resolve isso como Gustavo Magalhães (que agora é código 1 no banco).

Resultado: 4 saídas de "Gustavo" são na verdade saídas de Alexandre.

### Correção necessária

Os dispositivos precisam ser **re-sincronizados** com os códigos atualizados. Isso significa:

1. **Limpar todos os usuários dos dispositivos** e re-cadastrar com os códigos corretos
2. Ou **atualizar individualmente** cada usuário no dispositivo com o novo código

A opção 1 é mais segura e simples para 2.500+ trabalhadores.

### Plano técnico

#### 1. Criar comando "full-resync" no agente local

**Arquivo: `electron/sync.js`**

Adicionar uma função `fullDeviceResync()` que:
- Lista todos os usuários no dispositivo ControlID via `load_objects.fcgi` (object: `users`)
- Remove todos via `destroy_objects.fcgi`
- Re-cadastra todos os trabalhadores ativos do banco local com os códigos corretos usando `enrollUserOnDevice()`
- Processa em lotes de 50 para não sobrecarregar o dispositivo

#### 2. Expor comando via API do servidor local

**Arquivo: `server/routes/devices.js`**

Adicionar endpoint `POST /api/devices/:id/full-resync` que dispara o re-enrollment completo para um dispositivo específico.

#### 3. Adicionar função de limpeza no controlid.js

**Arquivo: `server/lib/controlid.js`**

Adicionar `clearAllUsersFromDevice(device)` que:
- Busca todos os user IDs via `load_objects.fcgi`
- Remove em lote via `destroy_objects.fcgi`

#### 4. Corrigir access_logs incorretos

**Migração de dados**

Os 4 registros de saída atribuídos a Gustavo Magalhães (código 1) são na verdade de Alexandre Silva (código 350). Corrigir via UPDATE no banco.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `server/lib/controlid.js` | Adicionar `clearAllUsersFromDevice()` e `listUsersOnDevice()` |
| `electron/sync.js` | Adicionar `fullDeviceResync()` com enrollment em lote |
| `server/routes/devices.js` | Endpoint `POST /api/devices/:id/full-resync` |
| Banco de dados | Corrigir worker_id nos access_logs de Gustavo→Alexandre |

### O que NÃO muda
- Fluxo normal de captura de eventos
- Polling do agente
- Dashboard web

