

# Corrigir horário de entrada no Desktop (normalização UTC)

## Problema
Web mostra **17:56** (correto), Desktop mostra **14:56** — diferença de exatamente 3 horas. O SQLite local armazena timestamps em BRT (horário do dispositivo), mas o frontend espera UTC.

## Solução

### Arquivo: `electron/database.js` — função `getWorkersOnBoard` (linhas 1093-1129)

Duas correções:

**A. Inverter ordenação para pegar primeira entrada (consistência com a Web)**
- Mudar `ORDER BY al.timestamp DESC` para `ASC`
- Filtrar apenas `direction = 'entry'` na CTE
- Adicionar `NOT EXISTS` para excluir trabalhadores que já saíram

**B. Normalizar timestamp BRT → UTC no retorno**
No `rows.map`, converter `entry_time` adicionando +3h quando não contém indicador de fuso:

```javascript
rows.map((r) => {
  let entryTime = r.entry_time;
  if (entryTime && !entryTime.includes('Z') && !entryTime.includes('+')) {
    const d = new Date(entryTime);
    d.setHours(d.getHours() + 3);
    entryTime = d.toISOString();
  }
  return {
    id: r.worker_id,
    name: r.name || r.worker_name,
    location: r.device_name,
    role: r.role,
    company: r.company_name || 'N/A',
    company_id: r.company_id,
    entryTime,
  };
})
```

### Query SQL reescrita

```sql
WITH first_entries AS (
  SELECT al.worker_id, al.worker_name, al.device_name, al.timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(al.worker_name, al.worker_id) 
      ORDER BY al.timestamp ASC
    ) as rn
  FROM access_logs al
  WHERE al.timestamp >= ? || 'T00:00:00'
    AND al.access_status = 'granted'
    AND al.direction = 'entry'
    AND al.worker_id IS NOT NULL
    ${deviceFilter}
)
SELECT fe.worker_id, fe.worker_name, fe.device_name, fe.timestamp as entry_time,
  w.name, w.role, w.company_id, c.name as company_name
FROM first_entries fe
LEFT JOIN workers w ON fe.worker_id = w.id
LEFT JOIN companies c ON w.company_id = c.id
WHERE fe.rn = 1
  AND NOT EXISTS (
    SELECT 1 FROM access_logs ex
    WHERE (ex.worker_name = fe.worker_name OR ex.worker_id = fe.worker_id)
      AND ex.direction = 'exit'
      AND ex.timestamp > fe.timestamp
      AND ex.timestamp >= ? || 'T00:00:00'
      ${deviceFilter ? 'AND ex.device_id IN (SELECT id FROM devices WHERE project_id = ?)' : ''}
  )
```

Os `params` precisam ser ajustados para incluir o `today` e `projectId` extras na subquery de `NOT EXISTS`.

### Arquivo alterado
- `electron/database.js` — reescrever query + normalizar timestamp no retorno

