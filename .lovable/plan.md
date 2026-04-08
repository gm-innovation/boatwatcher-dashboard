

## Correções na Lista de Trabalhadores a Bordo

### 1. Filtro de 24h — remover trabalhadores com entrada antiga

**Arquivo:** `src/hooks/useSupabase.ts` (linhas 295-301)

Adicionar cutoff de 24h ao montar o `workersOnBoard`:

```typescript
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const cutoffTime = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

const workersOnBoard = new Map<string, any>();
for (const [key, state] of workerState) {
  if (state.isOnBoard && state.entry_time > cutoffTime) {
    workersOnBoard.set(key, state);
  }
}
```

Trabalhadores com mais de 24h sem saída serão removidos silenciosamente da lista (mas continuarão nos logs para o relatório de pernoite).

### 2. Tabela sem scroll — otimizar uso do espaço

**Arquivo:** `src/components/dashboard/WorkersOnBoardTable.tsx`

Manter `whitespace-nowrap` em todas as colunas (sem quebra de linha). Ajustar para ocupar melhor o espaço:

- Usar `table-fixed` com `w-full` na `<Table>`
- Reduzir padding de `px-3` para `px-2` em todas as células
- Reduzir font de `text-sm` para `text-xs` nas células de dados
- Coluna Nº: `w-8` (estreita)
- Coluna Entrada: `w-20` (compacta, formato `dd/MM HH:mm`)
- Coluna Local: `w-16`
- Colunas Nome, Função, Empresa: sem largura fixa, distribuem o espaço restante com `truncate` + `max-w-0` para cortar com `...` apenas se realmente não couber
- Adicionar `title={text}` nas células truncáveis para mostrar o texto completo no hover
- Remover `overflow-x-auto`, usar `overflow-hidden`

### Arquivos alterados
1. `src/hooks/useSupabase.ts` — cutoff 24h
2. `src/components/dashboard/WorkersOnBoardTable.tsx` — layout compacto sem scroll

