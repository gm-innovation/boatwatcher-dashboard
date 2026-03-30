
Objetivo: corrigir o RJ de forma definitiva para que o navio fique exatamente na reentrância da Baía de Guanabara, e não no mar aberto nem no interior.

1. Corrigir a causa real
- O erro atual não é só “coordenada ruim”.
- Hoje existe um único hub `guanabara` em `src/components/devices/BrazilMap.tsx` com `x: 522, y: 432`, que já nasce longe demais da baía.
- Depois disso, `spreadOverlappingMarkers` em `src/components/devices/mapUtils.ts` ainda empurra os marcadores para leste, piorando o desvio.
- Resultado: mesmo com ajuste manual, o barco continua fora da reentrância correta.

2. Trocar o modelo de coordenadas do RJ
- Substituir o hub único da Guanabara por âncoras específicas da baía.
- Em vez de uma coordenada genérica “no oceano”, separar pelo menos:
  - `guanabara_rio`
  - `guanabara_niteroi`
  - `guanabara_sao_goncalo`
  - `angra`
  - `macae`
  - `acu`
- Cada alias (`renave`, `maua`, `inhauma`, `brasa`, `thomaz`, `maclaren`, etc.) passará a apontar para a âncora correta dentro da reentrância ou no trecho costeiro certo.

3. Recalibrar todas as coordenadas do RJ com base no mapa renderizado
- Ajustar a Baía de Guanabara para a reentrância mostrada no seu print, usando o SVG final como referência visual.
- Revisar todas as localizações marítimas do RJ:
  - Baía de Guanabara: `rio de janeiro`, `niteroi`, `sao goncalo`, `renave`, `maua`, `inhauma`, `brasa`, `utc`, `triunfo`, `mac laren`, `maclaren`, `alianca`, `thomaz`
  - Costa sul: `angra dos reis`, `brasfels`, `keppel`, `verolme`, `damen`
  - Costa norte: `macae`, `imbetiba`, `sao joao da barra`, `porto do acu`, `acu`
- Também revisar ES/SP próximos para manter consistência visual: `vitoria`, `aracruz`, `santos`, `guaruja`, `wilson sons`.

4. Tornar a dispersão específica por região
- A lógica atual usa apenas `x/y`, então ela não sabe que Guanabara é baía e não mar aberto.
- Vou planejar uma dispersão guiada por metadados da localização, por exemplo:
  - `spreadRegion: "guanabara"`
  - `spreadRegion: "angra"`
  - `spreadRegion: "norte_rj"`
- Para Guanabara, o leque deixará de abrir para leste e passará a abrir dentro da área segura da baía/reentrância.
- Para Angra, Macaé, Açu, Vitória e Santos, o leque continuará regional, mas sem jogar marcador para dentro do continente.

5. Manter uma única fonte de verdade
- `BrazilMapModal.tsx` já reutiliza `findCityCoords` e `spreadOverlappingMarkers`.
- Vou manter isso, para que card e modal usem exatamente:
  - as mesmas coordenadas
  - a mesma regra de dispersão
- Assim a posição não muda entre o mapa pequeno e o expandido.

6. Validação após implementar
- Conferir o caso atual do seu print: `Skandi Botafogo`/Renave na reentrância da Baía de Guanabara.
- Verificar grupos múltiplos na mesma região:
  - Guanabara
  - Angra
  - Macaé / Açu
- Confirmar que nenhum marcador:
  - vai para “Minas Gerais”
  - vai para mar aberto quando deveria estar na baía
  - muda de lugar entre card e modal

Detalhes técnicos
- Arquivos principais:
  - `src/components/devices/BrazilMap.tsx`
  - `src/components/devices/mapUtils.ts`
  - `src/components/devices/BrazilMapModal.tsx`
- Mudanças centrais:
  - remover a premissa atual de que Guanabara deve ficar “fora do estado/no oceano”
  - criar hubs separados para a baía
  - adicionar metadados de dispersão por região
  - recalibrar todas as coordenadas costeiras do RJ usando a reentrância do SVG final como referência
