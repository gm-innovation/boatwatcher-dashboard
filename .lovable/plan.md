

## Ajustes na Lógica de Saída e Permanência por Empresa

### O que muda

1. **Coluna "Saída"**: Quando todos saíram (`allExited`), exibir o horário da última saída do último trabalhador da empresa (em vez de "Todos saíram")
2. **Coluna "Permanência"**: Calcular como tempo total desde a primeira entrada do primeiro trabalhador até a última saída do último (ou até agora se alguém ainda está a bordo) — em vez da soma individual de pares entry/exit

### Mudanças no data model

Adicionar `lastExit: Date | null` ao `CompanyData`. Rastrear o maior timestamp de saída entre todos os workers da empresa.

### Mudanças na lógica (`companyStats`)

- Novo campo `lastExit` no stats, inicializado como `null`
- Para cada worker, ao processar logs de exit, atualizar `stats.lastExit` se o timestamp for maior que o atual
- **Permanência**: mudar cálculo — em vez de somar pares individuais, calcular `differenceInMinutes(lastExit || now, firstEntry)` no momento de montar o retorno

### Mudanças no JSX

- **Coluna Saída**: quando `allExited && lastExit`, exibir `format(lastExit, "dd/MM/yyyy HH:mm")`. Quando não `allExited`, manter badge "A bordo"
- **Permanência**: já usa `totalMinutes` — a mudança é só no cálculo

### Arquivo

`src/components/reports/CompanyReport.tsx`

- Interface `CompanyData`: adicionar `lastExit: Date | null`
- `companyStats` map: adicionar `lastExit: null`
- Dentro do forEach de workerLogs: rastrear o último exit de cada worker e atualizar `stats.lastExit`
- No `return Array.from(...)`: calcular `totalMinutes` como `differenceInMinutes(lastExit || new Date(), firstEntry)` em vez de soma de pares
- JSX coluna Saída: exibir horário formatado quando `allExited`
- Export CSV/PDF: atualizar campo `exitStatus` para usar horário formatado

