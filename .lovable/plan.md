

## Corrigir impressão direta das etiquetas

### Situação real
O botão "Imprimir" do relatório Visão Geral usa `window.print()` — imprime o HTML da página, não um PDF. Para etiquetas, o PDF é gerado via jsPDF (62x100mm com textos rotacionados) e não existe como HTML.

### Abordagem viável
Usar `window.open()` com **data URI** em vez de blob URL. Data URIs não são bloqueados pela mesma política de segurança que bloqueia blob URLs em iframes do Lovable. Se ainda assim for bloqueado, fazer fallback para download.

### Alteração

**Arquivo:** `src/components/workers/WorkerManagement.tsx` (linhas 879-895)

Substituir o bloco atual por:

```typescript
const dataUri = doc.output('dataurlstring');
const printWindow = window.open(dataUri);
if (printWindow) {
  printWindow.addEventListener('load', () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  });
} else {
  // Fallback: download se popup bloqueado
  doc.save('etiquetas.pdf');
}
toast({ title: `${workerList.length} etiqueta(s) gerada(s) com sucesso!` });
```

Diferença-chave: `doc.output('dataurlstring')` gera uma data URI completa (`data:application/pdf;base64,...`) que não é bloqueada como blob URLs. O `setTimeout` de 500ms garante que o PDF renderize antes de disparar a impressão.

Se no ambiente Lovable o popup ainda for bloqueado, funcionará no ambiente real (published/desktop). O fallback `doc.save()` garante que o usuário sempre recebe o PDF.

