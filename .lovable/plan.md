

## Corrigir erro fatal: `react-leaflet` v5 incompatível com React 18

### Diagnóstico

O erro `render2 is not a function` em `updateContextConsumer` é um problema conhecido: **react-leaflet v5** requer **React 19**, mas este projeto usa **React 18.3.1**. O react-leaflet v5 usa a nova API de Context do React 19, que não existe no React 18.

### Solução

Fazer downgrade de `react-leaflet` para **v4.2.1** (última versão compatível com React 18). A API dos componentes (`MapContainer`, `TileLayer`, `Marker`, `Popup`, `useMap`) é idêntica entre v4 e v5 — nenhuma mudança de código nos componentes será necessária.

### Mudança

**`package.json`**: Alterar `"react-leaflet": "^5.0.0"` para `"react-leaflet": "^4.2.1"`

Nenhum outro arquivo precisa ser modificado — os imports e componentes são os mesmos.

