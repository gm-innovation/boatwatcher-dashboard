

## Corrigir coordenadas da etiqueta PDF para jsPDF v3

### Problema
As coordenadas do código de produção (jsPDF v2.5.1) não funcionam no jsPDF v3 instalado no projeto. O parâmetro `angle: -90` trata as coordenadas (x, y) de forma diferente entre versões — no v3, o X controla a posição horizontal (esquerda-direita) diretamente.

### Validação
Testei iterativamente com jsPDF v3 no sandbox e encontrei as coordenadas corretas que reproduzem o layout da referência.

### Alterações em `src/components/workers/WorkerManagement.tsx`

Reescrever a seção de coordenadas da função `handlePrintLabels` (~linhas 802-871):

| Elemento | Coordenadas atuais | Coordenadas corretas |
|---|---|---|
| Nome | x=36-(i*7), y=5 | x=48-(i*7), y=5 |
| Função | x=30, y=5 | x=42, y=5 |
| Empresa | x=26, y=5 | x=37, y=5 |
| Projeto | x=14, y=5 | x=22, y=5 |
| Tipo projeto | x=8, y=5 | x=16, y=5 |
| Código (font) | 25pt, x=circleX+5 | 20pt, x=43, y=80 |
| Powered by | x=5, y=40 | x=5, y=30 |
| Tipo sanguíneo label | x=16, y=75 | x=18, y=78 |
| Tipo sanguíneo valor | x=12, y=80 | x=13, y=82 |
| Função (font) | 12pt | 10pt |
| Empresa (font) | 10pt | 9pt |

### Resultado esperado
Layout idêntico às imagens de referência: nome grande à direita, dados empilhados para a esquerda, código dentro do círculo centralizado, logo no canto superior direito.

