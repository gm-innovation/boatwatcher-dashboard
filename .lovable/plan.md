

## Importação de Dados de Produção para o Banco de Dados

### Resumo

Importar empresas, funções e trabalhadores dos 4 CSVs fornecidos para o banco Supabase, preservando os códigos de produção (`worker_code`) e tratando conflitos de código conforme solicitado.

### Dados atuais no banco

| Entidade | Existentes | A importar |
|----------|-----------|------------|
| Empresas | 2 (DOF, Googlemarine) | ~112 do CSV |
| Funções | 1 (TÉCNICO EM ELETRÔNICA II) | ~489 linhas (muitas duplicatas) |
| Trabalhadores | 5 (códigos 1–5) | ~2530 do CSV |

### Lógica de importação (script Python via psql)

#### Passo 1: Empresas
- Extrair `name` e `cnpj` do `CompanyProfile_export.csv`
- Match por CNPJ normalizado (somente dígitos) ou nome exato
- "DOF" já existe (sem CNPJ) → associar pelo nome e atualizar CNPJ se disponível
- Novas empresas: `INSERT` com `type='company'`, `status='active'`
- Construir mapa `nome_empresa → uuid`

#### Passo 2: Funções (Job Functions)
- Deduplicar por nome (case-insensitive, trim)
- Ignorar "Não informado"
- Manter função existente "TÉCNICO EM ELETRÔNICA II"
- Construir mapa `nome_função → uuid`

#### Passo 3: Trabalhadores
Para cada trabalhador do `ManagedWorker_export.csv`:

1. Normalizar CPF (remover pontos/traços)
2. Se CPF já existe no banco → **atualizar `code`** para o `worker_code` do CSV
3. Se CPF não existe:
   - Tentar inserir com o `worker_code` do CSV
   - **Se o código já estiver em uso** por outro trabalhador → atribuir o próximo número livre (após o maior código existente)
4. Vincular `company_id` pelo mapa de empresas (por `company_name`)
5. Vincular `job_function_id` pelo mapa de funções (por `job_function`)
6. Campos: `name`, `document_number`, `code`, `status`, `birth_date`, `gender`, `blood_type`, `role` (job_function)

#### Passo 4: Atualizar sequência
- `SELECT setval('workers_code_seq', (SELECT MAX(code) FROM workers))`

### Tratamento de conflitos de código

Os 5 trabalhadores existentes ocupam códigos 1–5. O CSV tem códigos que vão até ~2520. Se um `worker_code` do CSV colidir com um código já ocupado por outro CPF:
- O trabalhador é colocado no **final da fila** (recebe `MAX(code) + 1`)
- Isso garante que nenhum dado existente é sobrescrito

Exemplo: se ADRIANO (CPF 08963535754, código 5 no banco) aparece no CSV com `worker_code` diferente, ele mantém o código do CSV (pois será atualizado por match de CPF).

### Execução

Um script Python será executado no sandbox que:
1. Lê os CSVs com `csv.DictReader`
2. Consulta dados existentes via `psql`
3. Gera e executa INSERTs em batches
4. Tudo via `code--exec` — nenhum arquivo do projeto é modificado

### Arquivos NÃO modificados
Nenhum arquivo do projeto será alterado — operação puramente de dados.

