

# Ativar processamento real na Edge Function `api`

## Problema

A Edge Function `api` atualmente apenas loga os eventos e retorna 200 OK, sem atualizar o banco de dados. Resultado:
1. **Heartbeat chega**, mas `devices.status` nunca muda para `online`
2. **Logs de acesso chegam**, mas não são inseridos na tabela `access_logs`
3. **Endpoint `/notifications/poll` não existe**, então o agente não consegue buscar comandos pendentes

## Solução

Atualizar `supabase/functions/api/index.ts` para usar o Supabase client com `SERVICE_ROLE_KEY` e processar cada rota:

### 1. `/notifications/device_is_alive` (Heartbeat)
- Busca o device pelo `serial_number` na tabela `devices`
- Atualiza `status = 'online'` e `last_event_timestamp = now()`
- Se não encontrar o serial, loga warning mas retorna 200

### 2. `/notifications/dao` (Eventos de Acesso)
- Recebe payload do agente com `serial_number`, `user_id`, `direction`, `time`, `score`
- Busca o `device` pelo serial para obter `device.id`
- Se tiver `user_id`, tenta buscar o `worker` correspondente (pelo código ou document_number)
- Insere na tabela `access_logs` com `access_status = 'granted'`

### 3. `/notifications/poll` (Polling de Comandos) -- **NOVO**
- `GET /notifications/poll?device_ids=SERIAL`
- Busca o device pelo serial
- Busca `agent_commands` com `status = 'pending'` para aquele `device_id`
- Retorna os comandos pendentes como JSON
- Atualiza status dos comandos retornados para `in_progress`

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/api/index.ts` | Adiciona Supabase client, processamento real nos 3 endpoints + novo endpoint poll |

## Fluxo

```text
Agente Local                   Edge Function /api           Database
    |                               |                          |
    |-- POST device_is_alive ------>|                          |
    |                               |-- UPDATE devices SET     |
    |                               |   status='online'  ----->|
    |                               |                          |
    |-- POST /dao (access) -------->|                          |
    |                               |-- INSERT access_logs --->|
    |                               |                          |
    |-- GET /poll?device_ids=X ---->|                          |
    |                               |-- SELECT agent_commands  |
    |<-- [{command, payload}] ------|   WHERE status=pending ->|
    |                               |-- UPDATE status=         |
    |                               |   in_progress ---------->|
```

