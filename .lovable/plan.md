

## Ajustes pontuais na etiqueta PDF

**Arquivo:** `src/components/workers/WorkerManagement.tsx`

### Alterações (todas na função `handlePrintLabels`, linhas ~796-855)

1. **Logo — corrigir deformação e mover para a esquerda**
   - Atual: `doc.addImage(logoDataUrl, 'PNG', 52, 5, 8, 24)` — proporção 1:3 estica a imagem
   - Novo: calcular proporção real da imagem carregada (largura/altura) e usar dimensões proporcionais; mover x de `52` para um valor mais à esquerda (ex: `48`), com tamanho tipo `12x12` ou proporcional ao logo real
   - Todos os textos que estavam à esquerda da logo (nome, função, empresa, projeto, tipo) deslocam ~4 pontos para a esquerda também

2. **Tipo do projeto ("Docagem")** — linha 834
   - Font de `12` → `11`
   - x de `8` → `9` (1 ponto mais próximo de "Skandi Botafogo")

3. **"Powered by Googlemarine"** — linha 855
   - Font de `6` → `7`

4. **Número dentro do círculo** — linha 849
   - x: de `circleX + 5` (45) → `circleX + 7` (47) — 2 pontos para a direita
   - y: de `circleY` (80) → `75` — 5 pontos para cima

### Resumo de coordenadas

| Elemento | Antes | Depois |
|---|---|---|
| Logo | `(52, 5, 8, 24)` | `(48, 5, proporcional)` |
| Nome | `x=36` | `x=32` |
| Função | `x=30` | `x=26` |
| Empresa | `x=26` | `x=22` |
| Projeto | `x=14` | `x=10` |
| Tipo projeto | `x=8, font 12` | `x=9, font 11` → ajuste de -1pt e +1 proximidade |
| Código | `(45, 80)` | `(47, 75)` |
| Powered by | `font 6` | `font 7` |

