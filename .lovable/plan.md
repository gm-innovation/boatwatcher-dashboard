

## Ajuste fino: Guanabara mais à esquerda e abaixo

O marcador atual está em `x: 490, y: 440`. Vou mover para **`x: 482, y: 448`** (~8px esquerda, ~8px abaixo).

### Mudança

**Arquivo:** `src/components/devices/BrazilMap.tsx` (linha 20)
- De: `guanabara: { x: 490, y: 440, ... }`
- Para: `guanabara: { x: 482, y: 448, ... }`

**Arquivo:** `src/components/devices/mapUtils.ts` — ajustar o range de detecção da região Guanabara para incluir a nova coordenada:
- De: `cx > 480 && cx < 505 && cy > 435 && cy < 450`
- Para: `cx > 475 && cx < 500 && cy > 440 && cy < 458`

Todos os estaleiros/cidades que apontam para o hub `guanabara` herdam automaticamente a nova posição.

