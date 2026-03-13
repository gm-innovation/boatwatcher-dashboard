

# Adicionar suporte a `agent_heartbeat` na Edge Function `api`

## Problema

A Edge Function `/notifications/device_is_alive` apenas atualiza a tabela `devices` (por `serial_number`). Quando o agente envia um heartbeat com `event_type: "agent_heartbeat"` e seu `token`, a função retorna 200 OK mas **não atualiza a tabela `local_agents`**. Por isso o painel mostra o agente como "Offline" e versão antiga.

## Solução

Modificar o handler de `/notifications/device_is_alive` em `supabase/functions/api/index.ts` para:

1. Verificar se `event_type === 'agent_heartbeat'`
2. Se sim, buscar o agente pelo `token` na tabela `local_agents`
3. Atualizar `status = 'online'`, `last_seen_at = now()`, `version = body.agent_version`, `ip_address` (do header)
4. Continuar com o fluxo normal do device heartbeat se também tiver `serial_number`

## Fluxo

```text
Agente envia POST /device_is_alive
  |
  ├─ event_type = "agent_heartbeat" + token?
  │   └─ UPDATE local_agents SET status='online', version='2.3.8', last_seen_at=now()
  │      WHERE token = body.token
  │
  └─ serial_number presente?
      └─ UPDATE devices SET status='online' WHERE controlid_serial_number = serial
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/api/index.ts` | Adiciona lógica de `agent_heartbeat` no handler de heartbeat |

