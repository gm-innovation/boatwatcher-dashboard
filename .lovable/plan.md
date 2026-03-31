

## Migração do mapa SVG para React-Leaflet (OpenStreetMap)

Substituir o mapa SVG manual por React-Leaflet com tiles reais do OpenStreetMap. Todas as coordenadas passam a ser latitude/longitude reais -- nunca mais ajuste manual de pixels.

### Arquivos modificados

1. **`src/components/devices/BrazilMap.tsx`** — reescrever completamente
   - Instalar `leaflet` + `react-leaflet` (via package.json)
   - Converter `LOCATION_COORDS` de `{x, y}` SVG para `{lat, lng}` reais
   - Substituir o SVG por `<MapContainer>` + `<TileLayer>` do OpenStreetMap
   - Marcadores: usar `<Marker>` com ícone customizado (ship-icon.png) + `<Popup>` para tooltip
   - Pulso colorido por status: CSS animation no marcador
   - Manter Card wrapper com header "Mapa de Operações" e botão Expandir
   - Centro do mapa: Brasil (`-14.2, -51.9`), zoom 4
   - Altura compacta: 280px; compact: 200px
   - Exportar `findCityCoords`, `MapProjectData`, `LOCATION_COORDS` para backward compat

2. **`src/components/devices/BrazilMapModal.tsx`** — reescrever completamente
   - Usar `<MapContainer>` em tela cheia dentro do Dialog
   - Zoom/pan nativo do Leaflet (remover implementação manual)
   - Manter legenda de status (Operacional/Parcial/Crítico)
   - Remover botões manuais de zoom (Leaflet tem controles nativos)

3. **`src/components/devices/mapUtils.ts`** — simplificar
   - `spreadOverlappingMarkers` agora opera em lat/lng com offset em graus (~0.02°) em vez de pixels
   - Remover toda a lógica de `getSpreadDirection` baseada em coordenadas SVG

4. **`src/index.css`** — adicionar import do CSS do Leaflet + estilos customizados para o pulso

### Coordenadas reais (lat/lng) — exemplos principais

| Local | Atual (SVG) | Novo (lat/lng) |
|-------|------------|----------------|
| Baía de Guanabara | 482, 448 | -22.90, -43.17 |
| Angra dos Reis | 460, 453 | -23.00, -44.32 |
| Macaé | 500, 418 | -22.37, -41.79 |
| Santos | 438, 462 | -23.96, -46.33 |
| Vitória | 521, 413 | -20.32, -40.34 |
| Suape | 598, 215 | -8.39, -35.06 |
| Salvador | 545, 280 | -12.97, -38.51 |
| Manaus | 120, 120 | -3.12, -60.02 |

Todas as ~70 localizações serão convertidas para coordenadas reais.

### Dependências

- `leaflet` (tiles + mapa)
- `react-leaflet` (componentes React)
- `@types/leaflet` (tipagem)

### O que melhora

- Coordenadas reais: nunca mais ajuste manual de pixels
- Zoom/pan nativo e fluido
- Tiles reais do OpenStreetMap (ruas, nomes de cidades visíveis)
- Funciona perfeitamente em qualquer resolução
- `brazilStatesData.ts` e `mapUtils.ts` (lógica SVG complexa) ficam muito mais simples

