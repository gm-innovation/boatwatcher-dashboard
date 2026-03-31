

## Corrigir localização de acessos manuais e incluí-los no Desktop

### Problemas identificados

1. **Local mostra "Manual" em vez de "Bordo"/"Dique"**: A query web não consulta o campo `access_location` do terminal manual. Precisa buscar essa configuração da tabela `manual_access_points` e mapear para "Bordo" ou "Dique".

2. **Desktop não mostra acessos manuais**: A query SQLite em `electron/database.js` filtra apenas por `device_id IN (SELECT id FROM devices ...)`. Logs manuais têm `device_id = NULL`, então são completamente ignorados.

### Alterações

**1. `src/hooks/useSupabase.ts`** — Buscar `access_location` do terminal e usar como label

Na query de `manual_access_points`, incluir `access_location`:
```typescript
const { data: manualPoints } = await supabase
  .from('manual_access_points')
  .select('name, access_location')
  .eq('project_id', projectId);
```

Criar um mapa `device_name → location`:
```typescript
const manualLocationMap = new Map(
  (manualPoints || []).flatMap(p => [
    [`Manual - ${p.name}`, p.access_location === 'dique' ? 'Dique' : 'Bordo']
  ])
);
```

Na linha 293, substituir:
```typescript
// Antes
const locationLabel = isManual ? 'Manual' : ...
// Depois
const locationLabel = isManual
  ? (manualLocationMap.get(onBoard.device_name || '') || 'Bordo')
  : accessLocation === 'dique' ? 'Dique' : 'Bordo';
```

**2. `electron/database.js`** — Incluir logs manuais na query SQLite

Alterar a função `getWorkersOnBoard` para também buscar logs onde `device_id IS NULL` e `device_name LIKE 'Manual - %'`. Usar uma `UNION` ou `OR` no filtro de dispositivos:

```sql
-- No deviceFilter, adicionar OR para logs manuais
AND (
  al.device_id IN (SELECT id FROM devices WHERE project_id = ?)
  OR (al.device_id IS NULL AND al.device_name LIKE 'Manual - %')
)
```

Mesma lógica para o filtro de exits. Ajustar os params correspondentes.

Na seção de mapeamento de localização (linha 1156-1158), adicionar fallback para logs manuais:
```javascript
const isManual = !r.device_id && r.device_name?.startsWith('Manual -');
const locationLabel = isManual ? 'Bordo' : (accessLocation === 'dique' ? 'Dique' : 'Bordo');
```

Para mapear corretamente o `access_location` do terminal manual no Desktop, consultar a tabela local `manual_access_points` (se sincronizada) ou usar `'Bordo'` como default seguro.

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/hooks/useSupabase.ts` | Buscar `access_location` e mapear para Bordo/Dique |
| `electron/database.js` | Incluir logs manuais (`device_id IS NULL`) na query |

