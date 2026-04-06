

## Reverter para download do PDF

### Alteração única em `WorkerManagement.tsx` (linhas 879-892)

Substituir o bloco do iframe por download direto:

```typescript
// De: iframe oculto com print()
// Para: download do PDF
const fileName = overrideCustomName
  ? `etiqueta-${overrideCustomName}.pdf`
  : `etiquetas-${workerList.length}-trabalhadores.pdf`;
doc.save(fileName);
```

Remove as 14 linhas do iframe e substitui por uma única chamada `doc.save()`, que é o comportamento original de download do PDF.

