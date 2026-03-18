

## Correção da Integração ControlID — Endpoints e Foto conforme Documentação Oficial

### Problemas Encontrados

Todos os endpoints usados para **criar usuários**, **enviar fotos** e **remover usuários** estão errados. O código atual foi escrito com endpoints inventados que não existem na API ControlID:

| Ação | Código Atual (ERRADO) | API ControlID (CORRETO) |
|---|---|---|
| Criar usuário | `POST /users.fcgi` com `values` | `POST /create_objects.fcgi` com `object: "users"` |
| Enviar foto | `POST /user_images.fcgi` com JSON base64 | `POST /user_set_image.fcgi` com `Content-Type: application/octet-stream` e bytes raw |
| Remover usuário | `POST /users.fcgi` com `where` | `POST /destroy_objects.fcgi` com `object: "users"` |
| Remover foto | (não implementado) | `POST /user_destroy_image.fcgi` |
| Listar usuários | `POST /users.fcgi` | Correto, mas pode usar `GET /user_list_images.fcgi` para verificar fotos |

Além disso, a API ControlID usa **IDs inteiros** (`int 64`), mas o sistema envia **UUIDs**. O campo `workers.code` (integer auto-incremento) deve ser usado como ID no ControlID.

### Arquivos a Alterar

**1. `server/lib/controlid.js`** — Corrigir todos os endpoints
- `enrollUserOnDevice`: Criar usuário via `/create_objects.fcgi` com `object: "users"` e `values: [{ id: worker.code, name, registration }]`
- Envio de foto: Converter base64 para Buffer binário, enviar via `POST /user_set_image.fcgi?user_id={code}&timestamp={unix}` com `Content-Type: application/octet-stream` e body = bytes raw da imagem
- `removeUserFromDevice`: Usar `/destroy_objects.fcgi` com `object: "users"` + remover foto via `/user_destroy_image.fcgi`
- Criar função auxiliar `controlIdRequestBinary` para enviar `application/octet-stream`

**2. `supabase/functions/controlid-api/index.ts`** — Mesmas correções
- `enrollUser`: `/create_objects.fcgi` para criar usuário
- Foto: `/user_set_image.fcgi` com `application/octet-stream`
- `removeUser`: `/destroy_objects.fcgi` + `/user_destroy_image.fcgi`
- `listUsers`: manter `/users.fcgi` (endpoint de leitura está correto)
- Criar `controlIDRequestBinary` para envio de foto

**3. `supabase/functions/worker-enrollment/index.ts`** — Mesmas correções
- `enrollUserOnDevice`: `/create_objects.fcgi` + `/user_set_image.fcgi` com octet-stream
- `removeUserFromDevice`: `/destroy_objects.fcgi` + `/user_destroy_image.fcgi`
- Buscar `code` do worker (campo inteiro) para usar como ID no ControlID

**4. `electron/sync.js`** — Ajustar `autoEnrollWorkerPhoto`
- Passar `worker.code` como ID para o dispositivo (não UUID)
- Garantir que a foto baixada seja enviada como bytes raw (não base64 em JSON)

**5. `server/routes/workers.js`** — Garantir que enrollment/remoção use `worker.code`

### Detalhes Técnicos

**Criação de usuário (correto):**
```
POST /create_objects.fcgi
Content-Type: application/json
{ "object": "users", "values": [{ "id": 42, "name": "João", "registration": "12345" }] }
```

**Envio de foto (correto):**
```
POST /user_set_image.fcgi?user_id=42&timestamp=1710700000&match=0
Content-Type: application/octet-stream
Body: [bytes raw da imagem JPG/PNG]
```

**Remoção de usuário (correto):**
```
POST /destroy_objects.fcgi
Content-Type: application/json
{ "object": "users", "where": { "users": { "id": 42 } } }
```

**Remoção de foto (correto):**
```
POST /user_destroy_image.fcgi
Content-Type: application/json
{ "user_id": 42 }
```

### Resultado
- Cadastro de usuários aparecerá corretamente no sistema ControlID e no dispositivo
- Fotos serão aceitas pelo leitor facial (formato binário correto)
- Remoção funcionará de fato (endpoint de destruição correto)
- IDs inteiros (`code`) serão usados em vez de UUIDs incompatíveis

