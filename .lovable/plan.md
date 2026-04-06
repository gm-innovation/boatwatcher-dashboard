

## Diagnóstico: Saída de Alexandre Silva não registrada

### Dados do banco de dados hoje (06/04)

Existem **apenas 3 registros** no dia inteiro:

| Hora (UTC) | Trabalhador | Direção | Dispositivo |
|---|---|---|---|
| 12:28 | Alexandre Silva | entry | Engenharia - Entrada |
| 17:22 | Gustavo Magalhães | exit | Engenharia - Saída |
| 17:24 | Gustavo Magalhães | exit | Engenharia - Saída |

**A saída do Alexandre às ~14:20 não existe no banco.** O dashboard está correto ao mostrá-lo como "a bordo" — ele simplesmente nunca recebeu o evento de saída.

### Causa raiz provável

O agente local (versão 1.3.16) usa **deduplicação temporal** no `processEvent`:

```text
// electron/agent.js linhas 519-529
if (eventMs <= lastMs) → descarta o evento como duplicado
```

O problema: o `last_event_timestamp` do dispositivo de **saída** (192.168.0.129) pode ter ficado com um timestamp futuro de uma sessão anterior, fazendo com que todos os novos eventos sejam descartados como "duplicados". Isso explicaria por que a saída do Alexandre às 14:20 sumiu, mas as saídas do Gustavo às 17:22/17:24 foram capturadas (ultrapassaram o timestamp travado).

### Plano de correção — 3 itens

**1. Corrigir deduplicação para usar o cursor `id` em vez de timestamp**

Arquivo: `electron/agent.js`

O `lastEventId` (cursor incremental) já é usado para buscar novos eventos do hardware. Mas dentro do `processEvent`, a deduplicação usa `last_event_timestamp` (comparação temporal), que é frágil — um timestamp futuro anômalo bloqueia todos os eventos seguintes.

Correção: remover a deduplicação por timestamp dentro do `processEvent`. O filtro `where id > lastEventId` na query já garante que não haverá duplicatas.

**2. Implementar carry-over de trabalhadores entre dias**

Arquivo: `src/hooks/useSupabase.ts` — função `fetchWorkersOnBoardFromCloud`

Adicionar uma query que busca o **último evento** de cada trabalhador nos últimos 7 dias (antes da meia-noite de hoje). Se o último evento foi "entry", inicializar o trabalhador como "a bordo" no dia atual, permitindo que saídas de hoje o removam corretamente.

**3. Adicionar log de diagnóstico para eventos descartados**

Arquivo: `electron/agent.js`

Quando um evento é descartado pela deduplicação, logar detalhes suficientes para depuração: worker_name, direction, timestamp do evento e timestamp de referência.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `electron/agent.js` | Remover deduplicação temporal redundante no processEvent; manter apenas cursor por ID |
| `src/hooks/useSupabase.ts` | Adicionar carry-over de trabalhadores entre dias na lógica "on board" |

### O que NÃO muda
- Polling de eventos do hardware (já funciona)
- Upload de logs para a nuvem (já funciona)
- Cursor `lastEventId` (já funciona corretamente)
- Configuração de dispositivos

