

## Corrigir mapa no modo maximizado: aumentar altura + fix botão Expandir

### Problemas identificados

1. **Mapa pequeno**: O `BrazilMap` usa `compact` que fixa a altura em 260px — muito pequeno para o modo maximizado.
2. **Botão Expandir não funciona**: O layout maximizado usa `z-[100]` (`fixed inset-0 z-[100]`), mas o `DialogContent` do Radix UI usa `z-50` por padrão. O modal do mapa fica **por baixo** do layout maximizado e não aparece.

### Solução

**Arquivo:** `src/components/devices/ConnectivityDashboard.tsx`

1. Remover `compact` do `BrazilMap` no modo maximizado para usar a altura padrão (420px), ou passar uma altura customizada.
2. Mover o `BrazilMapModal` para **fora** do container `fixed z-[100]`, renderizando-o após o fechamento da `div` maximizada, garantindo que o Dialog do Radix UI fique no nível correto do DOM (portaled).

**Arquivo:** `src/components/devices/BrazilMapModal.tsx`

3. Adicionar `z-[200]` ao `DialogContent` para garantir que fique acima do layout maximizado `z-[100]`.

### Alterações específicas

**ConnectivityDashboard.tsx (bloco maximizado, ~linhas 804-834):**
- Remover `compact` do `<BrazilMap>` (ou não passar a prop)
- Mover `<BrazilMapModal>` para fora do bloco condicional `isMaximized`, colocando-o antes do return final do componente (uma única instância compartilhada entre os dois layouts)

**BrazilMapModal.tsx (~linha 140):**
- Adicionar classe `z-[200]` ao `DialogContent` para sobrepor o layout maximizado

