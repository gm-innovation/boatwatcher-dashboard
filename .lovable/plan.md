

## Eliminar falsos positivos de offline nos dispositivos

### Problema raiz

O sistema tem **três pontos** que atualizam `devices.status` na nuvem, e nenhum deles aplica um período de graça:

1. **`agent-sync/status`** (heartbeat do sync engine, ~60s) — recebe `devices: [{serial, online: true/false}]` e grava imediatamente no banco
2. **`agent-relay/heartbeat`** — mesma lógica, grava `online`/`offline` direto
3. **`controlid-api`** — marca `offline` quando falha ao comunicar com dispositivo

Embora o agente local tenha histerese (6 falhas consecutivas = offline, 2 sucessos = online), **qualquer oscilação rápida** de rede local (1 ciclo de 5s sem resposta) pode gerar `online: false` no relatório do heartbeat. Quando o heartbeat chega na nuvem, o status é gravado imediatamente — sem verificar se é uma oscilação transitória.

O debounce de 60s que existe só protege o **log de eventos** (`connectivity_events`), não o campo `devices.status`.

### Solução — Três camadas de proteção

**1. Aumentar tolerância no agente local** (`electron/agent.js`)
- Aumentar `FAILURE_THRESHOLD` de 6 para **12** (60s a 5s/poll) — exige 1 minuto completo sem resposta antes de reportar offline
- Manter `RECOVERY_THRESHOLD` em 2

**2. Adicionar grace period na nuvem** (`supabase/functions/agent-sync/index.ts`)
- Antes de gravar `status = 'offline'`, verificar o `updated_at` do dispositivo
- Só aceitar transição online→offline se o dispositivo está marcado como online há mais de **180 segundos** (3 minutos)
- Se o último update foi há menos de 180s, ignorar o status offline (considerar transitório)

```typescript
// Pseudo-código da lógica no agent-sync/status
for (const deviceStatus of body.devices) {
  const newStatus = deviceStatus.online ? 'online' : 'offline'
  
  if (newStatus === 'offline') {
    // Grace period: só aceitar offline se último update > 180s
    const { data: current } = await supabase
      .from('devices')
      .select('status, updated_at')
      .eq('controlid_serial_number', serial)
      .eq('agent_id', agent.id)
      .maybeSingle()
    
    if (current?.status === 'online') {
      const lastUpdate = new Date(current.updated_at).getTime()
      if (Date.now() - lastUpdate < 180_000) {
        continue // Ignorar — transitório
      }
    }
  }
  
  // Gravar status
  await supabase.from('devices').update({ status: newStatus, updated_at: now }).eq(...)
}
```

**3. Mesma lógica no `agent-relay/heartbeat`** (`supabase/functions/agent-relay/index.ts`)
- Aplicar o mesmo grace period de 180s antes de aceitar transição para offline

### Arquivos

| Arquivo | Mudança |
|---|---|
| `electron/agent.js` | `FAILURE_THRESHOLD`: 6 → 12 |
| `supabase/functions/agent-sync/index.ts` | Grace period de 180s antes de aceitar offline |
| `supabase/functions/agent-relay/index.ts` | Grace period de 180s antes de aceitar offline |

### Resultado esperado
- Oscilações de rede < 3 minutos não geram mais transições offline
- Dispositivos só são marcados offline após confirmação sustentada
- O número de incidentes no painel de disponibilidade deve cair drasticamente

