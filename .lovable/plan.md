

## Corrigir filtro de Clientes vs Empresas no Controle de Acesso

### Problema
As queries em `AccessPointConfig.tsx` e `AccessControlConfig.tsx` buscam **todas** as empresas da tabela `companies` sem filtrar por `type = 'client'`. Isso faz com que empresas terceirizadas (como "Googlemarine") apareçam no seletor de clientes.

### Correção

**2 arquivos, mesma alteração** — adicionar `.eq('type', 'client')` nas queries:

1. **`src/components/access-control/AccessPointConfig.tsx`** (linha ~50):
   - Query `companies_for_access` → adicionar `.eq('type', 'client')`

2. **`src/pages/access-control/AccessControlConfig.tsx`** (linha ~60):
   - Query `companies_for_sync` → adicionar `.eq('type', 'client')`

Padrão já existente no projeto em `useClients()` de `src/hooks/useSupabase.ts`.

