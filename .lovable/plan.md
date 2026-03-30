

## Revisão e correção de todas as coordenadas do mapa

### Problema
As coordenadas foram colocadas de forma aproximada e vários locais estão deslocados. Exemplo: Renave (Baía de Guanabara) aparece na posição de Macaé. Isso vai causar erros em todos os projetos futuros que usarem essas localizações.

### Método de correção
Usar os paths SVG dos estados como referência geográfica para posicionar as cidades/estaleiros corretamente. Exemplo: o path do estado do RJ define seus limites — Rio, Niterói, Angra devem cair dentro dele, e Macaé deve ficar mais ao norte na costa.

### Coordenadas a corrigir

Analisando o mapa SVG e as posições relativas dos estados:

**Região RJ/ES (maioria dos problemas):**
| Local | Atual | Corrigido | Motivo |
|-------|-------|-----------|--------|
| `rio de janeiro` | 500, 435 | 490, 430 | Ajustar para costa da Baía de Guanabara |
| `niteroi` | 505, 432 | 493, 428 | Lado leste da Baía de Guanabara |
| `sao goncalo` | 503, 430 | 495, 426 | Norte de Niterói |
| `renave` | 505, 435 | 493, 429 | Baía de Guanabara (Niterói), não Macaé |
| `maua` | 505, 433 | 492, 429 | Baía de Guanabara |
| `inhauma` | 498, 430 | 490, 428 | Zona norte do Rio, na baía |
| `brasa` | 500, 432 | 491, 429 | Zona portuária do Rio |
| `utc` | 506, 434 | 492, 430 | Baía de Guanabara |
| `triunfo` | 506, 434 | 492, 430 | Baía de Guanabara |
| `mac laren` / `maclaren` | 504, 436 | 493, 430 | Niterói |
| `alianca` | 507, 434 | 492, 429 | Baía de Guanabara |
| `thomaz` | 503, 430 | 493, 428 | Niterói |
| `angra dos reis` | 480, 445 | 475, 440 | Mais a oeste na costa sul do RJ |
| `brasfels` | 480, 445 | 475, 440 | Angra dos Reis |
| `keppel` | 478, 447 | 474, 441 | Angra dos Reis |
| `verolme` / `damen` | 479, 446 | 474, 440 | Angra dos Reis |
| `macae` | 520, 420 | 510, 410 | Costa norte RJ, ajustar para dentro do estado |
| `imbetiba` | 522, 418 | 511, 409 | Macaé |
| `sao joao da barra` | 525, 415 | 515, 405 | Norte de Macaé |
| `porto do acu` / `acu` | 525, 415 | 515, 405 | São João da Barra |

**Outras regiões (ajustes menores):**
| Local | Atual | Corrigido | Motivo |
|-------|-------|-----------|--------|
| `vitoria` | 530, 395 | 520, 390 | Ajustar para costa do ES |
| `aracruz` | 528, 400 | 518, 385 | Norte de Vitória no ES |
| `jurong` | 528, 400 | 518, 385 | Aracruz, ES |
| `santos` | 420, 460 | 430, 455 | Costa de SP |
| `guaruja` | 425, 462 | 432, 457 | Ao lado de Santos |
| `wilson sons` | 425, 462 | 432, 457 | Guarujá |

### Arquivo afetado
- `src/components/devices/BrazilMap.tsx` — atualizar o dicionário `LOCATION_COORDS`

### Observação
Após a correção, o sistema de spread automático (`spreadOverlappingMarkers`) vai separar visualmente os estaleiros que compartilham coordenadas próximas (como os vários estaleiros de Angra ou da Baía de Guanabara), mantendo linhas pontilhadas de conexão com a posição real.

