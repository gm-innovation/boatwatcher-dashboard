

## Problema confirmado nos dados

| Campo | Valor |
|-------|-------|
| Worker company_id | `80a706ef...` (Googlemarine - terceirizada) |
| Project client_id | `19f70dad...` (armador) |
| Worker allowed_project_ids | `[]` (vazio) |

A query atual usa `OR(allowed_project_ids contains project, company_id = client_id)`. Nenhuma condição é atendida para trabalhadores de empresas terceirizadas sem projeto atribuido.

## Correção

Modificar o filtro de download de workers no `supabase/functions/agent-sync/index.ts` para remover a restrição por empresa/projeto. No modelo de docagem, o numero de trabalhadores ativos é limitado e todos precisam ser sincronizados com o agente local independentemente da empresa.

### Arquivo: `supabase/functions/agent-sync/index.ts` (linhas 549-577)

Substituir a logica de filtro OR por uma query simples que baixa **todos os trabalhadores ativos** sem filtrar por projeto ou empresa:

```typescript
let query = supabase
  .from('workers')
  .select('id, name, code, document_number, photo_url, status, company_id, role, allowed_project_ids, updated_at')
  .gte('updated_at', since)
  .eq('status', 'active')

// No project/company filter — in docking operations, all active workers
// (client staff, subcontractors, crew) need to be available locally
const { data: workers, error } = await query
```

Remover as linhas 550-577 que constroem e aplicam o `orConditions`. Atualizar o log para refletir a mudança.

Essa é a unica alteração necessaria. O deploy automatico da edge function fará o fix entrar em vigor imediatamente. Depois basta clicar "Sync Completo" novamente no desktop.

