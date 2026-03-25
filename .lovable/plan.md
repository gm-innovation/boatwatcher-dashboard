

## Limpar Dashboard — Apenas Dados em Tempo Real

### O que será removido
- Seletor de período (Select "Hoje / 7 dias / 30 dias")
- Indicador "Último evento: ..."
- Mensagem "Nenhum acesso registrado hoje. Último evento em..."
- Imports não utilizados (`CalendarClock`, `AlertCircle`, `Badge`, `Select*`, `useState` do dateFilter, `useLastAccessLog`)

### O que permanece
O dashboard volta ao comportamento direto: sempre mostra dados de **hoje** em tempo real, sem filtros ou mensagens contextuais.

### Alterações

**Arquivo: `src/components/dashboard/Dashboard.tsx`**
1. Remover state `dateFilter` e hook `useLastAccessLog`
2. Chamar `useWorkersOnBoard(projectId)` sem segundo argumento (default já é `'today'`)
3. Remover todo o bloco JSX do seletor de período (linhas 97-136)
4. Limpar imports não utilizados (`CalendarClock`, `AlertCircle`, `Badge`, `Select*`)

Nenhum outro arquivo precisa ser alterado — `useWorkersOnBoard` já tem `'today'` como default.

