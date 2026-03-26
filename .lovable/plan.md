

# Fix: Formato correto da API ControlID `load_objects.fcgi`

## Problema raiz

Estamos adivinhando o formato dos parâmetros a cada build. A documentação oficial do ControlID mostra o formato exato:

```text
where: [{ object: "access_logs", field: "id", operator: ">", value: 1 }]
```

Nosso código envia formatos inventados (`{ access_logs: { id: { '>': ... } } }`), gerando erros diferentes a cada tentativa.

## Correção definitiva

### `electron/agent.js` — Usar formato documentado

**Payload simples (sem filtro):**
```javascript
const payload = { object: 'access_logs' };
```

**Com filtro de `lastEventId`:**
```javascript
if (lastEventId > 0) {
  payload.where = [{
    object: 'access_logs',
    field: 'id',
    operator: '>',
    value: lastEventId
  }];
}
```

**Remover `order`** — não há documentação oficial para esse campo em `load_objects.fcgi`, e os IDs já são sequenciais. Isso elimina o risco de erros de formato.

**Remover `limit`** — também não documentado; o hardware retorna tudo por padrão.

### `server/package.json` — Bump para 1.3.6

### Arquivos alterados
- `electron/agent.js` — payload corrigido conforme documentação oficial
- `server/package.json` — versão 1.3.6

