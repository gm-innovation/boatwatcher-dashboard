

## Dismiss toast ao voltar para o teclado

O toast de confirmação fica visível mesmo após o retorno automático ao teclado. A solução é capturar o `id` retornado pelo `toast()` e chamar `dismiss(id)` dentro do `setTimeout`, antes de `handleNewAccess()`.

### Alteração em `src/pages/AccessControl.tsx`

Na função `handleConfirm`, guardar o retorno do `toast()` e dismissá-lo no timeout:

```typescript
const { dismiss } = toast({
  title: direction === 'entry' ? '✅ Entrada registrada' : '🔴 Saída registrada',
  description: `${selectedWorker.name} - ${terminal.name}`,
});

setTimeout(() => {
  dismiss();
  handleNewAccess();
}, 1200);
```

Somente este trecho precisa ser alterado — 1 arquivo, ~3 linhas.

