

## Efeito neon no ícone do mapa

### Problema
O marcador atual usa uma imagem estática (`/ship-icon.png`) com um círculo pulsante por trás. O ícone em si não reflete a cor do status (verde/amarelo/vermelho), resultando em pouco impacto visual.

### Solução
Substituir a `<img>` por um **SVG inline de um navio/âncora** que recebe a cor do status como `fill`/`stroke`, e adicionar um **glow neon** via `filter: drop-shadow` com a mesma cor. O círculo pulsante continua atrás, e o ícone SVG ganha o efeito luminoso.

### Alterações

#### `src/components/devices/BrazilMap.tsx` — função `createShipIcon`
- Trocar `<img src="/ship-icon.png">` por um SVG inline de navio (mesmo estilo visual do ícone atual — um navio/embarcação simples)
- Aplicar `fill: ${color}` e `filter: drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})` no SVG para efeito neon
- O círculo pulsante continua como está

#### `src/components/devices/BrazilMapModal.tsx` — função `createShipIcon`
- Mesma alteração (SVG inline + glow neon)

#### Resultado visual
```text
┌─────────────────┐
│  ○ pulse (color) │  ← círculo pulsante (já existe)
│    ⛵ (color)     │  ← SVG do navio com fill=color + drop-shadow neon
└─────────────────┘
```

O ícone ficará com a cor verde/amarelo/vermelho e um brilho neon ao redor, combinando com o pulso.

### Arquivos alterados
| Arquivo | Alteração |
|---|---|
| `src/components/devices/BrazilMap.tsx` | SVG inline + glow neon no `createShipIcon` |
| `src/components/devices/BrazilMapModal.tsx` | SVG inline + glow neon no `createShipIcon` |

