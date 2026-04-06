

## Corrigir Avatar Sobrepondo o Cabeçalho da Tabela

### Problema
O `<thead>` da tabela de trabalhadores usa `sticky top-0` mas não tem `z-index`. Os avatares (que têm `overflow: hidden` e `position: relative` do Radix) ficam visualmente acima do cabeçalho ao rolar.

### Alteração — `src/components/workers/WorkerManagement.tsx`

Na linha ~1135, adicionar `z-10` ao `<thead>`:

```tsx
// De:
<thead className="sticky top-0 bg-card border-b">

// Para:
<thead className="sticky top-0 z-10 bg-card border-b">
```

Isso garante que o cabeçalho fique sempre acima do conteúdo das células durante o scroll.

