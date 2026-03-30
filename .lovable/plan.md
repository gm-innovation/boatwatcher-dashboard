

## Tripulação a Bordo — contagem dinâmica por nome da empresa

### Problema atual
O card "Tripulação a Bordo" exibe `project.crew_size`, que é um valor estático configurado manualmente no projeto. Não reflete quem está realmente a bordo.

### Solução
Calcular dinamicamente a contagem de tripulação filtrando os trabalhadores atualmente a bordo cuja **empresa** tenha o mesmo nome que o **projeto**. Isso já está disponível nos dados enriquecidos (`workersOnBoard` retorna `company` e `project.name` já existe).

### Alteração

**`src/components/dashboard/Dashboard.tsx`**:
- Calcular `crewOnBoard` filtrando `formattedWorkers` onde `w.company` coincide (case-insensitive, trimmed) com `project.name`
- Passar `crewOnBoard` ao `StatisticsCards` no lugar de `project?.crew_size`

```
const crewOnBoard = formattedWorkers.filter(w => 
  w.company && project?.name && 
  w.company.trim().toLowerCase() === project.name.trim().toLowerCase()
).length;
```

Nenhuma mudança de banco de dados ou outros componentes necessária — a lógica fica contida no Dashboard.

