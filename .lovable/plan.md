

# Exibir Telemetria por Dispositivo no Painel de Diagnóstico

## Problema
O servidor local já expõe telemetria por dispositivo em `GET /api/sync/diagnostics` (incluindo `lastError`, `lastPollAt`, `lastEventPayload`), mas a interface web não consome nem exibe esses dados.

## Plano

### 1. Adicionar método `getDiagnostics()` ao `localServerProvider.ts`
- Nova função: `localSync.getDiagnostics()` → `GET /api/sync/diagnostics`
- Retorna o objeto completo com `sync`, `agent` (incluindo array `devices`), `local_db`, `config`

### 2. Adicionar card "Telemetria dos Dispositivos" no `DiagnosticsPanel.tsx`
No bloco `isLocalRuntime` do `runDiagnostics()`:
- Chamar `localSync.getDiagnostics()` e armazenar em novo state `deviceTelemetry`
- Renderizar um novo Card após os cards existentes com:
  - Lista de dispositivos com: nome, IP, serial, status (badge verde/vermelho), último erro, último poll
  - Para cada dispositivo, exibir `lastEventPayload` em bloco `<pre>` JSON formatado (colapsável)
  - Se `lastEventPayload` for `null`, exibir "Nenhum evento capturado ainda"

### Arquivos alterados
- `src/lib/localServerProvider.ts` — adicionar `getDiagnostics` ao `localSync`
- `src/components/admin/DiagnosticsPanel.tsx` — novo card de telemetria por dispositivo com payload do último evento

