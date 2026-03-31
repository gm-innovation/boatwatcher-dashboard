

## Corrigir coordenadas do Estaleiro Renave — Ilha do Viana

### Problema
O marcador do Estaleiro Renave usa coordenadas genéricas da Baía de Guanabara. O estaleiro fica na **Ilha do Viana**, Niterói (coordenadas reais: 22°51'44"S 43°6'28"W).

### Correção

**`src/components/devices/BrazilMap.tsx`** — Atualizar entrada `'renave'`:

```typescript
// De:
'renave': { ...MARITIME_HUBS.guanabara, label: 'Estaleiro Renave' },

// Para:
'renave': { lat: -22.8622, lng: -43.1078, label: 'Estaleiro Renave' },
```

Apenas um campo alterado, nenhum outro arquivo afetado.

