

## Ajustes na etiqueta PDF

**Arquivo:** `src/components/workers/WorkerManagement.tsx`

### 3 alterações pontuais

1. **Logo — manter altura original, aumentar largura, mover 4pt para a esquerda**
   - Linha 802-811: voltar `logoMaxH = 24` (altura original que estava correta), aumentar `logoMaxW` de `12` para `14`, e mover x de `48` para `44`
   - `doc.addImage(logoDataUrl, 'PNG', 44, 5, logoW, logoH)`

2. **"Docagem" (tipo do projeto) — mover 3pt para a esquerda**
   - Linha 847: x de `9` → `6`
   - `doc.text(removeAccents(projectType), 6, 5, { angle: -90 })`

3. **Número dentro do círculo — mover 4pt para cima**
   - Linha 862: y de `75` → `71`
   - `doc.text(code, circleX + 7, 71, { align: 'center', angle: -90 })`

