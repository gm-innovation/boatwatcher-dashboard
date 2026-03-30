

## Remover elementos do header da tabela WorkersOnBoardTable

Remover os três elementos selecionados do header da tabela de trabalhadores:
1. Botão "Exportar"
2. Campo de busca (input)
3. Filtro de localização (select)

### Alterações

**Arquivo:** `src/components/dashboard/WorkersOnBoardTable.tsx`
- Remover todo o bloco de filtros (linhas 62-94): botão Exportar, input de busca e select de localização
- Remover imports não utilizados: `Search`, `Download`, `Filter`, `Input`, `Select*`
- Remover states `searchTerm` e `locationFilter`
- Remover lógica de filtragem (`locations`, `filteredWorkers`) — usar `workers` diretamente
- Remover prop `onExport` da interface
- Manter apenas o título "Trabalhadores" com o badge de contagem

**Arquivo:** `src/components/dashboard/Dashboard.tsx`
- Remover `handleExport` e a prop `onExport` passada ao componente
- Remover import de `format` se não for mais usado em outro lugar

