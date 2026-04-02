

## Ajustes na logo da etiqueta PDF

**Arquivo:** `src/components/workers/WorkerManagement.tsx`, linhas 802-811

### Alterações

1. **Aumentar altura da logo**: `logoMaxH` de `24` → `30`
2. **Mover 3 pontos para a esquerda**: x de `44` → `41`

Resultado: `doc.addImage(logoDataUrl, 'PNG', 41, 5, logoW, logoH)` com `logoMaxH = 30`.

