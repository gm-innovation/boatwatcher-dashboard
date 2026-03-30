

## Resolver sobreposição de marcadores próximos com clustering e dispersão automática

### Problema
Estaleiros na mesma região (ex: Renave, Mauá, Mac Laren, Arsenal da Marinha em Niterói/Rio) têm coordenadas com diferença de 1-3 pixels. Mesmo com zoom máximo de 600%, os marcadores ficam sobrepostos e impossíveis de distinguir.

### Solução
Implementar **dispersão automática em leque** para marcadores que se sobrepõem, distribuindo-os em círculo ao redor do centroide do grupo. Quanto mais zoom, mais próximos do ponto real; no zoom padrão, ficam espaçados o suficiente para serem clicáveis individualmente.

### Alterações

**1. `src/components/devices/BrazilMap.tsx` e `BrazilMapModal.tsx`**

Adicionar lógica de **spread de marcadores sobrepostos**:
- Após calcular os marcadores, agrupar os que estão a menos de `threshold` pixels de distância (ex: 20px no viewBox)
- Para cada grupo com 2+ marcadores, redistribuí-los em círculo ao redor do centroide com raio proporcional ao número de itens
- No modal, o raio de dispersão é compensado pelo zoom (diminui conforme zoom aumenta, pois o zoom já separa visualmente)
- Adicionar linhas finas conectando cada marcador disperso ao ponto real (centroide), para indicar a localização original

```text
Sem dispersão (atual):     Com dispersão:
     ●●●                    ╱ ● Renave
   (sobrepostos)           ● Mauá ─── ✕ (ponto real)
                            ╲ ● Mac Laren
```

**2. Lógica de clustering (função utilitária)**

```typescript
function spreadOverlappingMarkers(markers, minDistance) {
  // Agrupar marcadores próximos
  // Para cada grupo, distribuir em círculo com raio = minDistance
  // Retornar marcadores com posições ajustadas + campo originalX/originalY
}
```

- `minDistance` no card compacto: ~25px (viewBox coords)
- `minDistance` no modal: ~20px, compensado por `1/sqrt(scale)`

**3. Renderização das linhas de conexão**

Para cada marcador disperso, desenhar uma `<line>` fina e translúcida do marcador ao ponto original, para o usuário saber a localização real.

### Arquivos afetados
- `src/components/devices/BrazilMap.tsx` — adicionar spread logic e linhas
- `src/components/devices/BrazilMapModal.tsx` — mesma lógica com compensação de zoom

