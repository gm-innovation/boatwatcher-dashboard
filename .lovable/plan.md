

# Corrigir horário de entrada no Desktop

## Problema
O Desktop mostra **14:30** enquanto a Web mostra **17:12** (correto). Duas causas:

1. **Lógica invertida**: A query do Desktop (`electron/database.js` linha 1105) usa `ORDER BY al.timestamp DESC` com `ROW_NUMBER`, pegando o **último** evento. Deveria pegar o **primeiro** (entrada mais antiga), como a Web faz.

2. **Timestamp sem normalização UTC**: O SQLite local armazena timestamps em BRT (horário local do dispositivo), enquanto a nuvem armazena em UTC (+3h). O Desktop retorna o timestamp bruto sem converter para UTC → diferença de 3 horas.

## Solução

### Arquivo: `electron/database.js` — função `getWorkersOnBoard`

**A. Inverter ordenação para pegar primeira entrada**

Reescrever a CTE para buscar apenas eventos de `entry` ordenados `ASC`, e filtrar os que NÃO têm saída posterior:

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
SELECT fe.*, w.name, w.role, w.company_id, c.name as company_name
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
  )
```

**B. Normalizar timestamp para UTC no retorno**

No `rows.map`, adicionar +3h ao `entry_time` se não contém indicador de fuso (alinhando com o padrão UTC da nuvem):

```javascript
rows.map((r) => {
  let entryTime = r.entry_time;
  // Normalizar BRT → UTC (+3h) para alinhar com a nuvem
  if (entryTime && !entryTime.includes('Z') && !entryTime.includes('+')) {
    const d = new Date(entryTime);
    d.setHours(d.getHours() + 3);
    entryTime = d.toISOString();
  }
  return { ...resultado com entryTime normalizado };
})
```

### Arquivo alterado
- `electron/database.js` — reescrever query + normalizar timestamp

