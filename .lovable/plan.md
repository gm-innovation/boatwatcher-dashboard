

## Corrigir erro `render2 is not a function`

### Causa raiz

`package.json` linha 81 ainda contém `"react-leaflet": "^5.0.0"`. O downgrade anterior não foi aplicado corretamente. react-leaflet v5 usa a API de Context do React 19, incompatível com React 18.3.1.

### Correção

**`package.json`** — alterar linha 81:
- De: `"react-leaflet": "^5.0.0"`
- Para: `"react-leaflet": "^4.2.1"`

Nenhum outro arquivo precisa ser alterado. A API dos componentes (MapContainer, TileLayer, Marker, Popup, useMap) é idêntica entre v4 e v5.

