

## Reverter mapa para versão anterior (sem perder outras alterações)

Vou desfazer **apenas** as mudanças do mapa, mantendo todas as outras alterações (grace period de offline, etc.).

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/index.css` (linha 127) | Trocar filtro de `invert(100%) hue-rotate(180deg) brightness(0.85) contrast(1.2) saturate(0.3)` para `brightness(1.4) contrast(1.1)` (versão original) |
| `src/components/devices/BrazilMap.tsx` (linha 143-144) | `getTileUrl()` volta a usar tile escuro no dark mode: `dark_all` quando escuro, `light_all` quando claro |
| `src/components/devices/BrazilMapModal.tsx` (linha 15-17) | Mesma mudança no `getTileUrl()` |

### Código

**CSS** — filtro simples original:
```css
.dark .leaflet-tile-pane {
  filter: brightness(1.4) contrast(1.1);
}
```

**getTileUrl()** — volta a usar tile escuro no dark mode:
```typescript
function getTileUrl() {
  const dark = document.documentElement.classList.contains('dark');
  return dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}
```

Nenhuma outra alteração será afetada.

