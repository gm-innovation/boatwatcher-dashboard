

## Corrigir autenticação ControlID: Session-based em vez de Basic Auth

### Problema raiz

Os dispositivos ControlID **não usam HTTP Basic Auth**. A API deles exige:

1. POST para `/login.fcgi` com `{ login, password }` no body JSON
2. Receber um token de sessão na resposta: `{ "session": "abc123" }`
3. Usar essa sessão como query parameter em todas as requisições: `?session=abc123`

O código atual envia `Authorization: Basic base64(user:pass)`, que o dispositivo ignora completamente, retornando 401.

### Alterações necessárias

**3 arquivos** precisam ser corrigidos — todos usam o mesmo padrão errado:

#### 1. `server/lib/controlid.js` (servidor local / Electron)

- Criar função `loginToDevice(device)` que faz POST para `/login.fcgi` com `{ login, password }`
- Cachear sessões por IP (com TTL de ~10 min) para evitar login a cada request
- Alterar `buildDeviceUrl()` para incluir `?session=TOKEN` em vez de header Basic Auth
- Remover `buildAuthHeaders()` (não é mais necessário)
- Em caso de 401 em qualquer request, invalidar cache e tentar login novamente (retry automático)

```text
Fluxo atual (ERRADO):
  Request → Header: Authorization: Basic xxx → 401

Fluxo correto:
  POST /login.fcgi { login, password } → { session: "abc" }
  Request /create_objects.fcgi?session=abc → 200
```

#### 2. `supabase/functions/controlid-api/index.ts` (Edge Function)

- Mesma correção: adicionar `loginToDevice()` antes de qualquer operação
- Passar sessão como query param em vez de Basic Auth header
- Nota: Edge Functions não atingem IPs locais (192.168.x.x), então essa função só é usada quando o dispositivo tem IP público. Mesmo assim, a autenticação precisa ser corrigida.

#### 3. `electron/agent.js` (polling de eventos)

- Atualmente faz GET para `/api/access/last` sem autenticação
- Adicionar login + sessão ao polling também, caso os dispositivos exijam autenticação para esse endpoint

### Detalhes técnicos

**Cache de sessão** (em `server/lib/controlid.js`):
```javascript
const sessionCache = new Map(); // ip -> { session, expiry }

async function getSession(device) {
  const key = device.controlid_ip_address;
  const cached = sessionCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.session;
  
  const creds = parseApiCredentials(device.api_credentials);
  const response = await fetch(`http://${key}:${creds.port || 80}/login.fcgi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: creds.username || 'admin', password: creds.password || 'admin' }),
  });
  
  const data = await response.json();
  if (!data.session) throw new Error('Login falhou no dispositivo');
  
  sessionCache.set(key, { session: data.session, expiry: Date.now() + 10 * 60 * 1000 });
  return data.session;
}
```

**Uso da sessão**: Todas as URLs passam a incluir `?session=TOKEN` como query parameter, conforme documentação oficial da ControlID.

**Retry em 401**: Se uma request retornar 401, limpar cache da sessão, fazer novo login e repetir a request uma vez.

### Campo `api_credentials` no banco

O formato atual `{ username, password }` continua válido — apenas o campo `username` será usado como `login` no POST para `/login.fcgi`. Nenhuma alteração no banco de dados é necessária.

### Impacto

- Corrige o erro 401 em enrollment, remoção, liberação de acesso e polling
- Compatível com todos os firmwares ControlID (iDAccess, iDFace)
- Sem breaking changes na interface — a mudança é transparente

