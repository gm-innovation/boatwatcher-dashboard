

## Corrigir coordenadas do Estaleiro Renave

### Correção

**`src/components/devices/BrazilMap.tsx`** — linha 65:

```typescript
// De:
'renave': { lat: -22.8622, lng: -43.1078, label: 'Estaleiro Renave' },

// Para:
'renave': { lat: -22.864691, lng: -43.130371, label: 'Estaleiro Renave' },
```

O erro de build (`aws s3 cp exit 127`) é um problema temporário de infraestrutura, não relacionado ao código. Basta republicar após a correção.

