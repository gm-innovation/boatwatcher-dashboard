

## Fix: Syntax Error in `electron/sync.js` — Missing `enroll_worker` Block

### Problema
Na edição anterior que adicionou o modo somente-leitura, o bloco `enroll_worker` dentro de `downloadAndExecuteCommands()` foi acidentalmente substituído por `...` (placeholder), gerando um **SyntaxError** na linha 890 que impede o servidor local de iniciar.

### Correção

**Arquivo: `electron/sync.js`** — Linha 889-890

Substituir:
```js
if (cmd.command === 'enroll_worker') {
...
} else if (cmd.command === 'remove_worker') {
```

Por o bloco completo de enrollment que existia antes:
```js
if (cmd.command === 'enroll_worker') {
  let photoBase64 = null;
  if (payload.photo_url) {
    if (photoCache.has(payload.photo_url)) {
      photoBase64 = photoCache.get(payload.photo_url);
    } else {
      try {
        photoBase64 = await loadPhotoAsBase64(payload.photo_url);
        photoCache.set(payload.photo_url, photoBase64);
      } catch (photoErr) {
        console.warn(`[commands] Photo download failed for ${payload.worker_name}: ${photoErr.message}`);
      }
    }
  }

  const workerObj = {
    id: payload.worker_id,
    name: payload.worker_name,
    code: payload.worker_code,
    photo_url: payload.photo_url,
  };

  const enrollResult = await enrollUserOnDevice(device, workerObj, photoBase64);
  if (!enrollResult.success) {
    throw new Error(enrollResult.error || enrollResult.warning || 'Enrollment failed');
  }
  resultPayload.result = enrollResult;
  console.log(`[commands] Enrolled worker ${payload.worker_name} on device ${device.name}`);

} else if (cmd.command === 'remove_worker') {
```

### Causa raiz
O placeholder `// ... keep existing code` usado durante a edição do modo somente-leitura não foi expandido, resultando em `...` literal no JavaScript — um token inválido nesse contexto.

### Arquivo a alterar
- `electron/sync.js` (1 ponto — linhas 889-890)

