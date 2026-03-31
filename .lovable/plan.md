

## Corrigir posicionamento do marcador na Baía de Guanabara

### Diagnóstico visual confirmado

Através do browser, confirmei que o marcador "Skandi Botafogo" está posicionado acima e à direita da reentrância costeira. As setas do usuário indicam que precisa ir para ESQUERDA e para BAIXO.

Analisando os vértices do path SVG do RJ:

```text
Costa interna (oeste→nordeste):        Costa externa (leste→sudoeste):
  483.21, 432.49                          515.62, 431.47
  492.72, 427.96                          512.04, 433.90
  495.25, 426.97                          506.07, 435.84
                                          503.24, 437.56
                                          499.74, 441.25
                                          490.65, 447.54

Atual: x:502, y:428 → ACIMA da abertura da baía
Correto: x:~490, y:~440 → DENTRO da abertura, entre as duas costas
```

Na latitude y=440:
- Costa oeste em x ≈ 480
- Costa leste em x ≈ 500
- Centro da água: x ≈ 490

### Correções no arquivo `src/components/devices/BrazilMap.tsx`

**Hub principal:**

| Hub | Atual | Novo | Justificativa |
|-----|-------|------|---------------|
| `guanabara` | 502, 428 | **490, 440** | Centro da água entre as duas costas |
| `angra` | 457, 451 | **460, 453** | Costa sul RJ (path ≈ 457-460, 449-454) |
| `macae` | 500, 418 | **500, 418** | Mantém (costa NE correta) |
| `acu` | 498, 414 | **500, 413** | Leve ajuste para a costa NE |

**Cidades e estaleiros afetados** (todos que apontam para `guanabara`):
- `rio de janeiro`, `niteroi`, `sao goncalo`, `renave`, `maua`, `inhauma`, `brasa`, `utc`, `triunfo`, `mac laren`, `maclaren`, `alianca`, `thomaz` → todos herdam o novo hub (490, 440)

### Dispersão em `mapUtils.ts`

Atualizar a região da Guanabara em `getSpreadDirection` para o novo range de coordenadas:
- Antes: `cx > 490 && cx < 520 && cy > 420 && cy < 435`
- Depois: `cx > 480 && cx < 505 && cy > 435 && cy < 450`
- Manter direção sul (π/2) com leque estreito para espalhar dentro da baía sem ir para terra

### Arquivos modificados
1. `src/components/devices/BrazilMap.tsx` — coordenadas dos hubs marítimos
2. `src/components/devices/mapUtils.ts` — range de detecção da região Guanabara

### Resumo da mudança
Mover o marcador **12 unidades para a esquerda** e **12 unidades para baixo** no SVG, colocando-o no centro da abertura da baía entre as duas linhas costeiras do RJ.

