

## Abrir diálogo de impressão diretamente

### Alteração

Trocar o download do PDF por abertura direta do diálogo de impressão do navegador, usando um iframe oculto.

### Mudança em `WorkerManagement.tsx` (linhas 879-888)

Substituir o bloco de download:

```typescript
// Antes: download do arquivo
const blob = doc.output('blob');
const link = document.createElement('a');
...
```

Por impressão direta via iframe:

```typescript
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.src = url;
document.body.appendChild(iframe);
iframe.onload = () => {
  iframe.contentWindow?.print();
  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  }, 60000);
};
```

Isso abre o diálogo de impressão do navegador diretamente com o PDF da etiqueta, sem baixar arquivo. Funciona tanto para o botão da lista quanto para o botão no modal de detalhes, já que ambos chamam `generateLabels`.

