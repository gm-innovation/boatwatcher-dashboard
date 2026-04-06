

## Correções: Códigos Duplicados, Limite de 1000 e DOF

### Problemas Identificados

**1. Limite de 1000 trabalhadores**: A query `fetchWorkers` em `useDataProvider.ts` não especifica range, então o Supabase retorna no máximo 1000 dos 2531 registros.

**2. DOF — empresa vs cliente**: A importação associou 166 trabalhadores ao DOF `type='client'` em vez de criar uma entrada separada `type='company'`. O usuário confirma que são entidades distintas.

**3. 24 códigos duplicados + códigos 2, 3, 4 errados**: O script de importação, ao encontrar códigos ocupados, atribuiu códigos sequenciais (a partir de ~1377) que colidiram com trabalhadores já importados com esses mesmos códigos do CSV. Resultado: 24 pares de duplicatas + 3 trabalhadores incorretos nos códigos 2, 3, 4.

### Plano de Correção

#### Passo 1: Código — Remover limite de 1000 em `fetchWorkers`
Adicionar `.range(0, 9999)` na query de workers em `src/hooks/useDataProvider.ts`.

#### Passo 2: Dados — Criar DOF empresa
Inserir nova entrada na tabela `companies` com `name='DOF'`, `type='company'`, `cnpj='07925451000189'`. Atualizar os 166 trabalhadores que apontam para o DOF client para apontar para o novo DOF company.

#### Passo 3: Dados — Corrigir todos os códigos em cascata
Script Python que:

1. Identifica os 24 trabalhadores em posições erradas (já mapeados acima)
2. Move Cristiano Calheiros (código 2), Leonardo Morgado (código 3) e Márcio Mendes (código 4) para o final da lista (2521, 2522, 2523)
3. Para cada trabalhador "WRONG": primeiro libera o código de destino se estiver ocupado por outro WRONG (processo em ordem de dependência), depois move para o código correto do CSV
4. Ordem de execução: primeiro move todos os WRONG para códigos temporários altos (2524+), depois move cada um para seu código CSV correto
5. Atualiza `workers_code_seq` para MAX(code)

Os 24 trabalhadores afetados e seus destinos corretos:

| Trabalhador | Código atual (errado) | Código correto (CSV) |
|---|---|---|
| Bruno de Souza Fonseca | 1400 | 2 |
| Gustavo Chaim Araujo Silva | 1385 | 3 |
| Edson Frederico Teixeira Freimann | 1394 | 4 |
| Leonardo Gonçalves Candido Gomes | 1404 | 17 |
| Emmanuel Figueira Vilasboas | 1392 | 147 |
| ALEX VILAS BOAS DE BRITO | 1403 | 334 |
| Ewerton Felipe Ribamar Ramos | 1389 | 700 |
| Felipe Rodrigues dos Santos | 1387 | 712 |
| Carlos Henrique de Anchietta Pitta | 1398 | 713 |
| Endel da Cruz Santos Oliveira | 1391 | 714 |
| Rafael de Araujo Pereira | 1405 | 860 |
| Fabio Jose Pereira da Silva | 1388 | 971 |
| Reni do Nascimento Chilelle | 1377 | 1366 |
| Eduardo Magalhães Evangelista | 1393 | 1369 |
| Luiz Oswaldo Oliveria Cruz | 1380 | 1370 |
| David Pereira Porto | 1397 | 1371 |
| Allan Santos Albuquerque | 1401 | 1373 |
| Carlos Alberto Souzas de Medeiros | 1399 | 1374 |
| Jorge Luiz Magalhães | 1383 | 1375 |
| Deivison Rodrigo Silva dos Santos | 1396 | 1376 |
| Kristian Oedegaard | 1381 | 1378 |
| Erico da Silva Martins | 1390 | 1379 |
| Gabriel Felipe de Brito Martins | 1386 | 1382 |
| Dogival Almeida da Silva | 1395 | 1384 |
| Alexandro Santos Silva | 1402 | 1400 |

E 3 trabalhadores pré-existentes movidos para o final:
- Cristiano Calheiros: 2 → 2521
- Leonardo Morgado: 3 → 2522
- Márcio Mendes: 4 → 2523

### Arquivos modificados
- `src/hooks/useDataProvider.ts` — adicionar `.range(0, 9999)` na query de workers

### Operações de dados (via script Python + psql)
- INSERT nova DOF company
- UPDATE 166 workers para novo company_id
- UPDATE ~27 workers para códigos corretos (em 2 fases: temporário → definitivo)
- UPDATE sequência workers_code_seq

