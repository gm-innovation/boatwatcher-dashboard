

## Substituir círculo por ícone de navio nos marcadores do mapa

### Resumo
Trocar apenas o `<circle>` sólido (marcador principal) por um path SVG de navio, mantendo o `<circle>` de pulso animado atrás como efeito de destaque.

### Alterações

**1. `src/components/devices/BrazilMap.tsx`**
- Manter o `<circle>` animado (pulso) como está
- Substituir o segundo `<circle>` (marcador sólido) por um `<path>` de silhueta de navio, centralizado via `transform="translate(x,y) scale(s)"`, com `fill={m.color}` e `stroke="hsl(var(--background))"`
- O scale base será proporcional ao radius atual (como já funciona)

**2. `src/components/devices/BrazilMapModal.tsx`**
- Mesma substituição, com scale compensado pelo zoom (`scale / sqrt(zoom)`)

### Path do navio
Uma silhueta simples de cargo ship centrada em (0,0), ~24x16 unidades:
```
M-10,4 C-10,6 10,6 10,4 L8,-1 L6,-1 L6,-5 L2,-5 L2,-1 L-6,-1 L-8,0 Z
```
(casco arredondado embaixo + cabine retangular em cima)

### O que NÃO muda
- Pulso animado (continua sendo circle)
- Cores de status (verde/amarelo/vermelho)
- Labels de texto
- Linhas de conexão para marcadores dispersos
- Lógica de clustering/spread

### Arquivos afetados
- `src/components/devices/BrazilMap.tsx`
- `src/components/devices/BrazilMapModal.tsx`

