
## Correção da logo da etiqueta

**Arquivo:** `src/components/workers/WorkerManagement.tsx` (trecho da geração da etiqueta PDF)

### O problema
A lógica atual foi ajustada como se o aumento precisasse acontecer no sentido horizontal. Pela sua referência, a logo está visualmente rotacionada no canto superior direito, então o ajuste correto é:
- diminuir a largura no topo
- aumentar a altura descendo pela lateral
- manter a logo ancorada no canto superior direito

### Ajustes propostos
1. **Corrigir a lógica proporcional da logo para a orientação visual dela**
   - Revisar o cálculo de proporção para considerar a logo no sentido rotacionado/vertical.
   - Se necessário, usar as dimensões “invertidas” da imagem no cálculo de encaixe proporcional.

2. **Diminuir a largura máxima da logo**
   - Reduzir `logoMaxW` (hoje `22`) para uma faixa mais estreita, perto de `14–16`.

3. **Aumentar a altura máxima da logo**
   - Elevar `logoMaxH` (hoje `38`) para uma faixa maior, perto de `44–46`.

4. **Ancorar pela borda direita, não por `x` fixo**
   - Em vez de manter `x = 41`, calcular `x` com base em `pageWidth - margem - logoW`.
   - Isso garante que, mesmo ficando mais estreita, a logo continue encostada visualmente no canto superior direito.

5. **Manter a proporção sem achatamento**
   - Continuar usando redimensionamento proporcional.
   - Não aumentar largura para “compensar”; o crescimento deve acontecer na altura visual da logo.

### Resultado esperado
A logo ficará **mais alta e mais estreita**, respeitando o canto superior direito e sem aparência achatada.
