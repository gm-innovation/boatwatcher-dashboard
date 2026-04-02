
## Corrigir a etiqueta copiando exatamente o layout do sistema em produção

### Diagnóstico
O problema não é o tamanho da página. O PDF continua em `62x100mm`, mas o layout atual foi alterado demais em relação ao código que você enviou como referência. Hoje o arquivo está usando coordenadas, fontes e proporções diferentes do modelo correto, por isso piorou.

### O que vou fazer
**Arquivo:** `src/components/workers/WorkerManagement.tsx`

1. **Parar de “ajustar no olho”**
   - Remover os deslocamentos inventados nas últimas tentativas.
   - Usar o código do sistema em produção como fonte de verdade.

2. **Restaurar exatamente o bloco visual da etiqueta**
   - Manter:
     - página `62x100`
     - borda `rect(3, 3, pageWidth - 6, pageHeight - 6)`
     - logo em `x=52, y=5, w=8, h=24`
   - Restaurar exatamente estas posições e tamanhos:
     - **Nome:** `font 16 bold`, ou `14` se quebrar em mais de 2 linhas, com:
       - `doc.text(line, 36, 5 + (index * 24), { angle: -90 })`
     - **Função:** `font 12`, `x=30, y=5`
     - **Empresa:** `font 10`, `x=26, y=5`
     - **Projeto:** `fontSize = 9..14`, `x=14, y=5`
     - **Tipo do projeto:** `font 12`, `x=8, y=5`
     - **Círculo:** `circle(40, 80, 16)`
     - **Código:** `font 25 bold`, `doc.text(code, 45, 80, { align: 'center', angle: -90 })`
     - **Powered by:** `font 6`, `x=5, y=40`
     - **Tipo sanguíneo label:** `font 7`, `x=16, y=75`
     - **Tipo sanguíneo valor:** `font 12 bold`, `x=12, y=80`

3. **Manter só o que já estava funcionando**
   - Continuar usando o download por `<a>` temporário, porque isso resolve o bloqueio do navegador.
   - Manter busca de logo, projeto, empresa e cargo como já está no componente.

4. **Eliminar diferenças desnecessárias em relação ao código de referência**
   - O layout atual reduziu fonte do nome, mexeu no círculo, empurrou blocos para a direita e mudou o rodapé.
   - Vou alinhar tudo de volta ao código que você forneceu, sem reinterpretar coordenadas.

### Resultado esperado
A etiqueta volta a seguir o mesmo desenho do modelo correto:
- logo no topo à direita
- nome grande ao lado da logo
- função e empresa no centro
- projeto e tipo à esquerda
- círculo maior com código na parte inferior
- “Powered by Googlemarine” e tipo sanguíneo nas posições originais

### Detalhes técnicos
A correção será uma **substituição direta do bloco de desenho atual** pelo equivalente do código de produção que você colou, adaptando apenas os nomes dos campos já usados no componente React. Isso reduz o risco e evita novas tentativas por aproximação.
