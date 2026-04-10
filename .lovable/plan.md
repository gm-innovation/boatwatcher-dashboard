

# Correção: horário errado no Dashboard (Desktop)

## Diagnóstico confirmado

O dashboard usa dados do servidor local (`getWorkersOnBoard`) que retorna timestamps de eventos faciais como BRT rotulado como UTC (ex: `10:45 BRT` armazenado como `10:45Z`).

- **WorkersOnBoardTable** usa `formatBrtShort()` que subtrai 3h → `10:45Z - 3h = 07:45` (errado)
- **CompaniesOnBoardList** usa `format(new Date(...), 'HH:mm')` (date-fns, fuso do browser) → `08:34Z` no browser BRT = `05:34` (errado)

Os relatórios já foram corrigidos com `useNormalizedAccessLogs` (que adiciona +3h em eventos faciais do servidor local). O dashboard NÃO usa essa normalização.

## Correção (2 arquivos, sem tocar em lógica de negócio)

### 1. Normalizar timestamps no `useWorkersOnBoard` (src/hooks/useSupabase.ts)

Quando o resultado vem do servidor local (`fetchProjectWorkersOnBoard`), aplicar a mesma lógica de normalização dos relatórios: verificar a capability `timestamp_normalized` do servidor e, se ausente, adicionar +3h nos timestamps de `entryTime` e `firstEntryTime` de cada worker retornado (exceto eventos manuais).

Isso corrige os horários na tabela de trabalhadores.

### 2. Corrigir formatação em CompaniesOnBoardList (src/components/dashboard/CompaniesOnBoardList.tsx)

Substituir `format(new Date(company.entryTime), 'HH:mm')` por `formatBrtTime(company.entryTime)` do utilitário `src/utils/brt.ts`.

Isso garante que o horário das empresas use o mesmo padrão BRT explícito do resto do sistema.

## Arquivos que serão alterados
- `src/hooks/useSupabase.ts` — apenas o bloco `usesLocalServer()` dentro de `useWorkersOnBoard`
- `src/components/dashboard/CompaniesOnBoardList.tsx` — apenas a linha de formatação do horário

## Arquivos que NÃO serão tocados
- `server/routes/access-logs.js`
- `electron/database.js`
- `electron/sync.js`
- Relatórios (`WorkerTimeReport`, `PresenceReport`, etc.)
- Dashboard (`Dashboard.tsx`, `StatisticsCards.tsx`, `WorkersOnBoardTable.tsx`)
- Qualquer lógica de sync, banco ou entrada/saída

## Resultado esperado
- Dashboard mostra horários corretos (ex: 10:45 em vez de 07:45)
- Empresas a Bordo mostra horário correto (ex: 08:34 em vez de 05:34)
- Relatórios continuam funcionando como estão

