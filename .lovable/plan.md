

## Fix: Normalizar filtro de logs de acesso no SQLite para incluir dispositivos manuais

### Problema
O método `getAccessLogs` no `electron/database.js` (linha 1291-1293) filtra logs por projeto usando `d.project_id = ?` via LEFT JOIN com `devices`. Logs manuais têm `device_id = NULL`, então o JOIN retorna NULL para `d.project_id` e esses logs são **excluídos** do resultado.

Isso explica a discrepância: a Web busca logs manuais separadamente via `manual_access_points`, mas o SQLite local os ignora.

O método `getWorkersOnBoard` (linha 1358) já resolve isso corretamente com:
```sql
OR (al.device_id IS NULL AND al.device_name LIKE 'Manual - %')
```

### Correção

**Arquivo único: `electron/database.js`** — método `getAccessLogs` (linhas 1291-1294)

Substituir o filtro simples:
```javascript
if (filters.projectId) {
  conditions.push('d.project_id = ?');
  params.push(filters.projectId);
}
```

Por um filtro que inclui logs manuais do mesmo projeto:
```javascript
if (filters.projectId) {
  conditions.push(`(
    d.project_id = ?
    OR (al.device_id IS NULL AND al.device_name IN (
      SELECT 'Manual - ' || name FROM manual_access_points WHERE project_id = ?
    ))
  )`);
  params.push(filters.projectId, filters.projectId);
}
```

### Impacto
Essa única alteração corrige **todas** as áreas que consomem logs de acesso no Desktop:
- Dashboard (RecentActivityFeed)
- Relatórios na tela (WorkerTimeReport, PresenceReport, CompanyReport, OvernightControl, ReportsList)
- Relatórios em PDF (usam os mesmos dados dos relatórios na tela)
- Qualquer outra query que passe `projectId` para `getAccessLogs`

Todas essas áreas passam por `fetchAccessLogs` → `localAccessLogs.list()` → REST API → `database.getAccessLogs()`. A correção no ponto mais baixo da cadeia resolve tudo de uma vez.

### Arquivos a alterar
- `electron/database.js` — 1 ponto (linhas 1291-1294)

