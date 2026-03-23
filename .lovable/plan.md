

## Diagnóstico

O erro "FOREIGN KEY constraint failed" ocorre durante o fluxo de `set-agent-token` (linha 226 de `local-server-main.js`). O problema:

1. Ao conectar com o token, o servidor baixa os **dispositivos** da nuvem (`download-devices`)
2. Cada dispositivo tem um `project_id` (ex: `8685513e-...`)
3. A tabela `devices` no SQLite tem `FOREIGN KEY (project_id) REFERENCES projects(id)`
4. Mas a tabela `projects` local ainda está **vazia** -- os projetos só são baixados depois, durante o `triggerSync`
5. Resultado: SQLite rejeita o INSERT do device porque o `project_id` referenciado não existe

## Plano de correção

**Arquivo: `electron/local-server-main.js`** (handler `server:set-agent-token`)

Antes de salvar os dispositivos no SQLite, baixar primeiro os projetos e empresas (respeitando a ordem relacional):

1. Após validar o token (heartbeat OK), baixar empresas via `agent-sync/download-companies`
2. Baixar projetos via `agent-sync/download-projects`
3. Upsert empresas e projetos no SQLite local
4. Só então baixar e salvar os dispositivos (fluxo atual)
5. Continuar com o resto do fluxo (rebind, sync)

Isso garante que quando o device é inserido com `project_id = X`, o projeto `X` já existe na tabela `projects` local.

## Detalhes da implementação

No bloco entre a validação do heartbeat (linha ~206) e o download de devices (linha ~209), adicionar:

```javascript
// Download companies first (projects depend on them)
const companiesResult = await callCloudFunction(
  syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
  'agent-sync/download-companies?since=1970-01-01T00:00:00Z', 'GET', null
);
if (Array.isArray(companiesResult.companies)) {
  for (const company of companiesResult.companies) {
    serverRuntime.db.upsertCompanyFromCloud(company);
  }
}

// Download projects (devices depend on them via FK)
const projectsResult = await callCloudFunction(
  syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
  'agent-sync/download-projects?since=1970-01-01T00:00:00Z', 'GET', null
);
if (Array.isArray(projectsResult.projects)) {
  for (const project of projectsResult.projects) {
    serverRuntime.db.upsertProjectFromCloud(project);
  }
}
```

Nenhuma alteração de schema ou tabela necessaria. A correção respeita a ordem relacional ja documentada na arquitetura: Empresas -> Projetos -> Dispositivos.

