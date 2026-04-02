

## Adicionar área de etiquetas com nome customizado

### O que fazer
**Arquivo: `src/components/workers/WorkerManagement.tsx`**

Inserir entre os stats cards (linha 809) e os filtros (linha 811) uma barra de etiquetas contendo:

1. **Layout**: `div` com borda, padding, flex horizontal, items-center, gap
2. **Label**: "Projetos para etiquetas:"
3. **Select de projeto**: Select simples (não multi) com os projetos disponíveis
4. **Campo "Nome customizado (opcional)"**: Input text que aparece **somente quando `selectedWorkerIds.length === 1`** — placeholder "Ex: João Silva (deixe vazio para usar Primeiro)"
5. **Botão verde**: "Imprimir Etiquetas (N)" onde N = `selectedWorkerIds.length`, alinhado à direita

### Estado adicional
- `selectedProjectForLabels: string` (id do projeto selecionado)
- `customLabelName: string` (nome customizado, só usado quando 1 trabalhador selecionado)

### Regra de negócio
- Quando **mais de 1** trabalhador selecionado: campo de nome customizado fica oculto, etiquetas usam nomes cadastrados
- Quando **exatamente 1** trabalhador selecionado: campo de nome customizado aparece; se preenchido, usa esse nome na etiqueta em vez do cadastrado
- Botão desabilitado se nenhum trabalhador selecionado ou nenhum projeto selecionado

### Arquivos alterados
- `src/components/workers/WorkerManagement.tsx`

