

# Adicionar Signed URLs de fotos ao endpoint /download-workers

## Problema
O bucket `worker-photos` é privado. O endpoint `/download-workers` retorna `photo_url` com o path interno, mas o agente v2.9.0 precisa de uma URL assinada temporária (`photo_signed_url`) para baixar a foto e enviar ao hardware.

## Solução

**Arquivo:** `supabase/functions/api/index.ts` (linhas 205-224)

Após buscar os workers e antes do `return`, gerar signed URLs para cada worker que tenha `photo_url`:

```typescript
// Após linha 215 (log), antes do return:
const workersWithPhotos = await Promise.all(
  (workers || []).map(async (worker) => {
    if (worker.photo_url) {
      const photoPath = worker.photo_url.replace(/^worker-photos\//, '');
      const { data: signedData } = await supabase.storage
        .from('worker-photos')
        .createSignedUrl(photoPath, 3600);
      return { ...worker, photo_signed_url: signedData?.signedUrl ?? null };
    }
    return { ...worker, photo_signed_url: null };
  })
);
```

E no `return`, usar `workersWithPhotos` em vez de `workers`.

Também aplicar a mesma lógica no handler `/notifications/poll` para comandos `sync_users` (onde workers já são enriquecidos no payload), garantindo paridade.

Deploy automático após edição.

