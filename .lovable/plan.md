

# Correção: Endpoint de Polling de Eventos ControlID

## Diagnóstico

O agente está recebendo **0 eventos** com `lastEventPayload: null`, mas sem erros. Isso indica que o endpoint `access_logs.fcgi` provavelmente **não existe** no firmware ControlID — o dispositivo retorna um JSON vazio ou um objeto sem a chave esperada, e o agente trata como "0 eventos".

A documentação ControlID confirma: para consultar objetos (incluindo logs de acesso), o endpoint correto é **`load_objects.fcgi`** com o parâmetro `object: "access_logs"`. O endpoint `access_logs.fcgi` não faz parte da API documentada.

## Plano

### 1. `electron/agent.js` — Corrigir endpoint de polling

Alterar `pollDevice()` de:
```
POST /access_logs.fcgi   →   POST /load_objects.fcgi
```

E adicionar `object: "access_logs"` ao payload:
```javascript
const payload = {
  object: "access_logs",
  limit: 100,
  order: { access_logs: { id: "ASC" } }
};
if (lastEventId > 0) {
  payload.where = { access_logs: { id: { ">": lastEventId } } };
}
```

### 2. `electron/agent.js` — Salvar resposta bruta para diagnóstico

Após o `JSON.parse(data)`, guardar a resposta bruta (truncada) no device para que apareça na telemetria:
```javascript
device._lastPollResponse = data.length > 2048 ? data.slice(0, 2048) : data;
```

E expor no `getStatus()`:
```javascript
lastPollResponse: d._lastPollResponse || null,
```

### 3. `src/components/admin/DiagnosticsPanel.tsx` — Exibir resposta bruta do polling

No card de Telemetria, adicionar seção colapsável "Última resposta do polling" para cada dispositivo, mostrando o JSON bruto retornado pelo hardware.

### 4. Bump de versão

`server/package.json` → `1.3.4`

### Arquivos alterados
- `electron/agent.js` — corrigir endpoint + salvar resposta bruta
- `src/components/admin/DiagnosticsPanel.tsx` — exibir resposta bruta
- `server/package.json` — versão 1.3.4

