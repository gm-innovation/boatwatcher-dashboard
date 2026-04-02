

## Redirecionar "Imprimir Crachá" para a mesma lógica de etiquetas

### Abordagem

Nenhum código novo de geração PDF. Apenas passar um callback `onPrintLabel` do `WorkerManagement` para o `WorkerDetailsDialog` que reutiliza o `handlePrintLabels` existente.

### Alterações

**1. `WorkerManagement.tsx`** (~1071-1076)

Criar uma função wrapper que temporariamente seleciona o trabalhador do modal e chama `handlePrintLabels`. Passar como prop:

```tsx
<WorkerDetailsDialog
  worker={selectedWorker}
  open={isDetailsOpen}
  onOpenChange={setIsDetailsOpen}
  onUpdate={() => refetch()}
  onPrintLabel={(worker) => {
    // Salva estado atual, seleciona só este worker, e chama handlePrintLabels
    // Ou cria uma versão simplificada que gera etiqueta para um único worker
  }}
/>
```

Na prática, como `handlePrintLabels` depende de `selectedWorkerIds` e `selectedProjectForLabels`, a forma mais limpa é extrair a lógica interna de geração para uma função auxiliar local (ex: `generateLabelsForWorkers(workersList, projectId)`) que tanto o botão da lista quanto o callback do modal chamam. Isso não cria um novo arquivo — apenas reorganiza o código dentro do mesmo componente.

**2. `WorkerDetailsDialog.tsx`**

- Adicionar prop `onPrintLabel?: (worker: Worker) => void` na interface
- Substituir `<BadgePrinter .../>` por um botão simples que chama `onPrintLabel(worker)`
- Remover import do `BadgePrinter`

**3. `BadgePrinter.tsx`**

- Remover o arquivo (não será mais usado)

### Questão: projeto para a etiqueta

O `handlePrintLabels` requer um projeto selecionado (`selectedProjectForLabels`). Quando o botão está no modal, podemos:
- Usar o primeiro projeto autorizado do trabalhador (`worker.allowed_project_ids[0]`)
- Ou usar o projeto selecionado no contexto global (`useProject`)

Vou usar o projeto do contexto global, que é o mais intuitivo.

