

## Corrigir coordenadas usando o path SVG do RJ como referência

### Diagnóstico
Analisei os vértices do path SVG do estado `'RJ'`. A costa litorânea e a Baía de Guanabara são definidas por estes pontos-chave:

```text
Baía de Guanabara (reentrância no path):
  495.72, 421.25  ← fundo da baía (norte)
  493.83, 424.96  ← lado oeste (Rio)
  495.18, 425.84  ← centro
  495.25, 426.97  ← entrada da baía (sul)
  492.72, 427.96  ← segue para costa oeste

Costa nordeste RJ:
  501.68, 411.38  ← São João da Barra / divisa ES
  498.08, 415.21  ← região de Macaé

Costa sudoeste RJ:
  468.35, 450.28  ← Angra dos Reis / costa sul
  463.24, 452.27  ← Ilha Grande
```

As coordenadas atuais (`x:490-493, y:428-430`) caem na borda **interior** (fronteira RJ-MG), não na costa.

### Correções

**Arquivo:** `src/components/devices/BrazilMap.tsx` — dicionário `LOCATION_COORDS`

| Local | Atual (x, y) | Corrigido (x, y) | Referência no path |
|-------|--------------|-------------------|-------------------|
| `rio de janeiro` | 490, 430 | 494, 426 | Lado oeste da baía |
| `niteroi` | 493, 428 | 497, 424 | Lado leste da baía |
| `sao goncalo` | 495, 426 | 496, 423 | Norte de Niterói |
| `renave` | 493, 429 | 496, 425 | Dentro da baía |
| `maua` | 492, 429 | 495, 425 | Dentro da baía |
| `inhauma` | 490, 428 | 494, 425 | Lado oeste da baía |
| `brasa` | 491, 429 | 495, 426 | Zona portuária Rio |
| `utc` | 492, 430 | 495, 425 | Dentro da baía |
| `triunfo` | 492, 430 | 495, 425 | Dentro da baía |
| `mac laren` | 493, 430 | 496, 425 | Niterói |
| `maclaren` | 493, 430 | 496, 425 | Niterói |
| `alianca` | 492, 429 | 495, 425 | Dentro da baía |
| `thomaz` | 493, 428 | 496, 424 | Niterói |
| `angra dos reis` | 475, 440 | 469, 449 | Costa sudoeste RJ |
| `brasfels` | 475, 440 | 469, 449 | Angra dos Reis |
| `keppel` | 474, 441 | 469, 449 | Angra dos Reis |
| `verolme` | 474, 440 | 469, 449 | Angra dos Reis |
| `damen` | 474, 440 | 469, 449 | Angra dos Reis |
| `macae` | 510, 410 | 499, 415 | Costa nordeste RJ |
| `imbetiba` | 511, 409 | 499, 415 | Macaé |
| `sao joao da barra` | 515, 405 | 502, 412 | Divisa RJ/ES |
| `porto do acu` | 515, 405 | 502, 412 | São João da Barra |
| `acu` | 515, 405 | 502, 412 | São João da Barra |

### Método
Todas as coordenadas derivadas diretamente dos vértices do path SVG `'RJ'`, garantindo que os marcadores caem **dentro** do contorno do estado e na posição geográfica correta.

