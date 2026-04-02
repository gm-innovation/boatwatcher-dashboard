

## Plano: Cabeçalho da lista, coluna de projetos, checkbox e modal de detalhes

### 1. Cabeçalho acima da lista de trabalhadores
**Arquivo: `src/components/workers/WorkerManagement.tsx`**

Adicionar acima da tabela um cabeçalho no estilo do print:
- Titulo "Trabalhadores Cadastrados" com subtitulo "Gerencie os Trabalhadores"
- Botoes "Atualizar Lista" e "Novo Trabalhador" no canto direito
- Seção de seleção de projetos para etiquetas + botão "Imprimir Etiquetas (N)"
- 4 cards de estatísticas: Total de Trabalhadores, Ativos, Inativos, Empresas (contagem distinta de company_id)
- Filtro por empresa (Select "Todas as Empresas") + campo de busca por nome/código/cargo/empresa/CPF
- Titulo "Lista de Trabalhadores (N)" acima da tabela

### 2. Coluna "Projetos Autorizados" + Checkbox na tabela
**Arquivo: `src/components/workers/WorkerManagement.tsx`**

- Adicionar coluna de checkbox (primeira coluna) com seleção individual e "selecionar todos" no header
- Adicionar coluna "Projetos Autorizados" entre "Empresa" e "Status", mostrando badges com nomes dos projetos autorizados
- Trocar coluna "Ações" por um simples botão "Editar" (como no print)
- Manter estado `selectedWorkerIds` para controlar seleção (usado para impressão de etiquetas em lote)

### 3. Modal de detalhes igual ao print
**Arquivo: `src/components/workers/WorkerDetailsDialog.tsx`**

O modal atual já está muito próximo do print. Ajustes necessários:
- Mover o botão "Editar Dados Básicos" para o topo do modal (abaixo do título, como no print)
- Na seção "Dados Adicionais", ao lado do label, adicionar badge "Editável" e botão "Cancelar Edição" no canto (como no print)
- Adicionar a foto com botão "Alterar Foto" abaixo dela (funcional, com upload)
- Na seção de Projetos Autorizados, mostrar badges com "X" para remover diretamente
- Na seção de Documentos, adicionar botões "Manual" e "Adicionar Documentos" no header do card
- Na seção de Strikes, manter o layout atual (já está correto conforme o print)
- Mover botões "Salvar Alterações" e "Cancelar" para o rodapé fixo do modal

### Arquivos alterados
- `src/components/workers/WorkerManagement.tsx` — cabeçalho completo, checkbox, coluna projetos, busca, filtros
- `src/components/workers/WorkerDetailsDialog.tsx` — layout do modal conforme print

### Resultado esperado
- Cabeçalho com estatísticas, filtros e busca acima da lista
- Tabela com checkbox, coluna de projetos autorizados e botão "Editar"
- Modal de detalhes com foto editável, seções organizadas conforme o print

