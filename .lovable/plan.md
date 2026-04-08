

## Remover abreviações dos PDFs — permitir quebra de linha

### Problema
Os três geradores de PDF truncam texto longo com "…" quando ultrapassa a largura da coluna. No PDF há espaço para quebrar linha, diferente da tabela web.

### Locais com truncação

1. **`src/utils/exportReportPdf.ts`** linha 119-121 — tabela genérica (`exportReportPdf`)
2. **`src/utils/exportReportPdf.ts`** linha 329-331 — tabela de empresas (`exportCompanyReportPdf`)
3. **`src/utils/exportWorkerReportPdf.ts`** linha 272-274 — tabela padrão de trabalhadores (`exportStandardWorkerPdf`)

### Correção

Em cada um dos três pontos:

1. Substituir a lógica de truncação por `doc.splitTextToSize(value, maxWidth)` que retorna um array de linhas.
2. Calcular a altura da linha como `Math.max(baseRowHeight, numberOfLines * lineHeight)`.
3. Fazer uma **pré-passagem** por todas as colunas da row para determinar a altura máxima antes de desenhar o fundo alternado e o texto.
4. Ajustar o `y` pelo valor da altura máxima calculada em vez do valor fixo atual (6mm / 5.5mm).

### Arquivos a alterar
- `src/utils/exportReportPdf.ts` (2 pontos)
- `src/utils/exportWorkerReportPdf.ts` (1 ponto)

