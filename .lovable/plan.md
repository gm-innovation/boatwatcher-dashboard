

## Corrigir sobreposição do header sobre o conteúdo

### Problema
O header é `fixed` (posição fixa), então o conteúdo precisa de `padding-top` suficiente para não ficar escondido atrás dele. O `pt-40` (160px) no MainLayout não é suficiente para a altura real do header, que tem 3 seções: logo (~74px), navegação (~40px) e seletor de projeto (~48px) ≈ 162px+.

### Alteração

**`src/components/layouts/MainLayout.tsx`** (linha 12):

- Header expandido: trocar `pt-40` por `pt-48` (192px) para garantir folga
- Header colapsado: trocar `pt-14` por `pt-24` (96px) pois a barra de logo (~74px) continua visível

