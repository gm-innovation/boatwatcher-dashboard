

## Diagnóstico completo

Existem **dois problemas** causando o erro `FOREIGN KEY constraint failed`:

### Problema 1: `upsertProjectFromCloud` usa `client_id` da nuvem diretamente

Na linha 1375-1379 de `database.js`, `upsertProjectFromCloud` grava `data.client_id` (UUID da nuvem) diretamente na coluna `projects.client_id`. Porém essa coluna tem FK para `companies.id` (ID local). 

A empresa é inserida com `id = uuidv4()` (local) e `cloud_id = data.id` (nuvem). Então quando o projeto tenta referenciar `client_id = UUID-da-nuvem`, esse ID não existe na coluna `companies.id` -- está em `companies.cloud_id`.

Outras funções como `upsertUserCompanyFromCloud` e `upsertCompanyDocumentFromCloud` já fazem essa resolução corretamente (ex: `resolveLocalEntityId('companies', data.company_id)`), mas `upsertProjectFromCloud` não faz.

### Problema 2: `upsertDeviceFromCloud` usa `project_id` da nuvem diretamente

Na linha 1185, `data.project_id` da nuvem é gravado direto em `devices.project_id`, que tem FK para `projects.id`. Como o projeto é inserido com o ID da nuvem como `projects.id` (não gera UUID local como companies), isso **funciona** -- desde que o projeto já exista. Esse problema já foi resolvido na correção anterior (pré-sync de projetos).

Porém, existe um caso edge: se `upsertProjectFromCloud` falhar por causa do Problema 1, os projetos nunca são inseridos, e os devices continuam falhando.

### Resumo da cadeia de falha

```text
Companies inseridas com id=LOCAL, cloud_id=CLOUD_UUID
    ↓
Projects tentam INSERT com client_id=CLOUD_UUID → FK FAIL (companies.id não tem CLOUD_UUID)
    ↓
Projects nunca são inseridos
    ↓
Devices tentam INSERT com project_id=PROJECT_UUID → FK FAIL (projects.id não existe)
```

## Plano de correção

### Correção 1 — `upsertProjectFromCloud` em `electron/database.js`

Resolver `client_id` para o ID local da empresa antes de gravar:

```javascript
upsertProjectFromCloud(data) {
  const localClientId = resolveLocalEntityId('companies', data.client_id) || data.client_id;
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(data.id);
  if (existing) {
    db.prepare(`UPDATE projects SET name = ?, client_id = ?, status = ?, location = ?, crew_size = ?, commander = ?, chief_engineer = ?, project_type = ?, armador = ?, start_date = ?, updated_at = datetime('now'), synced = 1 WHERE id = ?`)
      .run(data.name, localClientId, data.status, data.location, data.crew_size, data.commander || null, data.chief_engineer || null, data.project_type || null, data.armador || null, data.start_date || null, data.id);
  } else {
    db.prepare(`INSERT INTO projects (id, name, client_id, status, location, crew_size, commander, chief_engineer, project_type, armador, start_date, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(data.id, data.name, localClientId, data.status, data.location, data.crew_size, data.commander || null, data.chief_engineer || null, data.project_type || null, data.armador || null, data.start_date || null);
  }
},
```

Isso é consistente com o padrão já usado em `upsertUserCompanyFromCloud` (linha 1385) e `upsertCompanyDocumentFromCloud` (linha 1402).

### Correção 2 — Adicionar logs de erro no fluxo de token

Em `electron/local-server-main.js`, envolver cada etapa de pré-sync com try/catch individual e logs detalhados, para que falhas futuras sejam diagnosticáveis sem ambiguidade.

### Nenhuma alteração de schema necessária

A correção é puramente lógica no mapeamento de IDs.

