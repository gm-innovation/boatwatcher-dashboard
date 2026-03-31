

## Corrigir localização no Desktop — abordagem resiliente

### Problema real
O código no repositório está correto, mas o **Servidor Local instalado na máquina continua em v1.3.6** e não atualiza. O Desktop e o Servidor Local são instaladores independentes — o Desktop atualiza via `latest.yml`, o Servidor Local via `server.yml`. O Desktop já atualizou, mas o Servidor Local não.

### Solução
Aplicar a correção de localização **também no Desktop** (`electron/main.js`), como pós-processamento da resposta da API do Servidor Local. Assim, mesmo que o Servidor Local retorne `device_name` como `location`, o Desktop corrige para "Bordo" ou "Dique".

Adicionalmente, buscar a lista de devices para mapear `device_id → configuration.access_location` e aplicar no resultado.

### Alteração

**`electron/main.js`** — linha 405, substituir o handler de `getWorkersOnBoard`:

```javascript
ipcMain.handle('db:getWorkersOnBoard', async (_, projectId) => {
  const workers = await apiCall('GET', `/api/projects/${projectId}/workers-on-board`);
  
  // Resilience: if the Local Server is outdated and still returns device_name
  // as location, fetch devices and apply access_location mapping here
  if (Array.isArray(workers) && workers.length > 0) {
    const needsFix = workers.some(w => w.location && !['Bordo', 'Dique'].includes(w.location));
    if (needsFix) {
      try {
        const devices = await apiCall('GET', '/api/devices' + (projectId ? `?projectId=${projectId}` : ''));
        const deviceConfigMap = {};
        for (const d of (devices || [])) {
          const config = typeof d.configuration === 'string' ? JSON.parse(d.configuration) : (d.configuration || {});
          const loc = config.access_location || 'bordo';
          deviceConfigMap[d.name] = loc === 'dique' ? 'Dique' : 'Bordo';
        }
        for (const w of workers) {
          if (w.location && !['Bordo', 'Dique'].includes(w.location)) {
            w.location = deviceConfigMap[w.location] || 'Bordo';
          }
        }
      } catch (e) {
        // Fallback: set all non-standard locations to "Bordo"
        for (const w of workers) {
          if (w.location && !['Bordo', 'Dique'].includes(w.location)) {
            w.location = 'Bordo';
          }
        }
      }
    }
  }
  return workers;
});
```

### Por que essa abordagem?
- O **Desktop atualiza automaticamente** via `latest.yml` — funciona independente do Servidor Local
- É **retrocompatível** — se o Servidor Local já retorna "Bordo", o `needsFix` será `false` e nenhum processamento extra ocorre
- Resolve o problema **imediatamente** quando o Desktop atualizar, sem depender do Servidor Local

| Arquivo | Mudança |
|---|---|
| `electron/main.js` | Pós-processar resposta de `workers-on-board` para corrigir localização |

