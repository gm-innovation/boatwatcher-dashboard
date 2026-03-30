

## Substituir o path genérico pelo mapa real do Brasil com estados

### Problema
O `BRAZIL_PATH` atual é um contorno oval genérico que não se parece com o Brasil. O usuário precisa de um mapa reconhecível do Brasil.

### Solução
Substituir o path único por **27 paths SVG reais** (um por estado), extraídos do repositório open-source `felipeduardo/mapa-brasil-svg` (viewBox `0 0 450 460`, licença livre).

### Alterações

**1. `src/components/devices/BrazilMap.tsx`**

- Substituir `BRAZIL_PATH` (string única) por um array/objeto `BRAZIL_STATES` contendo os 27 paths SVG reais dos estados brasileiros
- Atualizar `SVG_HEIGHT` de 400 para 460 (para corresponder ao viewBox real)
- Atualizar as coordenadas de `LOCATION_COORDS` para corresponder ao novo sistema de coordenadas do mapa real. As coordenadas precisam ser recalculadas com base nos paths reais dos estados:
  - Niterói/Rio: ~355, 330 (antes 315, 245)
  - Angra dos Reis: ~340, 340 (antes 295, 248)
  - Manaus: ~98, 119 (antes 105, 85)
  - Salvador: ~360, 210 (antes 340, 155)
  - etc.
- No render do SVG, ao invés de um único `<path d={BRAZIL_PATH}>`, renderizar todos os states como `<path>` individuais com fill muted e stroke de borda

**2. `src/components/devices/BrazilMapModal.tsx`**

- Importar `BRAZIL_STATES` ao invés de `BRAZIL_PATH`
- Renderizar múltiplos paths ao invés de um único
- Atualizar `SVG_HEIGHT` reference

### Detalhes técnicos

- Os paths SVG dos estados vêm do repositório open-source (CC0/atribuição)
- O viewBox muda de `0 0 450 400` para `0 0 450 460`
- Todas as coordenadas do dicionário de localizações serão recalculadas baseadas nas posições reais dos estados no SVG (ex: RJ está ~x:350, y:330; PE está ~x:410, y:165)
- O texto de sigla dos estados (TO, BA, SE, etc.) não será renderizado para manter o mapa limpo — apenas os contornos

