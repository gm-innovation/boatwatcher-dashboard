

## Expandir Dicionário de Localizações com Estaleiros Offshore

### Problema

O campo `location` dos projetos contém nomes de **estaleiros** (ex: "Estaleiro Renave"), não cidades. O dicionário atual (`CITY_COORDS`) só tem cidades, por isso o matching falha e o mapa mostra 0 projetos.

### Solução

Expandir o dicionário em `BrazilMap.tsx` com os principais estaleiros utilizados na indústria offshore brasileira, mapeados para suas coordenadas geográficas reais no SVG. Também melhorar o algoritmo de matching para lidar com variações de nome.

### Estaleiros a adicionar (~25 estaleiros offshore)

| Estaleiro | Localização Real | Coordenadas SVG (aprox.) |
|---|---|---|
| Estaleiro Renave (Renave Dockyard) | Niterói, RJ | ~315, 245 |
| EBR (Estaleiro Brasfels) | Angra dos Reis, RJ | ~295, 248 |
| Estaleiro Mauá | Niterói, RJ | ~315, 243 |
| Estaleiro Inhaúma | Rio de Janeiro, RJ | ~310, 240 |
| Estaleiro Brasa | Rio de Janeiro, RJ | ~312, 242 |
| Estaleiro Atlântico Sul (EAS) | Suape/Ipojuca, PE | ~362, 112 |
| Estaleiro Jurong Aracruz | Aracruz, ES | ~338, 210 |
| Estaleiro OSX / Enseada Paraguaçu | Maragogipe, BA | ~335, 158 |
| Estaleiro Rio Grande (ERG/QGI) | Rio Grande, RS | ~195, 345 |
| Estaleiro Wilson Sons | Guarujá, SP | ~275, 262 |
| Estaleiro Vard Promar | Suape, PE | ~362, 114 |
| Estaleiro UTC / Triunfo | Niterói, RJ | ~316, 244 |
| Estaleiro Mac Laren | Niterói, RJ | ~314, 246 |
| Keppel Fels (BrasFELS) | Angra dos Reis, RJ | ~293, 250 |
| Estaleiro Aliança | Niterói, RJ | ~317, 244 |
| Porto de Macaé | Macaé, RJ | ~330, 225 |
| Base de Imbetiba | Macaé, RJ | ~332, 223 |
| SERMETAL | Barcarena, PA | ~215, 55 |
| Estaleiro Navship | Navegantes, SC | ~238, 287 |
| Estaleiro Detroit | Itajaí, SC | ~240, 285 |
| Estaleiro Oceana | Itajaí, SC | ~241, 286 |
| Damen Verolme | Angra dos Reis, RJ | ~294, 249 |
| Estaleiro Thomaz | São Gonçalo, RJ | ~313, 241 |
| Porto do Açu | São João da Barra, RJ | ~335, 220 |
| Estaleiro Rio Tietê | Araçatuba, SP | ~205, 240 |

### Alterações em `BrazilMap.tsx`

1. Adicionar todos os estaleiros acima ao dicionário `CITY_COORDS` (renomear conceitualmente para `LOCATION_COORDS`)
2. Melhorar `findCityCoords` para fazer matching mais inteligente:
   - Buscar por palavras-chave (ex: "renave" encontra "estaleiro renave")
   - Buscar cada palavra do location no dicionário separadamente
3. Adicionar cidades offshore relevantes que faltam: Macaé, Aracruz, Suape, Navegantes, São Gonçalo, Maragogipe, Barcarena

### Arquivo afetado

- `src/components/devices/BrazilMap.tsx` — expandir dicionário e matching

