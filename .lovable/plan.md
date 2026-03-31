

## Ajustar mapa no modo escuro: tonalidade azul + labels mais claros

### Problema
No modo escuro, os tiles do mapa (CartoDB Dark) têm tom cinza/neutro que destoa do design system azul-marinho do app, e os labels/contornos de localização são pouco legíveis.

### Solução
Alterar apenas o filtro CSS do modo escuro para os tiles do Leaflet — sem mexer no modo claro.

### Alteração

**Arquivo:** `src/index.css` (linha ~126)

De:
```css
.dark .leaflet-tile-pane {
  filter: brightness(1.4) contrast(1.1);
}
```

Para:
```css
.dark .leaflet-tile-pane {
  filter: brightness(1.8) contrast(1.4) saturate(0.6) hue-rotate(15deg);
}
```

- `brightness(1.8)` — clareia significativamente labels e linhas de fronteira
- `contrast(1.4)` — destaca contornos e textos contra o fundo escuro
- `saturate(0.6)` — reduz cores saturadas mantendo visual limpo
- `hue-rotate(15deg)` — puxa levemente para o tom azul, alinhando com o `--sidebar-background` e `--sidebar-primary` do dark mode

Nenhuma alteração nos tiles (URLs), no modo claro, ou nos componentes `BrazilMap.tsx` / `BrazilMapModal.tsx`.

