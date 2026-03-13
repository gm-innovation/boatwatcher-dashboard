

# Criar Edge Function `api` para endpoints ControlID

## Contexto

O ControlID envia notificações para endpoints específicos:
- `POST /api/notifications/dao` — eventos de acesso (o principal)
- `POST /api/notifications/door` — eventos de porta
- `POST /api/notifications/device_is_alive` — heartbeat do dispositivo

No Supabase Edge Functions, criamos uma única função chamada `api` que roteia internamente por sub-path. A URL final será `/functions/v1/api/notifications/dao`.

## Implementação

### 1. Criar `supabase/functions/api/index.ts`

Uma edge function que:
- Extrai o sub-path da URL (ex: `/notifications/dao`)
- Para `/notifications/dao`: loga o body completo e, futuramente, processa os `object_changes` com `access_logs`
- Para `/notifications/door`: loga o body
- Para `/notifications/device_is_alive`: loga e retorna OK
- Rota desconhecida: retorna 404
- `verify_jwt = false` (dispositivos ControlID não enviam JWT)

### 2. Atualizar `supabase/config.toml`

Adicionar:
```toml
[functions.api]
verify_jwt = false
```

### Estrutura do handler `/notifications/dao`

Recebe payload no formato:
```json
{
  "object_changes": [{
    "object": "access_logs",
    "type": "inserted",
    "values": { "id": "519", "time": "1532977090", "event": "12", "device_id": "478435", "user_id": "0" }
  }],
  "device_id": 478435
}
```

Na primeira versão, apenas loga tudo com `console.log("CONTROLID EVENT:", body)` e retorna `200 OK`, conforme solicitado.

