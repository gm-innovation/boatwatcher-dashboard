

## Esconder filtros e título da página na impressão

### Problema
O PDF de impressão ainda mostra o bloco de filtros (Projeto, Data Início, Data Fim, Buscar Dados), o título "Relatórios de Acesso" e as abas — elementos que não fazem sentido em um documento impresso.

### Solução

**Arquivo: `src/pages/Reports.tsx`**
- Adicionar `print:hidden` no título/subtítulo da página
- Adicionar `print:hidden` no bloco de filtros (div com Projeto, datas, Buscar Dados)
- Adicionar `print:hidden` na TabsList (abas)

Isso faz com que apenas o conteúdo do relatório (PresenceReport) apareça na impressão, que já tem seu próprio cabeçalho com nome do projeto e período.

### Arquivos alterados
- `src/pages/Reports.tsx` — 3 classes `print:hidden` adicionadas

