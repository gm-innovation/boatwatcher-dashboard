

## Corrigir erro `render2 is not a function` — Abordagem definitiva

### Diagnóstico real

O `package.json` e `bun.lock` já mostram `react-leaflet@4.2.1` com `@react-leaflet/core@2.1.0` (peerDep `react ^18.0.0`). As versões estão corretas. O problema persiste porque o **cache prebundled do Vite** (`node_modules/.vite/deps/`) não foi invalidado — o hash `v=7be910b6` no stack trace é o mesmo desde o início, indicando que o Vite continua servindo os deps antigos (react-leaflet v5 compilado).

Como não é possível limpar o cache Vite manualmente neste ambiente, a solução mais confiável é **remover `react-leaflet` completamente** e usar a API nativa do Leaflet via `useRef`/`useEffect`. Isso elimina toda dependência do wrapper React e resolve o problema de incompatibilidade de Context de forma permanente.

### Mudanças

#### 1. `package.json` — remover react-leaflet
- Remover `"react-leaflet": "4.2.1"` das dependencies
- Manter `"leaflet": "^1.9.4"` e `"@types/leaflet": "^1.9.21"`

#### 2. `src/components/devices/BrazilMap.tsx` — reescrever sem react-leaflet
- Remover imports de `react-leaflet` (`MapContainer`, `TileLayer`, `Marker`, `Popup`, `useMap`)
- Usar `useRef<HTMLDivElement>` + `useEffect` para inicializar `L.map()` diretamente
- Criar markers com `L.marker()` e `L.divIcon()` (mesmos ícones ship com pulso)
- Popups com `marker.bindPopup()`
- Manter toda a lógica de coordenadas, `findCityCoords`, `LOCATION_COORDS`, exports
- Mapa estático (sem zoom/drag) no modo compacto, como antes

```typescript
// Estrutura simplificada
const mapRef = useRef<HTMLDivElement>(null);
const mapInstanceRef = useRef<L.Map | null>(null);

useEffect(() => {
  if (!mapRef.current || mapInstanceRef.current) return;
  const map = L.map(mapRef.current, {
    center: [-14.2, -51.9],
    zoom: compact ? 3 : 4,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  mapInstanceRef.current = map;
  return () => { map.remove(); };
}, []);

// Atualizar markers quando `markers` mudar
useEffect(() => {
  // limpar markers antigos, adicionar novos com L.marker + L.divIcon
}, [markers]);
```

#### 3. `src/components/devices/BrazilMapModal.tsx` — reescrever sem react-leaflet
- Mesma abordagem: `L.map()` direto no `useEffect`
- Modal com zoom/drag habilitados (`scrollWheelZoom: true`, `dragging: true`, `zoomControl: true`)
- Inicializar mapa apenas quando `open === true`
- Chamar `map.invalidateSize()` após abertura do dialog

#### 4. `src/index.css` — manter estilos existentes
- Manter o import do leaflet CSS e animação `marker-pulse` (já existem)

### Benefícios
- Elimina completamente a dependência problemática `react-leaflet`
- Zero risco de incompatibilidade React Context
- Leaflet puro é mais leve e previsível
- Mesma funcionalidade visual (tiles OSM, ship markers, popups, pulso colorido)

