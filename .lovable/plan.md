

## Diagnóstico: Por que o dashboard Web não atualiza

### Problemas encontrados

**1. Upload de logs do Desktop → Nuvem envia campo inválido**
O `getUnsyncedLogs()` faz `SELECT * FROM access_logs WHERE synced = 0`, retornando TODAS as colunas incluindo `synced` (INTEGER). Quando a edge function faz `supabase.from('access_logs').insert(logs)`, o campo `synced` não existe na tabela cloud — causando erro silencioso. O log de upload nunca aparece nos logs da edge function porque o insert falha.

**2. O dashboard Web JÁ deveria mostrar dados de teste**
Os 3 access_logs de teste que inserimos estão na nuvem com device_ids corretos. A query deveria retornar Alexandre Silva como "a bordo" (última entrada às 19:14 sem saída posterior). Se não aparece, pode ser um problema de RLS: a tabela `devices` tem política SELECT apenas para admins. Se o usuário não tiver role admin, a query de devices retorna vazio → 0 workers.

### Correções

#### 1. Sanitizar payload no upload-logs (edge function)
**Arquivo:** `supabase/functions/agent-sync/index.ts`

Remover campos que não existem na tabela cloud antes do insert:
```typescript
const sanitizedLogs = logs.map(l => ({
  worker_id: l.worker_id || null,
  device_id: l.device_id || null,
  timestamp: l.timestamp,
  access_status: l.access_status,
  direction: l.direction || 'unknown',
  reason: l.reason || null,
  score: l.score || null,
  worker_name: l.worker_name || null,
  worker_document: l.worker_document || null,
  device_name: l.device_name || null,
}))
```
Isso garante que campos como `synced`, `id` (TEXT do SQLite), `created_at` etc. não quebrem o insert no Postgres.

#### 2. Abrir RLS de `devices` para leitura autenticada
A política atual `Only admins can view devices` impede que usuários com role `user` ou `company_admin` vejam os devices — e sem devices, o dashboard não consegue filtrar os logs por projeto.

Adicionar política:
```sql
CREATE POLICY "Authenticated users can view devices"
ON devices FOR SELECT TO authenticated USING (true);
```
(E remover a política restritiva atual de SELECT.)

#### 3. Não é necessária nenhuma ação manual
Após estas correções:
- **Web**: o dashboard passará a mostrar os dados de teste imediatamente
- **Desktop → Nuvem**: o fast-lane sync enviará logs corretamente quando o dispositivo registrar eventos
- **Nuvem → Web**: o realtime listener + polling de 10s atualizará o dashboard automaticamente

### Arquivos a alterar
- `supabase/functions/agent-sync/index.ts` — sanitizar logs no upload
- **Migração SQL** — ajustar RLS de `devices` para permitir leitura autenticada

