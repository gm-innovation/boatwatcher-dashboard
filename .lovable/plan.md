

## Ajustes na etiqueta PDF

**Arquivo:** `src/components/workers/WorkerManagement.tsx`, linhas 796-824

### Alterações

1. **Aumentar altura da logo**
   - `logoMaxH` de `30` → `38`
   - Manter `logoMaxW = 14` e a lógica proporcional existente

2. **Nome: ajuste automático de fonte para caber em 1 linha**
   - Atualmente usa `splitTextToSize` que permite quebra de linha — isso causa o nome "descer" para segunda linha
   - Nova lógica: começar com `fontSize = 16`, medir a largura do texto com `doc.getTextWidth(cleanName)`. Se ultrapassar o espaço disponível (~45mm), reduzir a fonte progressivamente (loop: -1pt) até caber em uma única linha (mínimo ~10pt)
   - Remover o `splitTextToSize` e o loop de múltiplas linhas — desenhar apenas 1 linha com `doc.text(cleanName, 32, 5, { angle: -90 })`

### Resumo

| Elemento | Antes | Depois |
|---|---|---|
| Logo `logoMaxH` | `30` | `38` |
| Nome | `splitTextToSize` + multi-linha | Loop reduz fonte até caber em 1 linha |

