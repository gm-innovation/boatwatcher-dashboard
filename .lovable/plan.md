

## Remover fundo/borda ao redor da logo do cliente

A classe `bg-muted p-2 rounded-lg` na tag `<img>` da logo cria o efeito de "quadrado" visível. Basta removê-las, mantendo apenas o tamanho e `object-contain`.

### Alteração

**`src/components/dashboard/ProjectInfoCard.tsx` (linha 56)**

- De: `className="h-16 w-20 object-contain rounded-lg bg-muted p-2"`
- Para: `className="h-16 w-20 object-contain"`

