

## Problemas identificados

### 1. "Forçar Sync" sem feedback visual
O `handleForceSync()` (linha 367) chama `triggerSync()` silenciosamente — sem spinner, sem mensagem de sucesso/erro. O usuário clica e nada visível acontece.

### 2. Conectividade reseta para "Não testado"
O `refreshDashboard()` roda a cada 10s e chama `renderDevices()`, que reconstrói toda a tabela HTML com status fixo `conn-pending` ("Não testado"). Isso sobrescreve qualquer resultado de teste anterior. O status do teste só existe no DOM — não é persistido.

---

## Correções

### Arquivo: `electron/server-ui.html`

**1. Feedback visual no "Forçar Sync"**
- Alterar o botão para mostrar spinner + texto "Sincronizando..." durante a operação
- Após conclusão, mostrar brevemente "✓ Sync concluído" ou "✕ Erro" antes de restaurar o texto original
- Chamar `refreshDashboard()` após para atualizar o card de Sincronização

**2. Persistir status de conectividade entre refreshes**
- Criar um objeto `deviceConnStatus = {}` (mapa `deviceId → 'ok' | 'fail'`) em memória
- Em `handleTestDevice()`, salvar o resultado nesse mapa
- Em `renderDevices()`, consultar o mapa ao renderizar cada linha — se há resultado salvo, usar `conn-ok`/`conn-fail` em vez de `conn-pending`
- Além disso, testar automaticamente todos os dispositivos ao carregar o dashboard (uma vez), populando o mapa inicial

### Resultado
- O botão de sync mostra progresso e resultado
- O status de conectividade persiste entre refreshes e é testado automaticamente na inicialização

