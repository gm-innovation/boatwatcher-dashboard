

## Usar o PNG do navio diretamente no mapa

### Abordagem
Sim, dá para usar o PNG diretamente dentro do SVG do mapa com a tag `<image>`. O ícone será renderizado exatamente como na imagem enviada.

Para manter as cores de status (verde/amarelo/vermelho), o **pulso animado** (circle) continua atrás do ícone com `fill={m.color}`. O ícone do navio em si fica sempre com a aparência original do PNG.

### Implementação

1. **Salvar o PNG** em `public/ship-icon.png` (copiar do upload do usuário)

2. **`src/components/devices/BrazilMap.tsx`**
   - Remover `SHIP_PATH` e o `<path>` do navio
   - Substituir por `<image href="/ship-icon.png" .../>` centralizado nas coordenadas do marcador
   - Manter o `<circle>` animado (pulso) com `fill={m.color}` atrás do ícone
   - Tamanho do ícone proporcional ao `radius` existente

3. **`src/components/devices/BrazilMapModal.tsx`**
   - Mesma substituição, com tamanho compensado pelo zoom

### Resultado visual
- Ícone do navio: sempre igual ao PNG (preto/original)
- Pulso colorido atrás: verde (online), amarelo (parcial), vermelho (offline)
- Labels de texto e linhas de conexão: inalterados

### Arquivos afetados
- `public/ship-icon.png` (novo)
- `src/components/devices/BrazilMap.tsx`
- `src/components/devices/BrazilMapModal.tsx`

