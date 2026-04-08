

## Diagnóstico real — causa raiz confirmada com dados

### Problema 1: Entrada/saída facial não funciona

**Evidência do banco de dados cloud:**
- Eventos faciais DO dia 08/04 (17:13, 17:16, 17:18, 17:30, 19:32) estão TODOS com `worker_id = NULL` e `worker_name = NULL`
- O único evento facial que funcionou (11:17) tem `worker_id` e `worker_name` corretos
- Eventos manuais estão todos com `worker_id` e `worker_name` corretos

**Causa raiz**: O agente local (`electron/agent.js`) captura o evento do hardware com `user_id = 350` (código inteiro do ControlID). Faz lookup no SQLite local por `code = 350`. Quando funciona, popula `worker_id`, `worker_name`, `worker_document`. Quando FALHA (ex: após reinício/update do app, antes do sync de workers completar), os três campos ficam NULL. O upload para a nuvem NÃO inclui o código original do hardware. Resultado: a nuvem não tem como resolver o trabalhador.

**Por que o relatório não mostra os dados faciais**: O código do relatório (WorkerTimeReport, CompanyReport, etc.) faz `resolveKey(log)` → se `worker_id`, `worker_name` e `worker_document` são todos null, retorna string vazia → `if (!key) continue` → evento é ignorado silenciosamente.

### Problema 2: Relatórios com horário -3h

Os timestamps no banco cloud estão corretos em UTC (verificado: evento às 19:32:04 UTC = 16:32:04 BRT, confirmado pelo screenshot do dispositivo). O `format(new Date(...), 'HH:mm')` do date-fns usa timezone local do sistema. Se o sistema está em BRT, exibe corretamente. O horário -3h pode ter sido causado pelos filtros de data antigos que usavam `T00:00:00Z` em vez de `T03:00:00Z` (já corrigido na v1.3.60), ou por alguma inconsistência no ambiente Desktop.

### Problema 3: Token obsoleto

Há um segundo token (`84ed5d35...`) fazendo requisições constantes que falham. Isso indica uma instância duplicada do servidor local rodando com credenciais antigas. Não causa os problemas acima mas polui os logs.

---

## Plano de correção — 3 alterações cirúrgicas

### Alteração 1: Incluir código do hardware no access log local

**Arquivo: `electron/agent.js`** — método `processEvent` (~linha 592)

Adicionar campo `hardware_user_id` ao objeto `accessLog`:
```javascript
const accessLog = {
  worker_id: workerId,
  device_id: device.id,
  timestamp: event.timestamp,
  // ... campos existentes ...
  hardware_user_id: event.user_id || null,  // NOVO: código original do ControlID
};
```

**Arquivo: `electron/database.js`** — método `insertAccessLog` (~linha 1334)

Aceitar e armazenar `hardware_user_id` no SQLite (nova coluna na tabela `access_logs`). Adicionar migration na inicialização do banco:
```sql
ALTER TABLE access_logs ADD COLUMN hardware_user_id TEXT;
```

### Alteração 2: Resolver worker por código na nuvem

**Arquivo: `supabase/functions/agent-sync/index.ts`** — seção `upload-logs` (~linha 399)

Quando `worker_id` é null mas `hardware_user_id` está presente, fazer lookup por `code`:
```typescript
if (!workerId && log.hardware_user_id) {
  const code = Number(log.hardware_user_id);
  if (!isNaN(code) && code > 0) {
    const { data: byCode } = await supabase
      .from('workers')
      .select('id, name, document_number')
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle();
    if (byCode) {
      log.worker_id = byCode.id;
      log.worker_name = log.worker_name || byCode.name;
      log.worker_document = log.worker_document || byCode.document_number;
    }
  }
}
```

Remover `hardware_user_id` antes de inserir no Postgres (não existe na tabela cloud):
```typescript
delete log.hardware_user_id;
```

### Alteração 3: Corrigir eventos históricos já na nuvem

**Migration SQL**: Atualizar os eventos faciais de hoje que têm `worker_id = NULL` mas vieram de dispositivos onde o ControlID reconheceu o trabalhador. Como não temos `hardware_user_id` nos eventos antigos, podemos usar correlação temporal: se existe um evento manual com worker_id dentro de ±5 min de um evento facial sem worker_id, inferir que é o mesmo trabalhador.

Ou mais seguro: simplesmente adicionar uma coluna `hardware_user_id` à tabela cloud `access_logs` para referência futura (não obrigatória para a correção funcionar, já que o upload-logs resolve antes de inserir).

---

## Resultado esperado
- Facial: quando o lookup local falhar, a nuvem resolve pelo código → `worker_id` é preenchido → relatórios mostram os dados
- Manual: nenhuma alteração, continua funcionando
- Relatórios: uma vez que `worker_id` está preenchido, todos os relatórios (WebView, PDF, CSV) incluem os dados automaticamente
- Timestamps: sem alteração (já corretos)

## Arquivos alterados
1. `electron/agent.js` — 1 ponto (adicionar `hardware_user_id` ao accessLog)
2. `electron/database.js` — 2 pontos (migration de coluna + insertAccessLog)
3. `supabase/functions/agent-sync/index.ts` — 1 ponto (resolução por code no upload-logs)
4. `electron/sync.js` — 1 ponto (incluir `hardware_user_id` no upload, não stripped)

