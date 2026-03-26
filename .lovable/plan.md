
Objetivo: alinhar o cálculo de “Tempo Total” com sua regra simples: **última saída - primeira entrada** (tempo corrido), sem somar pares.

Plano de implementação (1 arquivo):
1. **Atualizar a lógica de cálculo em `src/components/reports/WorkerTimeReport.tsx`**
   - No bloco `rows` (dentro do `workerLogs.forEach`), manter os logs já normalizados por alternância (`alternating`).
   - Trocar o cálculo atual por:
     - `firstEntryLog`: primeiro log `entry` da lista.
     - `lastExitLog`: último log `exit` da lista.
     - `totalMinutes`: diferença em ms entre `lastExitLog.timestamp` e `firstEntryLog.timestamp`, convertida 1 vez para minutos.
   - Regra defensiva: se não houver entrada ou saída válidas, ou se saída < entrada, total = 0.

2. **Preservar status “A bordo” e exibição de saída**
   - Continuar usando `isOnBoard` com base no último evento (`entry` pendente).
   - Exibição da coluna Saída continua como está (badge “A bordo” quando aplicável), sem afetar a nova fórmula do total.

3. **Ajuste de consistência/lint**
   - Remover import não utilizado (`differenceInMinutes`) para evitar warning/erro de build.

Resultado esperado:
- Caso do print: entrada **10:13**, saída **15:36** => **5h 23m**.
- Cálculo fica direto e previsível, exatamente como você descreveu.
