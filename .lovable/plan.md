

# Correção cirúrgica: horário -3h e eventos manuais nos relatórios desktop

## Diagnóstico confirmado

### Problema 1: Horário com -3h (double subtraction)

O agente ControlID armazena no SQLite local o timestamp bruto do hardware como UTC (`new Date(Date.UTC(yr, mo, dy, hr, mn, sc))`), mas o hardware reporta em BRT. Exemplo: evento às 08:34 BRT → armazenado localmente como `08:34:00.000Z` (BRT-como-UTC).

A edge function `agent-sync` corrige +3h no upload para a nuvem, resultando em `11:34:00Z` (UTC correto). Porém, **localmente no SQLite o timestamp permanece `08:34Z`**.

Quando o relatório desktop lê do servidor local e aplica `formatBrtDateTime()` (que subtrai 3h), o resultado é `05:34` — dupla subtração.

```text
Hardware BRT 08:34 → SQLite local 08:34Z (BRT-como-UTC)
                   → formatBrtDateTime -3h → 05:34 ← ERRADO

Nuvem (após upload) 11:34Z (UTC correto)
                   → formatBrtDateTime -3h → 08:34 ← CORRETO
```

**Eventos manuais** não têm esse problema porque usam `new Date().toISOString()` que já retorna UTC correto.

### Problema 2: Eventos manuais não aparecem

Duas causas potenciais:
1. **`ReportsList.tsx` (aba "Todos Trabalhadores")** filtra `log.worker_id` como obrigatório (linha 50). Eventos manuais inseridos localmente podem não ter `worker_id` populado.
2. **Filtro de projeto no SQLite** depende da tabela `manual_access_points` local estar sincronizada. Se não estiver, a subquery retorna vazio e filtra todos os eventos manuais.

## Plano de correção

### 1. Normalizar timestamps locais no servidor Express (`server/routes/access-logs.js`)

Quando o servidor local retorna logs via GET, aplicar correção +3h nos timestamps de eventos faciais que estão armazenados como BRT-como-UTC. Critério: logs com `source = 'facial'` (ou sem source, que é o padrão antigo).

Isso corrige a exibição sem alterar os dados no SQLite nem o fluxo de upload (que já funciona).

**Alternativa considerada e descartada**: corrigir no `agent.js` ao salvar — isso quebraria a heurística da edge function que já adiciona +3h nos uploads, causando double-add.

Arquivo: `server/routes/access-logs.js`

### 2. Incluir eventos manuais nos relatórios (`ReportsList.tsx`)

Remover o filtro `&& log.worker_id` obrigatório, usando fallback para `worker_name` e `worker_document` na identificação.

Arquivo: `src/components/reports/ReportsList.tsx`

### 3. Garantir que `WorkerTimeReport.tsx` reconheça logs sem `worker_id`

O `resolveKey` já faz fallback para `worker_name`, mas precisa garantir que logs manuais (que podem vir sem `worker_id`) sejam processados corretamente na reconciliação.

Arquivo: `src/components/reports/WorkerTimeReport.tsx`

## Arquivos modificados

- `server/routes/access-logs.js` — normalizar timestamp de facial +3h na resposta GET
- `src/components/reports/ReportsList.tsx` — remover filtro obrigatório de `worker_id`
- `src/components/reports/WorkerTimeReport.tsx` — ajuste mínimo se necessário no `resolveKey`

## O que NÃO muda

- `electron/agent.js` — continua salvando timestamp raw (edge function depende disso)
- `electron/sync.js` — upload continua igual
- `supabase/functions/agent-sync/index.ts` — heurística de +3h intocada
- `src/utils/brt.ts` — funções de formatação intocadas
- Dashboard e fluxos de entrada/saída — já funcionando

## Detalhes técnicos

```text
Correção de timestamp no GET /api/access-logs:

for (const log of logs) {
  if (log.source !== 'manual') {
    // Facial events stored as BRT-as-UTC → add +3h to normalize to real UTC
    const d = new Date(log.timestamp);
    d.setUTCHours(d.getUTCHours() + 3);
    log.timestamp = d.toISOString();
  }
}
```

```text
Correção em ReportsList.tsx linha 50:

ANTES: accessLogs.filter(log => log.access_status === 'granted' && log.worker_id)
DEPOIS: accessLogs.filter(log => log.access_status === 'granted' && (log.worker_id || log.worker_name))
```

