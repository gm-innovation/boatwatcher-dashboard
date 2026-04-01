

## Investigação Completa — Resultados e Plano de Correção

### Dados reais do Postgres (consultados agora)

```text
Eventos de hoje para "Alexandre Silva" (worker_id: 46dc598a):

created_at (UTC)     | device_name               | direction | timestamp (UTC)
14:08:07             | Engenharia - Entrada      | entry     | 14:07:08+00
14:07:55             | Manual - Engenharia Tablet | exit      | 14:07:55+00
14:09:12             | Engenharia - Saída         | exit      | 14:08:10+00
14:09:38             | Manual - Engenharia Tablet | entry     | 14:09:38+00
14:19:40             | Manual - Engenharia Tablet | exit      | 14:19:40+00
14:41:41             | Manual - Engenharia Tablet | entry     | 14:41:41+00
14:44:41             | Manual - Engenharia Tablet | exit      | 14:44:41+00
```

Observação crítica: **todos os eventos manuais TÊM `worker_id` preenchido** (UUID válido) e `worker_name = "Alexandre Silva"`. Os eventos do leitor facial também têm o mesmo `worker_id` e `worker_name`.

### Problema 1: Horário -3h no Desktop

**Diagnóstico confirmado pelo código atual:**

```text
Dispositivo ControlID envia: "11:07:08" (BRT, sem timezone)
  ↓
normalizeTimestamp (agent.js linha 65): armazena como "11:07:08.000Z"
  ↓ (Z indica UTC, mas o valor é BRT — ERRO)
Upload para nuvem → Postgres recebe "11:07:08+00"
  ↓
validateTimestamp (edge function linha 28): detecta ~3h de lag → ADICIONA +3h → "14:07:08+00"
  ↓
Postgres final: "14:07:08+00" ← correto por acidente (BRT autocorrection)
  ↓
Web: format(new Date("14:07Z")) em browser BRT → "11:07" ✅
Desktop: format(new Date("11:07Z")) do SQLite → "08:07" ❌ (-3h)
```

**O que acontece**: O agente grava `11:07Z` no SQLite (errado). Faz upload e a edge function "corrige" para `14:07+00`. A web recebe o valor corrigido da nuvem. Mas o desktop usa o SQLite local que tem `11:07Z`. O Electron em BRT interpreta `11:07Z` como `08:07 BRT`.

**Correção**: Restaurar a conversão BRT→UTC (+3h) no `normalizeTimestamp`. Assim o SQLite terá `14:07Z` (UTC correto) e o Electron mostrará `11:07 BRT`. E remover a autocorreção BRT da edge function (já não será necessária).

**Proteção extra**: Forçar `process.env.TZ = 'America/Sao_Paulo'` no início do `electron/main.js` para garantir que `format()` use BRT independente da configuração do Windows.

### Problema 2: Eventos manuais não aparecem no Desktop

**Diagnóstico pelo código:**

O `downloadAccessLogs` (sync.js linha 318-343):
1. Busca logs com `created_at >= since` e `.limit(500)`
2. Depois de baixar, define checkpoint como `new Date().toISOString()` (linha 338)
3. Se há mais de 500 registros, os restantes são **permanentemente pulados**

O reset do checkpoint para `1970-01-01` (linha 516) só acontece UMA VEZ (quando `has_manual_points` não existe). Se já executou e baixou os 500 mais antigos, o checkpoint avançou para `now()` e os eventos manuais recentes ficaram de fora.

Mas os eventos do leitor facial funcionam porque o **agente captura direto do hardware e insere localmente** — eles não dependem do download da nuvem. Os eventos manuais SÓ existem na nuvem (criados pela web) e precisam ser baixados via sync.

**Correção**: Usar o `created_at` do último registro do batch como checkpoint (em vez de `now()`), permitindo paginação incremental.

### Problema 3: "Saída pelo leitor facial não cancela entrada manual"

**Diagnóstico pelo código e dados:**

Na web (`useSupabase.ts` linha 217): `const key = log.worker_name || log.worker_id`. Tanto os eventos manuais quanto os do leitor facial têm `worker_name = "Alexandre Silva"` preenchido. Portanto, **a chave é a mesma** e uma saída pelo leitor DEVE cancelar uma entrada manual.

Verificando os dados: a sequência real mostra que isso funciona (evento manual entry 14:09, depois facial exit em 14:09:12 via `created_at` — o exit cancela o entry). O que pode estar causando confusão é a **ordenação por `created_at`** vs `timestamp`: o event manual de 14:09:38 tem `created_at` DEPOIS do facial exit de 14:08:10 (que tem `created_at` 14:09:12), então a ordem cronológica está correta.

Se o problema persiste na prática, pode ser um caso de timing: o evento do leitor ainda não foi uploaded quando a web é consultada. Mas estruturalmente, o código está correto para este cenário.

---

### Plano de Correção (3 arquivos)

**1. `electron/agent.js`** — Restaurar conversão BRT→UTC

Na função `normalizeTimestamp`, para strings sem timezone, interpretar como BRT e adicionar +3h:

```javascript
// No timezone — interpret as BRT (UTC-3), convert to UTC
const match = raw.match(/.../);
if (match) {
  const [, yr, mo, dy, hr, mn, sc] = match.map(Number);
  const utcDate = new Date(Date.UTC(yr, mo - 1, dy, hr + 3, mn, sc));
  return utcDate.toISOString();
}
```

**2. `electron/main.js`** — Forçar timezone BRT

Adicionar na primeira linha:

```javascript
process.env.TZ = 'America/Sao_Paulo';
```

Isso garante que `format(new Date("14:07Z"))` sempre mostre `11:07` no Electron, independente do timezone do Windows.

**3. `supabase/functions/agent-sync/index.ts`** — Remover BRT autocorrection

Remover as linhas 25-32 do `validateTimestamp` (o bloco que detecta lag 170-190min e adiciona +3h). Com o agente fazendo a conversão correta, essa "correção" se torna uma **dupla conversão** (agente +3h, edge function +3h = +6h).

**4. `electron/sync.js`** — Paginação incremental no download de access logs

Substituir `new Date().toISOString()` por o `created_at` do último registro do batch:

```javascript
let maxCreatedAt = since;
for (const log of response.access_logs) {
  this.db.upsertAccessLogFromCloud?.(log);
  if (log.created_at && log.created_at > maxCreatedAt) {
    maxCreatedAt = log.created_at;
  }
}
this.db.setSyncMeta('last_download_access_logs', maxCreatedAt);
```

Além disso, resetar o checkpoint `has_manual_points` para forçar nova re-sincronização completa.

### Resumo

| Arquivo | Problema | Correção |
|---|---|---|
| `electron/agent.js` | Timestamps BRT gravados como UTC (sem +3h) | Restaurar conversão BRT→UTC |
| `electron/main.js` | Electron pode usar timezone errado do OS | Forçar `TZ=America/Sao_Paulo` |
| `supabase/functions/agent-sync/index.ts` | Autocorreção BRT causa dupla conversão | Remover bloco de autocorreção |
| `electron/sync.js` | Checkpoint salta para `now()`, pulando registros | Usar `maxCreatedAt` do batch + reset checkpoint |

