

## Corrigir impressão direta das etiquetas

### Problema
O iframe com `display: none` não permite que `window.print()` funcione na maioria dos navegadores.

### Solução
Usar a mesma abordagem do relatório de Visão Geral: abrir o PDF em uma nova aba com `window.open()` e chamar `print()` nessa janela. Simples e funcional.

### Alteração

**Arquivo:** `src/components/workers/WorkerManagement.tsx` (linhas 879-892)

Substituir o bloco do iframe por:

```typescript
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
const printWindow = window.open(url, '_blank');
if (printWindow) {
  printWindow.onload = () => {
    printWindow.print();
  };
} else {
  // Fallback: download se popup bloqueado
  const link = document.createElement('a');
  link.href = url;
  link.download = `etiquetas.pdf`;
  link.click();
}
setTimeout(() => URL.revokeObjectURL(url), 120000);
```

Isso abre o PDF numa nova aba e dispara o diálogo de impressão automaticamente — igual ao comportamento do relatório de Visão Geral.

