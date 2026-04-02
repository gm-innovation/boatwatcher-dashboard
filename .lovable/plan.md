
## Ajuste da logo da etiqueta sem proporção

**Arquivo:** `src/components/workers/WorkerManagement.tsx`

### O que está errado hoje
A lógica atual ainda recalcula a logo com base na proporção da imagem (`ratio`, `logoW`, `logoH`).  
Por isso, quando a altura aumenta, a largura acaba sendo afetada ou a altura final nem cresce do jeito esperado.

### Correção proposta
Fazer exatamente como você pediu:

1. **Manter a largura fixa**
   - `logoMaxW` continua em `14`
   - a largura renderizada da logo não será recalculada

2. **Aumentar apenas a altura**
   - trocar a altura de `51` para cerca de `56`
   - aplicar esse valor diretamente no `addImage`

3. **Remover a lógica proporcional da logo**
   - eliminar o uso de:
     - `naturalW`
     - `naturalH`
     - `ratio`
     - ajuste automático de `logoW`/`logoH`

4. **Manter a ancoragem no canto superior direito**
   - continuar calculando `logoX` com base na largura fixa (`14`)
   - assim a logo cresce só no eixo vertical, sem mexer na largura

### Resultado esperado
A logo ficará **mais alta**, com a **mesma largura atual**, sem redimensionamento proporcional e sem voltar a achatar/alargar por causa da lógica automática.
