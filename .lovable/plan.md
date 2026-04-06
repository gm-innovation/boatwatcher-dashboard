

## Ajustar Espaçamento das Colunas da Tabela de Trabalhadores

### Problema
As 9 colunas (Checkbox, Código, Trabalhador, CPF, Empresa, Projetos Autorizados, Função, Status, Ações) estão todas com `p-4` e sem larguras definidas, fazendo com que Status e Ações fiquem comprimidos ou fora da área visível.

### Solução
Definir larguras proporcionais (`w-`) em cada `<th>` e `<td>` para distribuir o espaço de forma equilibrada, e reduzir o padding de `p-4` para `px-2 py-3` nas colunas mais estreitas.

### Alteração — `src/components/workers/WorkerManagement.tsx`

**Headers (linhas 1137-1151)**: Aplicar classes de largura fixa/proporcional:
- Checkbox: `w-10` (já está)
- Código: `w-[70px]`
- Trabalhador: `w-[200px]`  
- CPF: `w-[130px]`
- Empresa: `w-[160px]`
- Projetos Autorizados: `min-w-[140px]`
- Função: `w-[130px]`
- Status: `w-[90px]`
- Ações: `w-[100px]`

Reduzir padding de `p-4` para `px-2 py-3` em todas as colunas (exceto checkbox que mantém `p-3`).

**Cells (linhas 1158-1196)**: Aplicar as mesmas classes de largura e padding reduzido nos `<td>` correspondentes.

Usar `table-fixed` na `<table>` para forçar as larguras definidas e adicionar `min-w-[1050px]` para garantir scroll horizontal em telas menores.

