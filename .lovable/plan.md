

# Diagnóstico Atualizado — O sistema referência confirma a arquitetura correta

## O que o sistema referência ensina

O fluxo descrito (Dispositivo → Webhook/Polling → Edge Function → Banco de Dados → Frontend) é **exatamente** o que já implementamos. A arquitetura está correta. O problema não é de design — é operacional.

## Evidências atuais do banco de dados

- **`version: 1.0.0`** no heartbeat — o servidor local do usuário ainda roda código antigo
- **`last_sync_at: NULL`** — nenhum `upload-logs` foi executado
- **Nenhum access_log novo desde 25/03** — eventos do dispositivo não chegam à nuvem
- **download-workers**: fallback funcionando (log mostra "Incremental returned 0, falling back to full download, found=1")

## Causa raiz identificada: 2 problemas restantes

### Problema 1: Heartbeat envia versão errada (impede diagnóstico)

A linha 527 do `electron/sync.js` usa:
```javascript
version: process.env.npm_package_version || '1.0.0'
```

`npm_package_version` **só existe quando o servidor é iniciado via `npm start`**. Se o servidor é iniciado diretamente (ex: via Electron ou como serviço Windows), essa variável é `undefined` e a versão sempre reporta `1.0.0`. Precisamos usar a mesma abordagem do health endpoint: `require('./package.json').version`.

### Problema 2: Falta de logging no `pollDevice` para diagnosticar captura

O `pollDevice()` no `agent.js` captura erros silenciosamente em vários pontos (parse errors, login failures). Se o dispositivo ControlID não responde ao `access_logs.fcgi` ou retorna um formato inesperado, o agente simplesmente ignora sem logar. Precisamos adicionar logging explícito para ver:
- Se o login no dispositivo está funcionando
- Se `/access_logs.fcgi` retorna dados
- Se os eventos estão sendo parseados corretamente

### Problema 3: Falta de API de diagnóstico no servidor local

O usuário mencionou que "não existe painel de diagnóstico no servidor local". Precisamos expor um endpoint `/api/sync/diagnostics` que mostre:
- Versão real do servidor
- Estado do agente (running, devices, counters)
- Últimos erros de upload/download
- Quantidade de logs não sincronizados no SQLite local

## Plano de Correção (3 mudanças)

### 1. Corrigir versão no heartbeat (`electron/sync.js`)

Trocar `process.env.npm_package_version || '1.0.0'` por leitura dinâmica do `package.json`, igual ao health endpoint.

**Arquivo:** `electron/sync.js` linha 527

### 2. Adicionar logging de diagnóstico no agent (`electron/agent.js`)

Adicionar logs explícitos em pontos críticos do `pollDevice()`:
- Após login (sucesso/falha)
- Após receber resposta do `access_logs.fcgi` (status code, quantidade de eventos)
- Quando parse falha (logar o body raw recebido)

**Arquivo:** `electron/agent.js` linhas 258-338

### 3. Criar endpoint de diagnóstico (`server/routes/sync.js`)

Adicionar rota `GET /api/sync/diagnostics` que retorna:
- Versão do servidor (do package.json)
- Status do sync engine (completo, incluindo últimos erros)
- Status do agent controller (counters, devices, último evento)
- Contagem de logs não sincronizados no SQLite
- Configuração de sync (URL, token configurado sim/não)

**Arquivo:** `server/routes/sync.js`

### Resumo de arquivos alterados
- `electron/sync.js` — versão dinâmica no heartbeat
- `electron/agent.js` — logging de diagnóstico no polling
- `server/routes/sync.js` — endpoint `/api/sync/diagnostics`

