

## Melhorar contraste do mapa no modo dark

### Problema
O tile CartoDB Dark Matter (`dark_all`) é muito escuro e tem pouco contraste — fronteiras e labels ficam quase invisíveis.

### Solução
Trocar para o tile **Stadia Dark** ou **CartoDB Dark Matter (labels only em cinza claro)** que tem melhor contraste. A melhor opção sem API key é usar o **CartoDB Voyager Dark** ou simplesmente o **dark_nolabels** com um overlay de labels mais claros.

A alternativa mais prática e sem dependência de API key é usar o tile **Stamen Toner Lite** invertido via CSS, ou simplesmente trocar para o tile `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` com um filtro CSS de brightness/contrast no container do mapa.

**Abordagem escolhida**: Aplicar um filtro CSS `brightness(1.4) contrast(1.1)` nos tiles do mapa quando em dark mode. Isso mantém o tile dark mas aumenta significativamente a visibilidade de fronteiras, labels e detalhes geográficos. Sem trocar de provider, sem API key.

### Alterações

#### `src/index.css`
Adicionar regra CSS para aumentar brilho dos tiles no dark mode:
```css
.dark .leaflet-tile-pane {
  filter: brightness(1.4) contrast(1.1);
}
```

#### Arquivos alterados
| Arquivo | Alteração |
|---|---|
| `src/index.css` | Filtro CSS de brightness/contrast nos tiles em dark mode |

