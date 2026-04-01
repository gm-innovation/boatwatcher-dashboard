

## Redesign da Aba de Empresas — Layout conforme o print

### O que o print mostra

- Título "Tempo de Trabalho por Empresa" com logo do cliente (OceanPact) abaixo
- Barra de busca por empresa + botões "Exportar CSV" e "Exportar PDF"
- Tabela com colunas: **Empresa**, **Funcionários**, **Entrada**, **Saída**, **Permanência**
- Cada empresa mostra: nome + badge "X a bordo" (verde), count de workers, data/hora da primeira entrada, badge "A bordo" (azul) se ainda dentro, tempo total formatado (ex: "572h 10m")
- Linha **TOTAL** no rodapé: total funcionários, "Diurno: X / Noturno: Y", badge "A bordo agora: X" (verde), sem permanência
- Remove os 3 summary cards (Empresas, Total Trabalhadores, Total Acessos)
- Remove o card wrapper com CardHeader — layout mais limpo e direto

### Mudanças no data model

O `CompanyData` atual tem `name, totalWorkers, totalHours, entries`. Precisa mudar para:

```typescript
interface CompanyData {
  name: string;
  totalWorkers: number;
  onBoardNow: number;           // quantos estão a bordo agora
  firstEntry: Date | null;       // primeira entrada de qualquer worker da empresa
  allExited: boolean;            // true se todos saíram
  totalMinutes: number;          // permanência total (soma de todos os workers)
  dayWorkers: number;            // workers com primeira entrada diurna
  nightWorkers: number;          // workers com primeira entrada noturna
}
```

A lógica de `companyData` já agrupa logs por worker e empresa — precisa adicionar:
- Rastrear `isOnBoard` por worker (última ação = entry)
- Calcular `firstEntry` (menor timestamp de entry da empresa)
- Calcular permanência como soma dos pares entry→exit + tempo aberto para quem está a bordo
- Classificar diurno/noturno pela hora da primeira entrada do worker

### Arquivo alterado

| Arquivo | Mudança |
|---------|------|
| `src/components/reports/CompanyReport.tsx` | Reescrever completamente: remover summary cards, novo layout de tabela, novo data model, busca por empresa, logo do cliente, linha TOTAL |

### Layout da tabela

- Sem cards de resumo no topo
- Busca + botões de export no topo
- Título "Tempo de Trabalho por Empresa" com logo do cliente (via query do projeto como já feito no WorkerTimeReport)
- Tabela simples e limpa com as 5 colunas
- Badges: "X a bordo" (verde, ao lado do nome), "A bordo" (azul, coluna Saída), tempo formatado "Xh Ym" (badge cinza, coluna Permanência)
- Rodapé TOTAL com contagens diurno/noturno e "A bordo agora: X"

### Dados necessários

- Reutilizar query de `workers` já existente
- Adicionar query do projeto (para logo do cliente) — mesmo padrão do WorkerTimeReport
- `useAccessLogs` já em uso

