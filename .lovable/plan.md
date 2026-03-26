

# Separar Clientes e Empresas

## Problema
Atualmente, "Clientes" (Admin > Clientes) e "Empresas" (Gestão de Pessoas > Empresas) usam a mesma tabela `companies` sem distinção. DOF é apenas Cliente, Googlemarine é apenas Empresa, mas ambos aparecem nos dois lugares.

## Solução
Adicionar uma coluna `type` à tabela `companies` com valores `'client'` ou `'company'`, e filtrar em cada tela.

### 1. Migração de banco de dados
- Adicionar coluna `type TEXT DEFAULT 'company'` à tabela `companies`
- Atualizar registros existentes conforme necessário (DOF → `'client'`, Googlemarine → `'company'`)

### 2. Hooks de dados (`src/hooks/useSupabase.ts`)
- Criar `useClients()` — filtra `type = 'client'`
- Criar `useContractorCompanies()` — filtra `type = 'company'`
- Manter `useCompanies()` sem filtro para uso geral

### 3. Admin > Clientes (`src/components/admin/ClientsManagement.tsx`)
- Trocar `useCompanies()` por `useClients()`
- No insert/update, garantir `type: 'client'`

### 4. Gestão de Pessoas > Empresas (`src/components/people/CompanyManagement.tsx`)
- Trocar `useCompanies()` por `useContractorCompanies()`
- No insert/update, garantir `type: 'company'`

### 5. Tipo TypeScript (`src/types/supabase.ts`)
- Adicionar `type: string | null` ao interface `Company`

### Arquivos alterados
- Migração SQL (nova)
- `src/hooks/useSupabase.ts`
- `src/components/admin/ClientsManagement.tsx`
- `src/components/people/CompanyManagement.tsx`
- `src/types/supabase.ts`

