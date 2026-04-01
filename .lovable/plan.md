

## Investigação: Desktop com -3h e sem eventos manuais

### Bugs encontrados

#### Bug 1: `created_at` da nuvem NÃO é salvo no SQLite

A função `upsertAccessLogFromCloud` (linha 1628) faz INSERT sem incluir `created_at` — o campo usa o DEFAULT `datetime('now')` do SQLite (hora local da máquina). No UPDATE (linha 1607), `created_at` também não é atualizado.

A query `getWorkersOnBoard` (linha 1118) ordena por `al.created_at ASC` — mas esse `created_at` no SQLite é a hora em que o registro foi inserido localmente, não a hora real da nuvem. Isso corrompe a ordem cronológica dos eventos.

**Impacto**: A lógica de estado final (entry/exit) processa eventos na ordem errada.

#### Bug 2: Timestamps exibidos com -3h (normalização incorreta)

Linha 1177-1178: quando o `timestamp` do SQLite não tem sufixo de timezone, o código adiciona `'Z'` (UTC). Mas timestamps de dispositivos ControlID já foram normalizados com +3h pela captura local e armazenados como UTC no SQLite. Ao adicionar `'Z'`, o frontend interpreta como UTC e subtrai 3h para exibir em BRT → resulta em -3h.

O problema real: timestamps vindos do SQLite via `datetime('now')` geram strings como `2025-04-01 14:30:00` (sem timezone). Ao adicionar `'Z'`, fica correto se a máquina estiver em UTC, mas errado se estiver em BRT.

#### Bug 3: Logs manuais baixados mas `worker_id` anulado

Na `upsertAccessLogFromCloud` (linha 1599-1601), o código verifica se o worker existe localmente. Logs manuais podem referenciar workers que ainda não foram sincronizados → `worker_id` fica null → a query `WHERE al.worker_id IS NOT NULL` (linha 1116) os exclui.

### Correções necessárias

**Arquivo: `electron/database.js`**

1. **`upsertAccessLogFromCloud`**: Incluir `created_at` do payload da nuvem no INSERT e UPDATE
   ```javascript
   // INSERT: adicionar created_at
   INSERT INTO access_logs (id, ..., created_at, synced)
   VALUES (?, ..., ?, 1)
   // com data.created_at || data.timestamp || new Date().toISOString()
   
   // UPDATE: atualizar created_at também
   UPDATE access_logs SET ..., created_at = ?, synced = 1 WHERE id = ?
   ```

2. **`getWorkersOnBoard`**: Remover o filtro `worker_id IS NOT NULL` — logs manuais válidos podem ter worker_id null mas ter `worker_name`
   ```javascript
   // Substituir:
   AND al.worker_id IS NOT NULL
   // Por:
   AND (al.worker_id IS NOT NULL OR al.worker_name IS NOT NULL)
   ```

3. **Normalização de timestamp**: Timestamps do SQLite sem timezone devem ser interpretados como BRT (não UTC)
   ```javascript
   // Substituir: entryTime = entryTime + 'Z'
   // Por: entryTime = entryTime + '-03:00'
   // Já que o SQLite local armazena em hora local BRT
   ```
   
   **Na verdade**, a solução correta é garantir que `created_at` da nuvem (que já vem com timezone) seja preservado. Assim a normalização com `'Z'` não será necessária para dados vindos da nuvem.

**Arquivo: `supabase/functions/agent-sync/index.ts`**

4. Adicionar `created_at` ao SELECT da query de download (linha 1134) — atualmente não inclui `created_at`
   ```typescript
   .select('id, worker_id, device_id, timestamp, access_status, direction, reason, score, worker_name, worker_document, device_name, created_at')
   ```

### Resumo dos arquivos

| Arquivo | Ação |
|---|---|
| `electron/database.js` | Salvar `created_at` da nuvem no upsert; aceitar logs com worker_name sem worker_id; corrigir normalização de timezone |
| `supabase/functions/agent-sync/index.ts` | Incluir `created_at` no SELECT do download-access-logs |

