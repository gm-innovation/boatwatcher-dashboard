

## ✅ Implementado: Enrollment ControlID via Agent Commands

### Problema resolvido
A Edge Function `worker-enrollment` tentava fazer HTTP direto para IPs locais (ex: `192.168.0.129`) dos leitores ControlID. Isso nunca funciona pela web porque a nuvem não alcança a rede local.

### Solução implementada
Enrollment cloud agora usa sistema de **fila de comandos** via tabela `agent_commands`:

```text
WEB → worker-enrollment EF → INSERT agent_commands (pending)
                                        ↓
Local Server (poll) → GET download-commands → executa no dispositivo → POST upload-command-result
```

### Arquivos alterados
1. **`supabase/functions/worker-enrollment/index.ts`** — Removida lógica HTTP direta; agora insere comandos na fila
2. **`supabase/functions/agent-sync/index.ts`** — Adicionados endpoints `download-commands` e `upload-command-result`
3. **`electron/sync.js`** — Adicionado `downloadAndExecuteCommands()` ao ciclo de sync
4. **`src/hooks/useControlID.ts`** — Toast diferenciado para comandos enfileirados vs execução direta
