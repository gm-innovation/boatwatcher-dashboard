

## Colapsar seção do seletor de projeto junto com o header

A terceira seção do header (linhas 233-235) com o `ProjectSelector` ainda aparece quando colapsado porque usa `max-h-0` mas mantém padding residual. Basta escondê-la completamente quando colapsado.

### Alteração

**`src/components/Header.tsx` (linha 233)**
- Mudar a div do ProjectSelector para não renderizar quando colapsado, ou adicionar `hidden` condicional
- De: `max-h-0 py-0` → Para: renderização condicional `{!isHeaderCollapsed && <div>...</div>}`

**`src/components/layouts/MainLayout.tsx`**
- Ajustar padding colapsado de `pt-20` para `pt-14` (apenas a barra com logo + botão toggle)

