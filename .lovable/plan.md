

## Dashboard Vazio — Diagnóstico e Correções

### Diagnóstico

Investiguei o banco de dados na nuvem e encontrei:

- **Total de access_logs na nuvem: 5** — todos antigos (último em 13/mar/2026)
- **Agente local está online** (último heartbeat às 19:28 de hoje), **mas `last_sync_at` é NULL** — a sincronização de dados nunca completou com sucesso
- **`pending_sync_count: 0`** — o agente reporta zero logs pendentes
- **A tabela `access_logs` não tem coluna `project_id`** — os logs não são filtrados por projeto

O dashboard mostra 0 porque:
1. Ele filtra por data de **hoje** (`timestamp >= 2026-03-25`)
2. Não existem logs de hoje no banco na nuvem
3. O agente local está online mas nunca sincronizou logs (provavelmente o `AgentController` não foi iniciado, ou os dispositivos não geraram eventos novos que o agente tenha capturado)

### Perguntas para avançar

Antes de propor mudanças no código, preciso entender:

1. **O agente (Electron/Desktop) está rodando e o AgentController foi iniciado?** O heartbeat funciona independente do polling de dispositivos. O AgentController precisa ser explicitamente iniciado (via botão "Iniciar Agente" no painel de dispositivos ou automaticamente no boot).

2. **Existem eventos RECENTES nos dispositivos ControlID (de hoje)?** Os 236 eventos que você mostrou são de testes anteriores. Se não houve acessos hoje, o dashboard vazio é o comportamento esperado.

3. **Você quer que o dashboard mostre dados históricos** (não apenas o dia atual)?

### Correções que posso implementar agora

**1. Melhorar visibilidade quando não há dados de hoje**
No dashboard, ao invés de apenas "0", mostrar a data do último evento registrado e um aviso contextual (ex: "Último evento: 13/03/2026 — Nenhum acesso registrado hoje").

**2. Adicionar filtro de período no dashboard**
Permitir que o operador veja "Hoje", "Últimos 7 dias", "Último mês" — evitando a impressão de que o sistema está quebrado quando simplesmente não houve eventos no dia.

**3. Garantir que o sync completo funcione**
O `checkAndSync()` só chama `triggerSync()` se houver pendências OU se a conexão acabou de voltar. Se o agente conectou e não tinha nada pendente, o download inicial nunca roda. Corrigir para que, se `last_sync_at` for null, force um `triggerSync()` no primeiro ciclo.

### Arquivos a alterar

- **`src/components/dashboard/Dashboard.tsx`** — Adicionar indicador de último evento e seletor de período
- **`src/hooks/useSupabase.ts`** — Parametrizar a data de filtro no `useWorkersOnBoard` 
- **`electron/sync.js`** — No `checkAndSync()`, forçar sync quando `last_sync_at` for null

