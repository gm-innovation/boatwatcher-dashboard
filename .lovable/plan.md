

## Forçar tema azul com labels brancos no mapa escuro

### Problema
O filtro CSS atual (`brightness(1.8) contrast(1.4) saturate(0.6) hue-rotate(15deg)`) já está aplicado no código, mas o resultado visual nos tiles CartoDB Dark ainda é muito escuro e os labels continuam pouco legíveis. O `hue-rotate` sozinho não é suficiente para transformar o cinza em azul.

### Solução — Abordagem dupla

**1. Trocar a técnica de filtro CSS** (`src/index.css`)

Usar a técnica de **inversão + hue-rotate** que transforma tiles claros em um tema escuro azulado com labels brancos:

```css
.dark .leaflet-tile-pane {
  filter: invert(100%) hue-rotate(180deg) brightness(0.85) contrast(1.2) saturate(0.3);
}
```

E trocar o tile do modo escuro para usar o **tile claro** (OSM ou Positron), que ao ser invertido produz labels brancos sobre fundo escuro azulado — muito mais legível que tentar clarear o CartoDB Dark.

**2. Usar tile claro no modo escuro** (`src/components/devices/BrazilMap.tsx` e `BrazilMapModal.tsx`)

Mudar `getTileUrl()` para usar o **mesmo tile claro** em ambos os modos:

```typescript
function getTileUrl() {
  // Sempre usa tile claro — o CSS inverte no dark mode
  return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}
```

O CartoDB Positron (light_all) tem labels pretos e linhas de fronteira claras. Quando invertido pelo CSS, os labels ficam **brancos** e o fundo fica **escuro azulado** — exatamente o resultado desejado.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/index.css` | Trocar filtro para `invert(100%) hue-rotate(180deg) brightness(0.85) contrast(1.2) saturate(0.3)` |
| `src/components/devices/BrazilMap.tsx` | `getTileUrl()` retorna Positron (light_all) para ambos os modos |
| `src/components/devices/BrazilMapModal.tsx` | Mesma mudança no `getTileUrl()` |

