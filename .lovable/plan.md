

# Eliminar Erros de Timeout e Melhorar Resiliência do Agent

## Problema

O dispositivo "Engenharia - Entrada" mostra status "Erro" com "Timeout" mesmo tendo capturado eventos com sucesso (último event ID = 24). Um único timeout intermitente marca o dispositivo como offline/erro, criando falsos alarmes. Além disso, o polling sequencial com timeout de 5s pode causar atrasos em cascata.

## Correções — `electron/agent.js`

### 1. Aumentar timeout e adicionar retry automático
- Aumentar timeout de 5s → 10s para login e polling (dispositivos ControlID em redes corporativas podem ser mais lentos)
- Adicionar retry automático com backoff: se o primeiro request falhar por timeout, tentar uma segunda vez antes de marcar erro

### 2. Threshold de falhas consecutivas antes de marcar "offline"
- Não marcar dispositivo como "offline" em um único timeout
- Usar contador de falhas consecutivas (`_consecutiveFailures`) — só marcar offline após 3 falhas seguidas
- Limpar erro e contador quando um poll for bem-sucedido

### 3. Polling paralelo em vez de sequencial
- Mudar `pollDevices()` de `for...await` sequencial para `Promise.allSettled()` paralelo
- Cada dispositivo é polled independentemente, sem bloquear os outros

### 4. Limpar erro stale após sucesso
- Quando um poll é bem-sucedido, garantir que `_lastError` seja limpo (já acontece) e que o status visual reflita isso imediatamente

## Arquivo alterado
- **`electron/agent.js`** — `pollDevices()`, `pollDevice()`, `loginToDevice()`, novo campo `_consecutiveFailures`

