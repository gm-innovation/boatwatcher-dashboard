

## Correção: Teste "Agent Sync Endpoint" retornando "Unknown action"

### Problema
O endpoint `download-devices` na edge function `agent-sync` aceita apenas **GET** (linha 514), mas o `InterLayerConnectivityCard` envia **POST** (linha 132). Como nenhuma rota POST com action `download-devices` existe, cai no fallback da linha 739: `{ error: 'Unknown action' }`.

### Correção
**Arquivo:** `src/components/admin/InterLayerConnectivityCard.tsx`, linha 132-139

Mudar de:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/agent-sync/download-devices`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-agent-token': agent.token,
  },
  body: JSON.stringify({}),
});
```

Para:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/agent-sync/download-devices`, {
  method: 'GET',
  headers: {
    'x-agent-token': agent.token,
  },
});
```

### Resultado esperado
O teste "Cloud → Agent Sync Endpoint" passa com status OK, mostrando a quantidade de dispositivos retornados.

