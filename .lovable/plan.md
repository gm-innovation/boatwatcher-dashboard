
Objetivo: corrigir de vez o posicionamento dos marcadores do RJ e evitar que futuros projetos “escapem” para dentro do continente.

1. Confirmar a causa raiz
- O problema não é só a tabela `LOCATION_COORDS`.
- No código atual, os pontos do RJ foram ajustados com base em trechos do path bruto, mas o resultado visual continua errado no mapa renderizado.
- Além disso, `spreadOverlappingMarkers` em `src/components/devices/mapUtils.ts` espalha marcadores em círculo. Em áreas costeiras como Baía de Guanabara, isso inevitavelmente joga parte dos marcadores para dentro do estado quando houver vários projetos.

2. Corrigir o modelo de coordenadas
- Refatorar `LOCATION_COORDS` em `src/components/devices/BrazilMap.tsx` para usar âncoras marítimas/hubs, em vez de coordenadas soltas repetidas.
- Exemplo de hubs:
  - `guanabara_rio`
  - `guanabara_niteroi`
  - `angra`
  - `macae`
  - `acu`
  - `vitoria`
  - `aracruz`
  - `santos`
- Depois, cada alias (`renave`, `maua`, `brasa`, `thomaz`, `brasfels`, `imbetiba`, etc.) passa a apontar para um hub específico.

3. Recalibrar visualmente os pontos do RJ
- Reposicionar todas as localizações do RJ usando a referência do mapa renderizado e os prints enviados, não apenas os números do path.
- Ajustar especialmente:
  - Baía de Guanabara: `rio de janeiro`, `niteroi`, `sao goncalo`, `renave`, `maua`, `inhauma`, `brasa`, `utc`, `triunfo`, `mac laren`, `maclaren`, `alianca`, `thomaz`
  - Costa sul: `angra dos reis`, `brasfels`, `keppel`, `verolme`, `damen`
  - Costa norte: `macae`, `imbetiba`, `sao joao da barra`, `porto do acu`, `acu`
- A correção aqui será “o que bate no SVG final”, não “o que parece certo no path isolado”.

4. Corrigir a lógica de dispersão para futuros projetos
- Substituir a dispersão circular genérica por uma dispersão direcional/em leque para hubs costeiros.
- Em vez de abrir 360°, abrir só no sentido seguro:
  - Guanabara: espalhar sobre a baía/litoral
  - Angra: espalhar para a costa/baía local
  - Macaé/Açu/Vitória/Santos: espalhar para o lado marítimo
- Manter as linhas pontilhadas conectando cada marcador à sua coordenada real.

5. Aplicar a mesma lógica nos dois mapas
- Garantir que o mapa compacto (`BrazilMap.tsx`) e o modal (`BrazilMapModal.tsx`) continuem consumindo a mesma fonte de verdade para coordenadas e dispersão.
- Assim a posição não muda entre card e modal.

6. Validação que farei após implementar
- Testar o caso atual (`Estaleiro Renave`) no modal com zoom alto.
- Verificar se o marcador cai dentro da Baía de Guanabara no ponto indicado pelos seus prints.
- Validar também os grupos futuros:
  - Guanabara com múltiplos estaleiros
  - Angra
  - Macaé/Açu
  - Santos/Guarujá
- Confirmar que nenhum marcador espalhado vai parar “em Minas Gerais” ou no interior do estado.

Detalhes técnicos
- Arquivos principais:
  - `src/components/devices/BrazilMap.tsx`
  - `src/components/devices/mapUtils.ts`
  - `src/components/devices/BrazilMapModal.tsx`
- Mudanças centrais:
  - trocar coordenadas avulsas por hubs reutilizáveis
  - trocar spread circular por spread em arco/fan com direção preferencial por região
- Benefício:
  - corrige o caso atual
  - deixa a entrada de novos projetos consistente e previsível
  - evita regressão visual quando vários estaleiros compartilham a mesma área costeira
