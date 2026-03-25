

## Bug: Acesso negado para trabalhador reconhecido

### Causa raiz

O dispositivo ControlID identifica usuários pelo campo inteiro `code` (ex: `42`). Quando o enrollment é feito, o sistema envia `worker_code` como o ID do usuário no dispositivo. Quando o dispositivo reporta um evento de acesso, ele envia esse mesmo inteiro como `event.user_id`.

Porém, o webhook (`controlid-webhook/index.ts` linha 109) faz:
```typescript
.eq('id', event.user_id)  // ← procura pelo UUID!
```

O `id` é um UUID (ex: `a1b2c3d4-...`), mas o dispositivo envia o `code` inteiro (ex: `42`). A query não encontra o trabalhador → `worker_not_found` → **acesso negado**.

O mesmo problema existe no `electron/agent.js` linha 184: `worker_id: event.user_id` — grava o código inteiro no campo `worker_id` que espera UUID.

### Correção

#### 1. `supabase/functions/controlid-webhook/index.ts`

Alterar a busca do trabalhador para detectar se `event.user_id` é um UUID ou inteiro:
- Se for UUID → buscar por `id`
- Se for inteiro → buscar por `code`

```typescript
const isUuid = /^[0-9a-f]{8}-/.test(String(event.user_id));
const { data: worker, error: workerError } = await supabase
  .from('workers')
  .select('id, name, status, document_number, allowed_project_ids')
  .eq(isUuid ? 'id' : 'code', isUuid ? event.user_id : Number(event.user_id))
  .single()
```

Também corrigir o insert do access_log para usar `worker.id` (UUID) em vez de `event.user_id`.

#### 2. `electron/agent.js` — método `processEvent`

Mesma correção: o `event.user_id` vindo do dispositivo é o `code` inteiro. Precisa resolver para o UUID do trabalhador antes de gravar no access_log:
- Buscar o trabalhador pelo `code` no SQLite local
- Usar o `id` (UUID) resultante no `worker_id` do access_log

### Arquivos afetados
- `supabase/functions/controlid-webhook/index.ts` — buscar worker por `code` quando `user_id` é inteiro
- `electron/agent.js` — resolver `code` → UUID no `processEvent`

