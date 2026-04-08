

## Correção do cálculo de tempo total para trabalhadores "A bordo"

### Problema

Em `src/components/reports/WorkerTimeReport.tsx`, o `totalMinutes` é calculado como `lastExitLog - firstEntryLog`. Quando o trabalhador está "A bordo" (última ação = entrada), não existe `lastExitLog` após essa entrada final, então o tempo da sessão aberta é ignorado.

No exemplo: ENTRADA 08:17 → SAÍDA 08:56 → ENTRADA 09:00 (ainda a bordo).  
Cálculo atual: `08:56 - 08:17 = 39min` (ignora a sessão aberta desde 09:00).  
Cálculo correto: `39min + (agora - 09:00) ≈ 3h+`.

### Correção

**Arquivo:** `src/components/reports/WorkerTimeReport.tsx`

1. **`totalMinutes` (linhas 150-154):** Quando `isOnBoard === true`, usar `Date.now()` no lugar de `lastExitLog` para o cálculo do tempo total (diferença entre a primeira entrada e o momento atual).

2. **`effectiveMinutes` (linhas 157-163):** Após somar os pares completos entrada→saída, se o último log for uma entrada sem saída correspondente, adicionar `Date.now() - últimaEntrada` ao total efetivo.

3. **`formatDuration` na exibição:** Quando o trabalhador está a bordo, o badge já mostra "A bordo" — o tempo exibido passará a refletir o valor real incluindo a sessão aberta.

### Também corrigir no PDF

**Arquivo:** `src/utils/exportReportPdf.ts`

Aplicar a mesma lógica de sessão aberta ao calcular `totalMinutes` no export, para que o PDF reflita os mesmos valores da tela.

