

# Fix: Cálculo do Tempo Total Truncando Minutos

## Problema
`differenceInMinutes` (date-fns) trunca segundos parciais em **cada par** entrada→saída. Com vários pares ao longo do dia, os segundos perdidos se acumulam, resultando em tempo total menor que o real (ex: 4h 17m ao invés de 5h 23m).

## Solução
Somar milissegundos brutos de todos os pares, depois converter para minutos **uma única vez** com arredondamento.

### `src/components/reports/WorkerTimeReport.tsx`
Trocar o loop de cálculo (linhas 126-131):

```typescript
// ANTES — trunca cada par individualmente
let totalMinutes = 0;
for (let i = 0; i < alternating.length - 1; i += 2) {
  if (...) {
    totalMinutes += differenceInMinutes(exit, entry);
  }
}

// DEPOIS — soma ms brutos, converte uma vez
let totalMs = 0;
for (let i = 0; i < alternating.length - 1; i += 2) {
  if (alternating[i].direction === 'entry' && alternating[i + 1]?.direction === 'exit') {
    totalMs += new Date(alternating[i + 1].timestamp).getTime() - new Date(alternating[i].timestamp).getTime();
  }
}
const totalMinutes = Math.round(totalMs / 60000);
```

### Arquivo alterado
- `src/components/reports/WorkerTimeReport.tsx` (apenas o bloco de cálculo ~linhas 126-131)

