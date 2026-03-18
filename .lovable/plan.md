

## Diagnóstico

### Problema 1: Agente aparece "Offline" na web
O servidor local **nunca envia heartbeat periódico** para a nuvem. O endpoint `POST agent-sync/status` existe e atualiza `last_seen_at` + `status = 'online'`, mas o `SyncEngine` (`electron/sync.js`) só chama esse endpoint **uma única vez** — durante a validação inicial do token em `local-server-main.js`. Após isso, o `checkAndSync()` faz upload/download de dados mas nunca envia heartbeat. Resultado: `last_seen_at` fica congelado e a web mostra "Offline".

### Problema 2: Foto atualizada não chega ao dispositivo ControlID
O fluxo de enrollment (enviar foto ao leitor facial via API ControlID) é **apenas manual** — acionado pelo endpoint `POST /workers/:id/enrollment` no servidor local. Quando o sync baixa trabalhadores atualizados da nuvem (com `photo_signed_url`), ele salva no SQLite mas **não re-envia a foto ao dispositivo**. Ou seja, atualizar a foto na web não tem nenhum efeito no hardware.

---

## Plano de Correção

### 1. Heartbeat periódico no SyncEngine (`electron/sync.js`)

Adicionar chamada ao endpoint `agent-sync/status` dentro do `checkAndSync()`, logo após confirmar que está online. Isso atualiza `last_seen_at` e `status = 'online'` na nuvem a cada ciclo de sync (~60s).

```javascript
// Em checkAndSync(), após "this.status.online = online":
if (online) {
  await this.sendHeartbeat();
}
```

Novo método `sendHeartbeat()`:
```javascript
async sendHeartbeat() {
  try {
    await this.callEdgeFunction('agent-sync/status', 'POST', {
      version: '1.0.0',
      sync_status: this.status.syncing ? 'syncing' : 'idle',
      pending_count: this.status.pendingCount,
    });
  } catch (err) {
    console.error('Heartbeat error:', err.message);
  }
}
```

### 2. Auto-enrollment ao baixar trabalhadores atualizados (`electron/sync.js`)

No `downloadUpdates()`, após salvar cada worker no SQLite, verificar se:
- O worker tem `photo_signed_url` nova
- O worker já está enrolled em dispositivos (`devices_enrolled`)

Se sim, baixar a foto e re-enviar ao(s) dispositivo(s) ControlID automaticamente.

Alterações:
- **`electron/sync.js` → `downloadUpdates()`**: Após `upsertWorkerFromCloud`, chamar novo método `autoEnrollWorkerPhoto(worker)`.
- **Novo método `autoEnrollWorkerPhoto(worker)`**: 
  1. Verifica se worker tem `photo_signed_url` e `devices_enrolled.length > 0`
  2. Baixa a foto (HTTP GET na signed URL → base64)
  3. Para cada device enrolled, chama `enrollUserOnDevice(device, worker, photoBase64)` usando a lib `controlid.js`
  
- **`server/lib/controlid.js`**: Já tem `enrollUserOnDevice` e `loadPhotoAsBase64` prontos — reutilizar.

```javascript
// Em downloadUpdates(), no loop de workers:
for (const worker of workersRes.workers) {
  this.db.upsertWorkerFromCloud(worker);
  if (worker.photo_signed_url) {
    await this.autoEnrollWorkerPhoto(worker);
  }
}
```

### Arquivos alterados
- `electron/sync.js` — heartbeat + auto-enrollment
- Nenhuma alteração em edge functions ou UI web

### Resultado esperado
- **Agente**: Status atualiza para "Online" na web dentro de 60 segundos
- **Foto**: Ao atualizar foto na web, no próximo ciclo de sync (~1 min), o servidor local baixa a foto e envia automaticamente aos leitores ControlID onde o trabalhador já está enrolled

