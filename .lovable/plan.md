

# Correção Crítica: Formato do Payload de Polling + Receptor de Monitor ControlID

## Causa raiz encontrada

Comparando nosso código com a documentação ControlID e o agente Python que funciona, encontrei o erro:

**Nosso código (`electron/agent.js` linha 275-281) envia:**
```json
{
  "where_args": { "access_logs": { "id": { ">": 0 } } },
  "limit": 100,
  "order": "id"
}
```

**O formato correto (documentação ControlID + agente Python) é:**
```json
{
  "where": { "access_logs": { "id": { ">": 0 } } },
  "limit": 100,
  "order": { "access_logs": { "id": "ASC" } }
}
```

O campo `where_args` não existe na API ControlID — o correto é `where`. E `order` precisa ser um objeto, não uma string. O dispositivo provavelmente retorna todos os logs sem filtro (ignorando parâmetros desconhecidos) ou retorna vazio, explicando `capturedEventsCount: 0`.

## Além disso: Monitor Push (documentação que você forneceu)

A documentação revela que dispositivos ControlID podem **ENVIAR eventos automaticamente** para um servidor via Monitor (`POST /api/notifications/dao`). Isso é mais confiável que polling e dá eventos em tempo real. Nosso servidor local já roda na porta 3001 — basta adicionar o endpoint receptor.

## Plano (2 mudanças)

### 1. Corrigir formato do polling (`electron/agent.js`)
- Trocar `where_args` por `where`
- Trocar `order: 'id'` por `order: { access_logs: { id: 'ASC' } }`
- Isso corrige a comunicação com `/access_logs.fcgi`

### 2. Adicionar receptor de Monitor ControlID (`server/index.js` + nova rota)
Criar endpoint `POST /api/notifications/dao` que:
- Recebe o payload push do ControlID (formato `{ object_changes: [...], device_id }`)
- Extrai eventos de `access_logs` do array `object_changes`
- Processa cada evento usando a mesma lógica do `processEvent()` do AgentController
- Isso permite receber eventos em tempo real sem depender exclusivamente do polling

O payload do Monitor que o dispositivo envia é:
```json
{
  "object_changes": [{
    "object": "access_logs",
    "type": "inserted",
    "values": {
      "id": "519",
      "time": "1532977090",
      "event": "12",
      "device_id": "478435",
      "user_id": "0",
      "portal_id": "1"
    }
  }],
  "device_id": 478435
}
```

### Arquivos alterados
- `electron/agent.js` — corrigir `where_args` → `where` e formato do `order`
- `server/index.js` — adicionar rota `/api/notifications/dao` para receber push do Monitor ControlID

### Após a atualização
O polling deve começar a retornar eventos imediatamente. Adicionalmente, se o Monitor for configurado no dispositivo ControlID (apontando `hostname` para o IP do servidor local, `port: 3001`), os eventos chegarão em tempo real sem polling.

