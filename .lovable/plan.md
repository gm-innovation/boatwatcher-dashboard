
## Status: Implementado ✅

### Correções Aplicadas

1. **`electron/sync.js`** — Download de devices no ciclo normal + checkpoints por etapa
2. **`server/routes/sync.js`** — Endpoint `reset-and-full-sync`
3. **`electron/local-server-main.js`** — IPCs para restart e reset+full-sync
4. **`electron/server-preload.js`** — APIs expostas para restart e reset
5. **`electron/server-ui.html`** — Botões "Reiniciar Serviço" e "Sync Completo" + aviso sobre bandeja
6. **`server/index.js`** — Conecta agentController ao syncEngine
7. **Migração SQL** — Limpeza dinâmica de agentes órfãos e duplicados
