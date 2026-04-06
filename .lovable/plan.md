

## Sincronização Reversa — Análise de Risco

### O que muda vs. o que já existe

Todas as alterações são **aditivas**. Nenhum código existente é modificado — apenas novas funções e rotas são adicionadas.

```text
Arquivo                              Tipo de alteração
─────────────────────────────────── ─────────────────
server/lib/controlid.js              + 3 funções novas (listDeviceUsers, listDeviceUserImages, getDeviceUserImage)
electron/sync.js                     + 1 método novo (reverseSync) chamado opcionalmente no fim do triggerSync
electron/database.js                 + 2 helpers de consulta (getWorkerByCode, getWorkerCodes)
supabase/functions/agent-sync        + 1 rota nova (reverse-sync-workers)
```

### Garantias de segurança

| Risco potencial | Mitigação |
|---|---|
| Quebrar o ciclo de sync existente | `reverseSync()` é chamado dentro de try/catch isolado — erro nele não interrompe o fluxo normal |
| Duplicar trabalhadores | Matching por `code` (ID inteiro do ControlID, campo unique) + verificação por `document_number` |
| Sobrecarregar o dispositivo | Executa a cada ~10 ciclos (~10min), não a cada 60s |
| Conflito de rotas na edge function | Nova rota `reverse-sync-workers` — nomes distintos dos existentes |
| Perda de dados existentes | Operação somente de INSERT/UPDATE — nunca deleta workers existentes |
| Foto sobrescrever foto existente | Só baixa foto se `photo_url IS NULL` no banco |

### Estrutura da implementação

**1. `server/lib/controlid.js`** — Funções de leitura (sem tocar nas existentes)
- `listDeviceUsers(device)` — `POST /load_objects.fcgi { object: "users" }`
- `listDeviceUserImages(device)` — `POST /user_list_images.fcgi`
- `getDeviceUserImage(device, userId)` — `GET /user_get_image.fcgi?user_id=X` retorna Buffer JPEG

**2. `electron/sync.js`** — Novo método isolado
```text
async triggerSync() {
  // ... fluxo existente (upload logs, download updates, etc.) ...
  // Nova linha no final:
  await this.reverseSync().catch(err => console.error('[sync] reverseSync error:', err.message));
}

async reverseSync() {
  // Throttle: só executa a cada 10 ciclos
  // Para cada device online:
  //   1. load_objects.fcgi -> lista users
  //   2. Filtra os que não existem no DB local (by code)
  //   3. user_list_images.fcgi -> quem tem foto
  //   4. user_get_image.fcgi -> baixa JPEG
  //   5. POST /agent-sync/reverse-sync-workers -> envia para nuvem
}
```

**3. `supabase/functions/agent-sync/index.ts`** — Nova rota
- Protegida pelo mesmo `x-agent-token` das rotas existentes
- Recebe `{ workers: [{ name, registration, photo_base64 }] }`
- Cria worker se não existe (by `code` ou `document_number`)
- Upload foto no bucket `worker-photos` (privado, com signed URL)
- Retorna mapeamentos criados

**4. `electron/database.js`** — Helpers simples
- `getWorkerByCode(code)` — SELECT by code
- `getWorkerCodes()` — retorna Set de todos codes conhecidos

### O que NÃO muda
- Fluxo de enrollment (sistema → dispositivo)
- Upload/download de logs de acesso
- Download de trabalhadores/empresas/projetos
- Polling de comandos (`agent_commands`)
- Autenticação e RLS existentes

