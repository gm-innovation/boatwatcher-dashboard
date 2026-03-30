

## Diagnóstico de Instabilidade de Conectividade

### Causa raiz identificada

Analisando os dados de `connectivity_events` da última hora, o dispositivo **Engenharia - Entrada** (`81f1c377`) apresenta um padrão claro de **flapping** — 14 transições offline→online em ~50 minutos. Cada desconexão dura exatamente ~35 segundos antes de recuperar. O dispositivo **Engenharia - Saída** (`b9e59f45`) está estável.

A causa é um **loop de feedback entre 3 escritores concorrentes de status**:

```text
┌─ Agent Poll (5s) ─────────────────────────────────────────────┐
│ Falha 3x consecutivas (15s) → marca offline na memória/SQLite │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌─ Heartbeat (60s) ─────────────────────────────────────────────┐
│ Envia status do dispositivo para nuvem                        │
│ Cloud escreve devices.status = 'offline'                      │
│ Trigger grava connectivity_event                              │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌─ Download Devices (60s) ──────────────────────────────────────┐
│ Baixa devices da nuvem com status='offline'                   │
│ upsertDeviceFromCloud() SOBRESCREVE status local!             │
│ → Mesmo que dispositivo já tenha recuperado localmente,       │
│   o status baixado da nuvem reseta para offline               │
│ → Próximo heartbeat reporta offline de novo                   │
└───────────────────────────────────────────────────────────────┘
```

### Problemas específicos

1. **`FAILURE_THRESHOLD = 3`** — com poll de 5s, basta 15 segundos sem resposta (dispositivo ocupado com reconhecimento facial, latência de rede) para marcar offline. Muito agressivo.

2. **`upsertDeviceFromCloud()` sobrescreve `status` local** (database.js linha 1238) — o download de devices da nuvem traz o `status` que foi setado pelo heartbeat anterior, criando um ciclo: nuvem diz offline → local aceita → heartbeat confirma offline → ciclo reinicia.

3. **Frontend `isAgentOnline` usa threshold de 60s** — com heartbeat de 60s, qualquer atraso de rede faz o agente aparecer como offline no dashboard.

4. **Sem histerese** — o sistema marca online imediatamente após 1 poll bem-sucedido, sem exigir estabilidade.

### Correções propostas

**1. `electron/agent.js`** — Aumentar resiliência do polling:
- `FAILURE_THRESHOLD`: 3 → 6 (30s antes de declarar offline)
- Adicionar `RECOVERY_THRESHOLD = 2`: exigir 2 polls consecutivos com sucesso para voltar a marcar online (histerese)
- Reduzir timeout HTTP de 10s → 5s para liberar a thread mais rápido

**2. `electron/database.js`** — Não sobrescrever status local com dados da nuvem:
- Em `upsertDeviceFromCloud()`, ignorar o campo `status` vindo da nuvem (o agente local é a fonte de verdade para conectividade)

**3. `src/components/devices/ConnectivityDashboard.tsx`** — Relaxar threshold do agente:
- `isAgentOnline`: threshold de 60s → 150s (2.5 ciclos de heartbeat)

**4. Migração SQL** — Debounce no trigger de conectividade:
- Alterar `log_device_status_change()` para ignorar eventos se o último evento para o mesmo dispositivo foi há menos de 60s (evita registrar flapping como dezenas de incidentes)

### Impacto esperado

- Eliminação de ~90% dos falsos positivos de desconexão
- Redução do ruído nos gráficos de disponibilidade
- Agente permanece "online" no dashboard mesmo com heartbeats ligeiramente atrasados

