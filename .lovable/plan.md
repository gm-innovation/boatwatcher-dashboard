

## Trocar o path do navio por ícone de navio visto de frente

### Problema
O path atual (`SHIP_PATH`) parece um submarino visto de cima. O usuário quer um ícone de navio visto de frente, como na imagem enviada — casco largo embaixo, cabine/ponte de comando em cima.

### Solução
Substituir o valor de `SHIP_PATH` nos dois arquivos por um novo path SVG que represente um navio de frente: casco arredondado na base, superestrutura com ponte de comando, e uma chaminé/mastro no topo.

### Novo path (navio de frente, centrado em 0,0, ~20x18 unidades)
```
M-9,6 C-9,8 9,8 9,6 L8,2 L6,2 L6,0 L8,0 L8,-2 L4,-2 L4,-6 L2,-6 L2,-8 L-2,-8 L-2,-6 L-4,-6 L-4,-2 L-8,-2 L-8,0 L-6,0 L-6,2 L-8,2 Z
```
Descrição visual:
- Base curva (casco) de -9 a 9
- Corpo retangular (superestrutura) com degraus
- Ponte de comando estreita no topo (cabine)

### Alterações
1. **`src/components/devices/BrazilMap.tsx`** linha 133 — atualizar `SHIP_PATH`
2. **`src/components/devices/BrazilMapModal.tsx`** linha 13 — atualizar `SHIP_PATH`

Nenhuma outra mudança necessária — cores, pulso, scale e labels continuam iguais.

