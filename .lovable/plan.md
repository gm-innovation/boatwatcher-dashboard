

## Modo Somente-Leitura e Reverse Sync mais frequente

### Contexto
Para uso em produção compartilhada com outro sistema, precisamos:
1. Reduzir o intervalo do reverse sync de ~10min para ~30s
2. Criar um "Modo Somente-Leitura" que impede o sistema de escrever no hardware (enrollment, remoção, full resync), mantendo apenas a leitura de dados e logs

### Alterações

**1. `electron/sync.js` — Reduzir intervalo do reverse sync**
- Mudar a condição `this._reverseSyncCycleCount % 10 === 0` (a cada 10 ciclos de 60s = 10min) para executar **a cada ciclo** (ou seja, a cada 60s)
- Alternativa: não usar o ciclo principal e criar um timer dedicado de 30s para o reverse sync

**2. `electron/sync.js` — Flag `read_only_mode` no sync_meta**
- Antes de executar `autoEnrollWorkerPhoto`, verificar `this.db.getSyncMeta('read_only_mode')` — se `'true'`, pular o enrollment automático
- No `downloadAndExecuteCommands`, se read_only_mode estiver ativo, ignorar comandos de `enroll_worker` e `remove_worker` (marcar como skipped)
- No `fullDeviceResync`, abortar imediatamente se read_only_mode estiver ativo

**3. `server/routes/sync.js` — Endpoints de controle**
- `GET /api/sync/read-only-status` — retorna o estado atual do flag
- `POST /api/sync/read-only-mode` com body `{ enabled: true/false }` — liga/desliga o modo
- Incluir o flag no endpoint `/diagnostics` existente

**4. `server/routes/devices.js` — Bloquear ações de escrita**
- Nos endpoints de enrollment e full-resync, verificar `read_only_mode` e retornar erro 403 se ativo

**5. `src/lib/localServerProvider.ts` — Expor ao frontend**
- Adicionar funções `getReadOnlyMode()` e `setReadOnlyMode(enabled: boolean)` que chamam os novos endpoints

**6. `src/components/admin/GlobalSettings.tsx` — Toggle na UI**
- Adicionar um card "Modo de Operação" com um Switch para ligar/desligar o modo somente-leitura
- Visível apenas no runtime desktop (verificar `useRuntimeProfile`)
- Descrição: "Quando ativo, o sistema apenas lê dados e logs dos dispositivos, sem cadastrar ou remover trabalhadores no hardware. Ideal para operação paralela com outro sistema."
- Mostrar badge de status (Leitura / Leitura e Escrita)

**7. `src/components/admin/DiagnosticsPanel.tsx` — Indicar o modo**
- Na seção de status do servidor local, mostrar se o modo somente-leitura está ativo

### Resumo do comportamento

```text
┌─────────────────────────────────────────────┐
│         Modo Somente-Leitura ATIVO          │
├─────────────────────────────────────────────┤
│ ✅ Leitura de logs de acesso (polling)      │
│ ✅ Reverse sync (importar users/fotos)      │
│ ✅ Download de workers/devices da nuvem     │
│ ✅ Upload de logs para a nuvem              │
│ ❌ Auto-enrollment de fotos no hardware     │
│ ❌ Execução de comandos enroll/remove       │
│ ❌ Full device resync                       │
│ ❌ Release access via API                   │
└─────────────────────────────────────────────┘
```

### Arquivos a alterar
- `electron/sync.js` (intervalo + guards de read-only)
- `server/routes/sync.js` (novos endpoints)
- `server/routes/devices.js` (guards nos endpoints de escrita)
- `src/lib/localServerProvider.ts` (funções helper)
- `src/components/admin/GlobalSettings.tsx` (toggle UI)
- `src/components/admin/DiagnosticsPanel.tsx` (indicador de status)

