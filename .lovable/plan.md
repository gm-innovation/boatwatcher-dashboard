

## Corrigir geração da etiqueta PDF

### Análise
O código atual da função `handlePrintLabels` replica a lógica do sistema em produção, mas existem potenciais problemas com a versão do jsPDF (v3 vs v2.5.1 usada na referência) que podem afetar coordenadas de texto rotacionado e o método `splitTextToSize`.

### Correções planejadas

**Arquivo: `src/components/workers/WorkerManagement.tsx`**

1. **Garantir compatibilidade com jsPDF v3**: O parâmetro `angle` na v3 pode ter comportamento diferente. Validar que `doc.text(str, x, y, { angle: -90 })` funciona corretamente, e caso necessário usar a API de transformação matricial (`doc.internal.write` com rotação manual).

2. **Corrigir coordenadas dos `nameLines`**: Na iteração das linhas do nome, o incremento `i * 24` move cada linha 24mm ao longo do eixo Y (que vira horizontal com a rotação). Se o nome tiver 2 linhas, a segunda linha ficaria a 24mm de distância — pode ser demais. Ajustar para `i * 8` (espaçamento proporcional ao tamanho da fonte 16pt ≈ 5.6mm).

3. **Adicionar tratamento robusto do `splitTextToSize`**: Forçar o tipo de retorno como `string[]` para evitar problemas com tipagem no v3.

4. **Abrir PDF em nova aba**: Em vez de `doc.save()`, usar `window.open(doc.output('bloburl'))` para permitir visualização antes de impressão, mantendo `doc.save()` como fallback.

### Detalhes técnicos

- O `splitTextToSize(text, 45)` com texto rotacionado -90° está correto: 45mm corresponde ao espaço disponível ao longo da altura da página (de y=5 até ~y=50, antes do círculo em y=80)
- O incremento entre linhas do nome deve ser ~6-8mm (não 24mm como no código de referência — na verdade 24mm é o espaçamento no eixo X quando o texto está rotacionado, movendo cada linha para a esquerda)
- Verificar que `circle()` e `addImage()` funcionam identicamente na v3

### Arquivos alterados
- `src/components/workers/WorkerManagement.tsx` — corrigir e validar `handlePrintLabels`

