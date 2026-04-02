

## Correções na etiqueta PDF

**Arquivo:** `src/components/workers/WorkerManagement.tsx`

### Problemas identificados

1. **Logo achatada**: `logoMaxW = 14` está muito restritivo — limita a largura e achata a imagem. Precisa aumentar para ~22 para que a proporção natural da logo seja respeitada.

2. **Nome muito pequeno**: O espaço disponível está configurado como `45mm`, mas o círculo começa em `y = 64` (centro 80 - raio 16). O nome começa em `y = 5`, então há ~59mm disponíveis. Com margem de segurança, podemos usar `55mm` — isso permite que nomes mais longos mantenham uma fonte maior.

### Alterações (linhas 802-824)

1. **Logo** — `logoMaxW` de `14` → `22` (mantém `logoMaxH = 38`)
2. **Nome** — espaço máximo de `45` → `55` no loop de redução de fonte, e fonte mínima de `10` → `8` como fallback extremo

