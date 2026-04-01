

## Corrigir Logos Esticadas nos PDFs — Manter Proporção

### Problema
Todos os PDFs usam dimensões fixas para logos (ex: `40x14mm`, `40x15mm`), ignorando a proporção real da imagem. Isso deforma as logos.

### Solução
Criar uma função utilitária que calcula as dimensões respeitando o aspect ratio da imagem dentro de um bounding box (largura máxima × altura máxima). Usar em todos os pontos de inserção de logo.

### Função auxiliar (em `exportWorkerReportPdf.ts`)

```typescript
function fitImageDimensions(
  dataUrl: string,
  maxW: number,
  maxH: number
): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      resolve({ w: img.width * ratio, h: img.height * ratio });
    };
    img.onerror = () => resolve({ w: maxW, h: maxH });
    img.src = dataUrl;
  });
}
```

### Arquivos a alterar

1. **`src/utils/exportWorkerReportPdf.ts`**
   - Adicionar e exportar `fitImageDimensions`
   - Atualizar `drawLogos` para ser `async` e usar `fitImageDimensions` antes de `addImage`

2. **`src/utils/exportReportPdf.ts`**
   - Importar `fitImageDimensions`
   - Atualizar inserção de logos em `exportCompanyReportPdf` para usar a função

3. **`src/utils/exportReports.ts`**
   - Importar `fitImageDimensions`
   - Atualizar `exportToPDF` para usar a função nos dois logos (inmeta e cliente)

### Impacto
- Logos centralizam verticalmente no bounding box mantendo proporção
- Nenhuma mudança visual além de corrigir a deformação

